import { DurableObject } from 'cloudflare:workers';
import { generateRequestDetails } from 'web-push';
import { planReminders, REMINDER_MESSAGES, RETRY_MINUTES } from './schedule.mjs';
import {
  METHODS, RequestError, digest, isToken, json, matches, payload, validatePreferences, validateSubscription,
} from './protocol.mjs';

const MINUTE = 60_000;
const DAY = 86_400_000;
const DEVICE_PREFIX = 'device:';
const KV_PREFIX = 'gp-push:v1:';
const DEVICE_LIMIT = 5;

function configured(env) {
  return Boolean(env.RAPPELS_KV && env.REMINDER_REGISTRY && isToken(env.REMINDERS_RELAY_TOKEN)
    && /^[a-f0-9]{64}$/.test(env.PAIRING_CODE_SHA256 || '')
    && /^[A-Za-z0-9_-]{87}$/.test(env.VAPID_PUBLIC_KEY || '') && isToken(env.VAPID_PRIVATE_KEY)
    && /^(mailto:|https:\/\/)/.test(env.VAPID_SUBJECT || ''));
}

function registry(env) {
  return env.REMINDER_REGISTRY.getByName('gros-petard-notifications');
}

function errorResponse(error) {
  if (error instanceof RequestError) return json({ error: error.message }, error.status);
  console.error('Reminder operation failed', error?.name);
  return json({ error: 'temporarily_unavailable' }, 503);
}

async function sendPush(subscription, body, tag, env, ttl) {
  let status = null;
  try {
    const details = generateRequestDetails(subscription, JSON.stringify({ body, tag }), {
      TTL: ttl,
      topic: tag,
      urgency: 'normal',
      vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    });
    const headers = new Headers(details.headers);
    headers.delete('content-length');
    const response = await fetch(details.endpoint, {
      method: details.method, headers, body: details.body, redirect: 'manual', signal: AbortSignal.timeout(4500),
    });
    status = response.status;
    await response.body?.cancel();
  } catch { /* An attempt without an HTTP response can be retried. */ }
  let outcome = 'unavailable';
  if (status >= 200 && status < 300) outcome = 'accepted';
  else if (status === 404 || status === 410) outcome = 'expired';
  const event = { event: 'reminders_push', flow: tag === 'gp-test' ? 'test' : 'scheduled', outcome, status };
  if (outcome === 'unavailable') console.warn(event);
  else console.info(event);
  return outcome;
}

function reminderHistory(state, record) {
  const history = { ...state?.sentOccurrences };
  // Older records only know the date. Associate it with the previous rule before rescheduling.
  for (const [kind, date] of Object.entries(state?.lastSent || {})) {
    const days = history[kind] || {};
    const rule = record.schedules[kind];
    if (rule && !Object.hasOwn(days, date)) history[kind] = { ...days, [date]: [rule.time] };
  }
  return history;
}

export class ReminderRegistry extends DurableObject {
  queue = Promise.resolve();

  fetch(request) {
    // Serialize updates and delivery. A successful removal precedes any later send.
    const response = this.queue.then(() => this.handle(request)).catch(errorResponse);
    this.queue = response.then(() => undefined);
    return response;
  }

  async handle(request) {
    const path = new URL(request.url).pathname;
    if (path === '/tick') {
      const { time } = await request.json();
      await this.deliver(time);
      return json({ ok: true });
    }

    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!isToken(token)) return json({ error: 'device_required' }, 401);
    const id = DEVICE_PREFIX + digest(token);
    const state = await this.ctx.storage.get(id);
    if (path === '/v1/unsubscribe') {
      if (state) await this.remove(id, state);
      return json({ ok: true });
    }
    if (path === '/v1/subscribe') {
      const data = await payload(request);
      if (typeof data.code !== 'string' || !/^[A-Za-z0-9_-]{32,43}$/.test(data.code)
          || !matches(digest(data.code), this.env.PAIRING_CODE_SHA256)) {
        return json({ error: 'invalid_pairing_code' }, 403);
      }
      return this.save(id, state, data);
    }
    if (!state) return json({ error: 'not_subscribed' }, 404);
    if (path === '/v1/preferences') return this.save(id, state, await payload(request));
    if (path === '/v1/test') return this.testPush(id, state);
    return json({ error: 'not_found' }, 404);
  }

  async save(id, state, data) {
    const subscription = await validateSubscription(data.subscription);
    const preferences = validatePreferences(data);
    const fingerprint = digest(subscription.endpoint);
    if (fingerprint !== state?.fingerprint) {
      const devices = await this.ctx.storage.list({ prefix: DEVICE_PREFIX });
      if (!state && devices.size >= DEVICE_LIMIT) return json({ error: 'device_limit' }, 409);
      for (const [otherId, device] of devices) {
        if (otherId !== id && device.fingerprint === fingerprint) return json({ error: 'subscription_in_use' }, 409);
      }
    }

    const previous = state && await this.readRecord(id, state);
    const content = { subscription, ...preferences };
    if (previous && JSON.stringify(content) === JSON.stringify({
      subscription: previous.subscription, schedules: previous.schedules, timeZone: previous.timeZone,
    })) return json({ active: true });

    const activeFrom = Date.now();
    const sameTimeZone = previous?.timeZone === content.timeZone;
    const activeFromByKind = Object.fromEntries(Object.entries(content.schedules).map(([kind, rule]) => {
      const unchanged = sameTimeZone && JSON.stringify(rule) === JSON.stringify(previous.schedules[kind]);
      return [kind, unchanged ? previous.activeFromByKind?.[kind] ?? previous.activeFrom : activeFrom];
    }));
    const record = { ...content, activeFrom, activeFromByKind };
    const kvKey = KV_PREFIX + crypto.randomUUID();
    await this.env.RAPPELS_KV.put(kvKey, JSON.stringify(record));
    try {
      await this.ctx.storage.put(id, {
        ...state, kvKey, fingerprint, savedRecord: { kvKey, record },
        sentOccurrences: reminderHistory(state, previous || record),
      });
    } catch (error) {
      await this.cleanKV(kvKey);
      throw error;
    }
    if (state?.kvKey) await this.cleanKV(state.kvKey);
    return json({ active: true });
  }

  async readRecord(id, state) {
    if (state.savedRecord?.kvKey === state.kvKey) return state.savedRecord.record;
    // Copy an existing subscription on first use. The KV key identifies its exact revision.
    const record = await this.env.RAPPELS_KV.get(state.kvKey, 'json');
    if (record) {
      state.savedRecord = { kvKey: state.kvKey, record };
      await this.ctx.storage.put(id, state);
    }
    return record;
  }

  async cleanKV(key) {
    try {
      await this.env.RAPPELS_KV.delete(key);
    } catch {
      console.warn('Could not remove a superseded reminder record');
    }
  }

  async remove(id, state) {
    await this.env.RAPPELS_KV.delete(state.kvKey);
    await this.ctx.storage.delete(id);
  }

  async testPush(id, state) {
    if (Date.now() - (state.lastTestAt || 0) < MINUTE) return json({ error: 'test_rate_limited' }, 429);
    const record = await this.readRecord(id, state);
    if (!record) return json({ error: 'temporarily_unavailable' }, 503);
    await this.ctx.storage.put(id, { ...state, lastTestAt: Date.now() });
    const result = await sendPush(record.subscription, 'Tu reçois les rappels sur cet appareil.', 'gp-test', this.env, 60);
    if (result === 'expired') {
      await this.remove(id, state);
      return json({ error: 'not_subscribed' }, 410);
    }
    return result === 'accepted' ? json({ accepted: true }) : json({ error: 'push_unavailable' }, 502);
  }

  async deliver(time) {
    if (!Number.isSafeInteger(time) || Date.now() - time >= RETRY_MINUTES * MINUTE) {
      console.warn({ event: 'reminders_schedule', outcome: 'invalid_or_stale_tick' });
      return;
    }
    const devices = await this.ctx.storage.list({ prefix: DEVICE_PREFIX });
    const summary = {
      event: 'reminders_schedule', devices: devices.size, not_due: 0, before_activation: 0,
      already_sent: 0, missing_record: 0, subscription_expired: 0, accepted: 0, push_unavailable: 0,
    };
    const deliveries = await Promise.allSettled([...devices].map(async ([id, state]) => {
      const record = await this.readRecord(id, state);
      if (!record) {
        summary.missing_record += 1;
        return;
      }
      if (record.subscription.expirationTime !== null && record.subscription.expirationTime <= Date.now()) {
        summary.subscription_expired += 1;
        await this.remove(id, state);
        return;
      }
      const sentOccurrences = reminderHistory(state, record);
      const { due, alreadySent, beforeActivation } = planReminders(record, time, sentOccurrences);
      summary.already_sent += alreadySent;
      summary.before_activation += beforeActivation;
      if (!due.length && !alreadySent && !beforeActivation) summary.not_due += 1;
      const lastSent = { ...state.lastSent };
      for (const { kind, date, time: localTime } of due) {
        const tag = `gp-${kind}-${date}-${localTime.replace(':', '')}`;
        const result = await sendPush(record.subscription, REMINDER_MESSAGES[kind], tag, this.env, 600);
        if (result === 'expired') {
          summary.subscription_expired += 1;
          await this.remove(id, state);
          return;
        }
        if (result === 'unavailable') {
          summary.push_unavailable += 1;
          continue;
        }
        summary.accepted += 1;
        lastSent[kind] = date;
        const days = sentOccurrences[kind] || {};
        const oldestDate = new Date(Date.parse(date) - 2 * DAY).toISOString().slice(0, 10);
        sentOccurrences[kind] = Object.fromEntries(Object.entries({ ...days, [date]: [...(days[date] || []), localTime] })
          .filter(([sentDate]) => sentDate >= oldestDate));
        await this.ctx.storage.put(id, { ...state, lastSent, sentOccurrences });
      }
    }));
    const failures = deliveries.filter(item => item.status === 'rejected').length;
    console.info({ ...summary, failures });
    if (failures) throw new Error('Delivery interrupted');
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/status' && request.method === 'GET') {
      const ok = Boolean(env.RAPPELS_KV);
      return json({
        ok, application: 'GROS PÉTARD — Nutrition', service: 'Rappels',
        stockage: ok ? 'KV connecté' : 'KV indisponible',
        notifications: configured(env) ? 'Configurées' : 'En cours de configuration',
      }, ok ? 200 : 503);
    }
    const action = /^\/v1\/([a-z]+)$/.exec(path)?.[1];
    if (!METHODS.has(action)) return json({ error: 'not_found' }, 404);
    if (request.method !== METHODS.get(action)) return json({ error: 'method_not_allowed' }, 405);
    if (!configured(env)) return json({ error: 'not_configured' }, 503);
    const relay = request.headers.get('x-reminders-relay');
    if (!isToken(relay) || !matches(relay, env.REMINDERS_RELAY_TOKEN)) return json({ error: 'forbidden' }, 403);
    if (action === 'config') return json({ publicKey: env.VAPID_PUBLIC_KEY });
    try {
      const headers = new Headers(request.headers);
      headers.delete('x-reminders-relay');
      return await registry(env).fetch(new Request(request, { headers }));
    } catch (error) {
      return errorResponse(error);
    }
  },

  async scheduled(controller, env, ctx) {
    if (!configured(env)) {
      console.warn({ event: 'reminders_schedule', outcome: 'not_configured' });
      return;
    }
    ctx.waitUntil((async () => {
      const response = await registry(env).fetch('https://reminders.internal/tick', {
        method: 'POST', body: JSON.stringify({ time: controller.scheduledTime }),
      });
      if (!response.ok) throw new Error('Reminder schedule interrupted');
    })());
  },
};
