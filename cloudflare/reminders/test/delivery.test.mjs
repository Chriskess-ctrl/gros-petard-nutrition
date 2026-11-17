import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { register } from 'node:module';
import test from 'node:test';
import { generateVAPIDKeys } from 'web-push';
import { digest } from '../src/protocol.mjs';
import { REMINDER_MESSAGES } from '../src/schedule.mjs';

// Load the Worker in Node with an in-memory Durable Object binding.
const durableObject = 'export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }';
register(`data:text/javascript,${encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (specifier !== 'cloudflare:workers') return next(specifier, context);
    return { url: ${JSON.stringify(`data:text/javascript,${encodeURIComponent(durableObject)}`)}, shortCircuit: true };
  }
`)}`);
const { default: worker, ReminderRegistry } = await import('../src/index.mjs');

const token = 'a'.repeat(43);
const code = 'b'.repeat(32);
const deviceId = 'device:' + digest(token);
const vapid = generateVAPIDKeys();
const p256dh = createECDH('prime256v1').generateKeys().toString('base64url');
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic-device', expirationTime: null,
  keys: { p256dh, auth: randomBytes(16).toString('base64url') },
};
const daily = time => ({ enabled: true, frequency: 'daily', time });

function fixture(t) {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-17T19:00:23Z') });
  const log = t.mock.method(console, 'info', () => {});
  const warnings = t.mock.method(console, 'warn', () => {});
  const devices = new Map();
  const kv = new Map();
  const options = { kvReadable: true, pushStatus: 201 };
  const storage = {
    get: async key => structuredClone(devices.get(key)),
    put: async (key, value) => { devices.set(key, structuredClone(value)); },
    list: async () => structuredClone(devices),
    delete: async key => devices.delete(key),
  };
  const env = {
    REMINDERS_RELAY_TOKEN: 'c'.repeat(43), PAIRING_CODE_SHA256: digest(code),
    VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey,
    VAPID_SUBJECT: 'mailto:push@example.test',
    RAPPELS_KV: {
      get: async key => options.kvReadable && kv.has(key) ? JSON.parse(kv.get(key)) : null,
      put: async (key, value) => { kv.set(key, value); },
      delete: async key => kv.delete(key),
    },
    REMINDER_REGISTRY: { getByName: () => ({ fetch: (url, init) => registry.fetch(new Request(url, init)) }) },
  };
  const registry = new ReminderRegistry({ storage }, env);
  const topics = [];
  t.mock.method(globalThis, 'fetch', async (endpoint, request) => {
    topics.push({ endpoint, topic: request.headers.get('topic'), ttl: request.headers.get('ttl') });
    return new Response(null, { status: options.pushStatus });
  });

  function call(action, body) {
    return worker.fetch(new Request('https://worker.example.test/v1/' + action, {
      method: 'POST', body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json', 'x-reminders-relay': env.REMINDERS_RELAY_TOKEN,
        authorization: 'Bearer ' + token,
      },
    }), env);
  }

  async function save(enabled, action = 'preferences') {
    const schedules = Object.fromEntries(Object.keys(REMINDER_MESSAGES).map(kind => [
      kind, enabled[kind] || { ...daily('20:00'), enabled: false },
    ]));
    const response = await call(action, { code, subscription, schedules, timeZone: 'Europe/Paris' });
    assert.equal(response.status, 200);
  }

  async function tick(utc) {
    const scheduledTime = Date.parse(utc);
    t.mock.timers.setTime(scheduledTime + 8000);
    let delivery;
    await worker.scheduled({ scheduledTime }, env, { waitUntil: task => { delivery = task; } });
    assert.ok(delivery);
    await delivery;
  }

  return { call, save, tick, topics, devices, kv, options, log, warnings };
}

test('Cron catches a reminder saved during its target minute with no browser request', async t => {
  const { save, tick, topics } = fixture(t);
  await save({ dinner: daily('20:00') }, 'subscribe');
  await tick('2026-11-17T19:01:00Z');
  await tick('2026-11-17T19:02:00Z');
  assert.equal(topics.length, 1);
});

test('daily reminders can be rescheduled on the same date and still run on the next date', async t => {
  const { call, save, tick, topics } = fixture(t);
  await save({ dinner: daily('20:01') }, 'subscribe');
  assert.deepEqual(await (await call('test', {})).json(), { accepted: true });
  await tick('2026-11-17T19:01:00Z');
  await save({ dinner: daily('20:02') });
  await tick('2026-11-17T19:02:00Z');

  await save({ dinner: daily('20:01') });
  await tick('2026-11-17T19:03:00Z');
  await tick('2026-11-18T19:01:00Z');
  assert.equal(topics.length, 4);
  assert.equal(new Set(topics.map(({ topic }) => topic)).size, 4);
  assert.ok(topics.every(({ topic }) => /^[a-z0-9-]{1,32}$/.test(topic)));
  assert.deepEqual(topics.map(({ ttl }) => ttl), ['60', '600', '600', '600']);
});

test('the latest saved rule is available to Cron while KV cannot read that revision yet', async t => {
  const { save, tick, topics, options } = fixture(t);
  await save({ dinner: daily('20:01') }, 'subscribe');
  await save({ dinner: daily('20:02') });
  options.kvReadable = false;
  await tick('2026-11-17T19:01:00Z');
  assert.equal(topics.length, 0);
  await tick('2026-11-17T19:02:00Z');
  assert.equal(topics.length, 1);
});

test('a transient refusal remains eligible when another schedule changes', async t => {
  const { save, tick, topics, options, warnings } = fixture(t);
  await save({ dinner: daily('20:01') }, 'subscribe');
  options.pushStatus = 503;
  await tick('2026-11-17T19:01:00Z');
  options.pushStatus = 201;
  t.mock.timers.setTime(Date.parse('2026-11-17T19:02:10Z'));
  await save({ dinner: daily('20:01'), lunch: daily('12:30') });
  await tick('2026-11-17T19:03:00Z');
  await tick('2026-11-17T19:04:00Z');
  assert.equal(topics.length, 2);
  assert.equal(topics[0].topic, topics[1].topic);
  assert.deepEqual(warnings.mock.calls[0].arguments, [
    { event: 'reminders_push', flow: 'scheduled', outcome: 'unavailable', status: 503 },
  ]);
});

test('devices registered before the change retain the sent slot and can reschedule', async t => {
  const { save, tick, topics, devices, kv, options } = fixture(t);
  await save({ dinner: daily('20:01') }, 'subscribe');
  const { kvKey, fingerprint } = devices.get(deviceId);
  const record = JSON.parse(kv.get(kvKey));
  delete record.activeFromByKind;
  kv.set(kvKey, JSON.stringify(record));
  devices.set(deviceId, { kvKey, fingerprint, lastSent: { dinner: '2026-11-17' } });

  await tick('2026-11-17T19:01:00Z');
  assert.equal(topics.length, 0);
  options.kvReadable = false;
  await save({ dinner: daily('20:02') });
  await tick('2026-11-17T19:02:00Z');
  assert.equal(topics.length, 1);
  assert.match(topics[0].topic, /-2002$/);
});

test('overlapping Cron invocations send a due occurrence once', async t => {
  const { save, tick, topics, log } = fixture(t);
  await save({ dinner: daily('20:01') }, 'subscribe');
  await Promise.all([tick('2026-11-17T19:01:00Z'), tick('2026-11-17T19:01:00Z')]);
  assert.equal(topics.length, 1);
  const events = log.mock.calls.map(({ arguments: [event] }) => event);
  assert.equal(events.filter(event => event.already_sent === 1).length, 1);
});

test('a 410 removes the expired subscription and records the reason', async t => {
  const { save, tick, topics, devices, kv, options, log } = fixture(t);
  await save({ dinner: daily('20:01') }, 'subscribe');
  options.pushStatus = 410;
  await tick('2026-11-17T19:01:00Z');
  await tick('2026-11-17T19:02:00Z');
  assert.equal(topics.length, 1);
  assert.equal(devices.size, 0);
  assert.equal(kv.size, 0);
  const events = log.mock.calls.map(({ arguments: [event] }) => event);
  assert.deepEqual(events[0], { event: 'reminders_push', flow: 'scheduled', outcome: 'expired', status: 410 });
  assert.equal(events[1].subscription_expired, 1);
});
