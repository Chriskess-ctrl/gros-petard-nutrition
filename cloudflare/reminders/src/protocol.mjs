import { createHash, timingSafeEqual } from 'node:crypto';
import { REMINDER_MESSAGES } from './schedule.mjs';

export const isToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const digest = value => createHash('sha256').update(value).digest('hex');
export const matches = (left, right) => typeof left === 'string' && typeof right === 'string'
  && left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));

export const METHODS = new Map([
  ['config', 'GET'], ['subscribe', 'POST'],
  ['preferences', 'POST'], ['unsubscribe', 'POST'], ['test', 'POST'],
]);

export class RequestError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

export const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

export async function payload(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new RequestError(415, 'json_required');
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > 8192) throw new RequestError(413, 'request_too_large');
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
    return body;
  } catch {
    throw new RequestError(400, 'invalid_json');
  }
}

export function validatePreferences({ schedules, timeZone }) {
  if (typeof timeZone !== 'string' || timeZone.length > 80 || !/^[A-Za-z][\w+/-]*$/.test(timeZone)) {
    throw new RequestError(400, 'invalid_timezone');
  }
  let zone;
  try {
    zone = new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone;
  } catch {
    throw new RequestError(400, 'invalid_timezone');
  }
  const kinds = Object.keys(REMINDER_MESSAGES);
  if (!schedules || typeof schedules !== 'object' || Array.isArray(schedules)
      || Object.keys(schedules).length !== kinds.length) throw new RequestError(400, 'invalid_schedules');

  const validated = kinds.map(kind => {
    const entry = Object.hasOwn(schedules, kind) && schedules[kind];
    if (!entry || typeof entry.enabled !== 'boolean' || !['once', 'daily', 'weekly', 'monthly'].includes(entry.frequency)
        || typeof entry.time !== 'string' || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(entry.time)) {
      throw new RequestError(400, 'invalid_schedules');
    }
    const { enabled, frequency, day, time } = entry;
    const date = entry.date;
    if (frequency === 'once') {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
          || !Number.isFinite(Date.parse(date + 'T00:00:00Z'))
          || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) {
        throw new RequestError(400, 'invalid_schedules');
      }
      return [kind, { enabled, frequency, day: 0, time, date }];
    }
    const min = frequency === 'monthly' ? 1 : 0;
    const max = frequency === 'monthly' ? 31 : 6;
    if (frequency !== 'daily' && (!Number.isInteger(day) || day < min || day > max)) {
      throw new RequestError(400, 'invalid_schedules');
    }
    return [kind, { enabled, frequency, day: frequency === 'daily' ? 0 : day, time }];
  });
  return { schedules: Object.fromEntries(validated), timeZone: zone };
}

function keyBytes(value, length) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > 100) return null;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length === length && bytes.toString('base64url') === value ? bytes : null;
}

export async function validateSubscription(subscription) {
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys;
  const expirationTime = subscription?.expirationTime ?? null;
  if (typeof endpoint !== 'string' || endpoint.length > 2048) throw new RequestError(400, 'invalid_subscription');
  const url = URL.parse(endpoint);
  if (!url || url.origin !== 'https://fcm.googleapis.com' || url.href !== endpoint
      || url.username || url.password || url.search || url.hash
      || !/^\/fcm\/send\/[A-Za-z0-9._~:-]+$/.test(url.pathname)) {
    throw new RequestError(400, 'unsupported_push_service');
  }
  const point = keyBytes(keys?.p256dh, 65);
  if (!point || point[0] !== 4 || !keyBytes(keys?.auth, 16)
      || (expirationTime !== null && (!Number.isSafeInteger(expirationTime) || expirationTime <= Date.now()))) {
    throw new RequestError(400, 'invalid_subscription');
  }
  try {
    await crypto.subtle.importKey('raw', point, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  } catch {
    throw new RequestError(400, 'invalid_subscription');
  }
  return { endpoint, expirationTime, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}
