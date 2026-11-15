import { DurableObject } from 'cloudflare:workers';
import { generateRequestDetails } from 'web-push';
import { dueReminders, REMINDER_MESSAGES, RETRY_MINUTES } from './schedule.mjs';
import {
  METHODS, RequestError, digest, isToken, json, matches, payload, validatePreferences, validateSubscription,
} from './protocol.mjs';

const MINUTE = 60_000;
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
  const details = generateRequestDetails(subscription, JSON.stringify({ body, tag }), {
    TTL: ttl,
    topic: tag,
    urgency: 'normal',
    vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
  });
  try {
    const headers = new Headers(details.headers);
    headers.delete('content-length');
    const response = await fetch(details.endpoint, {
      method: details.method, headers, body: details.body, redirect: 'manual', signal: AbortSignal.timeout(4500),
    });
    await response.body?.cancel();
    if (response.ok) return 'accepted';
    if (response.status === 404 || response.status === 410) return 'expired';
    console.warn('Push service refused delivery', response.status);
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
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

    const previous = state && await this.env.RAPPELS_KV.get(state.kvKey, 'json');
    const content = { subscription, ...preferences };
    if (previous && JSON.stringify(content) === JSON.stringify({
      subscription: previous.subscription, schedules: previous.schedules, timeZone: previous.timeZone,
    })) return json({ active: true });

    // A fresh KV key avoids reading a cached value from a prior revision.
    const kvKey = KV_PREFIX + crypto.randomUUID();
    await this.env.RAPPELS_KV.put(kvKey, JSON.stringify({ ...content, activeFrom: Date.now() }));
    try {
      await this.ctx.storage.put(id, { ...state, kvKey, fingerprint, lastSent: state?.lastSent || {} });
    } catch (error) {
      await this.cleanKV(kvKey);
      throw error;
    }
    if (state?.kvKey) await this.cleanKV(state.kvKey);
    return json({ active: true });
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
    const record = await this.env.RAPPELS_KV.get(state.kvKey, 'json');
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
    if (!Number.isSafeInteger(time) || Date.now() - time >= RETRY_MINUTES * MINUTE) return;
    const devices = await this.ctx.storage.list({ prefix: DEVICE_PREFIX });
    const deliveries = await Promise.allSettled([...devices].map(async ([id, state]) => {
      const record = await this.env.RAPPELS_KV.get(state.kvKey, 'json');
      if (!record) return;
      if (record.subscription.expirationTime !== null && record.subscription.expirationTime <= Date.now()) {
        await this.remove(id, state);
        return;
      }
      const lastSent = { ...state.lastSent };
      for (const { kind, date } of dueReminders(record, time, lastSent)) {
        const result = await sendPush(record.subscription, REMINDER_MESSAGES[kind], `gp-${kind}-${date}`, this.env, 600);
        if (result === 'expired') {
          await this.remove(id, state);
          return;
        }
        if (result === 'accepted') {
          lastSent[kind] = date;
          await this.ctx.storage.put(id, { ...state, lastSent });
        }
      }
    }));
    if (deliveries.some(item => item.status === 'rejected')) throw new Error('Delivery interrupted');
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
    if (!configured(env)) return;
    ctx.waitUntil((async () => {
      const response = await registry(env).fetch('https://reminders.internal/tick', {
        method: 'POST', body: JSON.stringify({ time: controller.scheduledTime }),
      });
      if (!response.ok) throw new Error('Reminder schedule interrupted');
    })());
  },
};
