const actions = new Map([
  ['config', 'GET'], ['subscribe', 'POST'],
  ['preferences', 'POST'], ['unsubscribe', 'POST'], ['test', 'POST'],
]);
const limit = 8192;
const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const fail = (status, error) => Response.json({ error }, { status, headers });

function workerOrigin(env) {
  const url = URL.parse(env.REMINDERS_WORKER_URL || '');
  if (!url) return null;
  const worker = env.VERCEL_ENV === 'production' ? 'gros-petard-rappels' : 'gros-petard-rappels-recette';
  const host = new RegExp('^' + worker + '\\.[a-z0-9-]+\\.workers\\.dev$');
  return url.protocol === 'https:' && host.test(url.hostname) && url.href === url.origin + '/'
    && !url.port ? url.origin : null;
}

async function smallBody(request) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const buffer = new Uint8Array(limit);
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return buffer.subarray(0, length);
    if (length + value.byteLength > limit) {
      await reader.cancel();
      return null;
    }
    buffer.set(value, length);
    length += value.byteLength;
  }
}

export async function relay(request, env = process.env, transport = fetch) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  if (!actions.has(action)) return fail(404, 'not_found');
  if (request.method !== actions.get(action)) return fail(405, 'method_not_allowed');
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if ((origin && origin !== url.origin) || (site && !['same-origin', 'none'].includes(site))) {
    return fail(403, 'browser_origin_rejected');
  }
  const upstream = workerOrigin(env);
  const relayToken = env.REMINDERS_RELAY_TOKEN;
  if (!upstream || !/^[A-Za-z0-9_-]{43}$/.test(relayToken || '')) return fail(503, 'not_configured');

  try {
    const forwarded = new Headers({ 'x-reminders-relay': relayToken });
    const authorization = request.headers.get('authorization');
    if (authorization) forwarded.set('authorization', authorization);
    let body;
    if (request.method === 'POST') {
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
        return fail(415, 'json_required');
      }
      if (Number(request.headers.get('content-length')) > limit) return fail(413, 'request_too_large');
      body = await smallBody(request);
      if (!body) return fail(413, 'request_too_large');
      forwarded.set('content-type', 'application/json');
    }
    const response = await transport(upstream + '/v1/' + action, {
      method: request.method, headers: forwarded, body, redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    if (action === 'config' && response.status === 403) {
      return fail(403, 'cloudflare_relay_token_rejected');
    }
    return new Response(response.body, {
      status: response.status,
      headers: { ...headers, 'content-type': 'application/json; charset=utf-8' },
    });
  } catch {
    return fail(502, 'temporarily_unavailable');
  }
}

export default { fetch: request => relay(request) };
