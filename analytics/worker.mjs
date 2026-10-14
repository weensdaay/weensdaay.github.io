import catalog from './catalog.json' with { type: 'json' };

const ORIGIN = 'https://weensdaay.github.io';
const DAY = 86_400_000;
const MAX_BYTES = 12_288;
const MAX_EVENTS = 16;
const SESSION_EVENT_LIMIT = 256;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
const pages = new Set(['/', '/en/']);
const devices = new Set(['mobile', 'tablet', 'desktop', 'unknown']);
const sources = new Set(['instagram', 'tiktok', 'youtube', 'telegram', 'google', 'yandex', 'other', 'direct']);
const accountPairs = new Set(['instagram-life', 'instagram-science', 'tiktok-life', 'tiktok-science',
  'youtube-life', 'youtube-science', 'youtube-archive', 'youtube-music', 'telegram-main']);
const actions = new Map([
  ['section-science', 'Научпоп'], ['section-life', 'Путешествия и жизнь'],
  ['section-music', 'Музыка'], ['section-projects', 'Проекты'], ['section-stats', 'Статистика'],
  ['language-ru', 'Русский язык'], ['language-en', 'Английский язык'],
  ['gallery-next', 'Следующий кадр'], ['gallery-previous', 'Предыдущий кадр'],
  ['links-scroll', 'Прокрутка ссылок'], ['copy-email', 'Копирование почты'],
  ['scroll-25', 'Прочитано 25%'], ['scroll-50', 'Прочитано 50%'],
  ['scroll-75', 'Прочитано 75%'], ['scroll-100', 'Прочитано 100%'],
]);
const sourceNames = Object.freeze({instagram:'Instagram', tiktok:'TikTok', youtube:'YouTube',
  telegram:'Telegram', google:'Google', yandex:'Яндекс', other:'Другие сайты', direct:'Прямой / неизвестно'});
const accountNames = Object.freeze({
  'instagram-life':'Instagram · жизнь', 'instagram-science':'Instagram · научпоп',
  'tiktok-life':'TikTok · жизнь', 'tiktok-science':'TikTok · научпоп',
  'youtube-life':'YouTube · влоги', 'youtube-science':'YouTube · научпоп',
  'youtube-archive':'YouTube · архив', 'youtube-music':'YouTube · музыка', 'telegram-main':'Telegram',
});
const destinationNames = new Map(catalog.map(({id, name}) => [id, name]));

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function response(status, data, origin = null, extras = {}) {
  const headers = new Headers({
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', ...extras,
  });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  if (status === 204) return new Response(null, {status, headers});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), {status, headers});
}

function exactKeys(value, allowed) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.includes(key));
}

export function validatePayload(value) {
  if (!exactKeys(value, ['sessionId', 'source', 'account', 'device', 'events'])
    || typeof value.sessionId !== 'string' || !UUID.test(value.sessionId) || !sources.has(value.source)
    || !devices.has(value.device) || !(value.account === null
      || (typeof value.account === 'string' && accountPairs.has(`${value.source}-${value.account}`)))
    || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > MAX_EVENTS) {
    throw new HttpError(400, 'Invalid event batch');
  }
  const ids = new Set();
  for (const event of value.events) {
    if (!exactKeys(event, ['id', 'type', 'page', 'target']) || typeof event.id !== 'string' || !UUID.test(event.id)
      || ids.has(event.id.toLowerCase()) || !pages.has(event.page)
      || !['pageview', 'click', 'action'].includes(event.type)
      || (event.type === 'pageview' && event.target !== undefined)
      || (event.type === 'click' && !destinationNames.has(event.target))
      || (event.type === 'action' && !actions.has(event.target))) {
      throw new HttpError(400, 'Invalid event');
    }
    ids.add(event.id.toLowerCase());
  }
  return {
    sessionId: value.sessionId.toLowerCase(), source:value.source, account:value.account, device:value.device,
    events:value.events.map(event => ({id:event.id.toLowerCase(), type:event.type, page:event.page, target:event.target ?? null})),
  };
}

async function readPayload(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type') ?? '')) {
    throw new HttpError(415, 'Expected JSON');
  }
  if (request.headers.has('Content-Encoding')) throw new HttpError(415, 'Content encoding not supported');
  const statedLength = request.headers.get('Content-Length');
  if (statedLength !== null && (!/^\d+$/.test(statedLength) || Number(statedLength) > MAX_BYTES)) {
    throw new HttpError(413, 'Batch too large');
  }
  if (!request.body) throw new HttpError(400, 'Missing body');
  const reader = request.body.getReader();
  const chunks = []; let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new HttpError(413, 'Batch too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); }
  catch { throw new HttpError(400, 'Invalid JSON'); }
  return validatePayload(parsed);
}

function ignored(request) {
  return request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1'
    || request.cf?.botManagement?.verifiedBot === true
    || /bot|crawler|spider|headless|preview|facebookexternalhit|slurp|lighthouse/i.test(request.headers.get('User-Agent') ?? '');
}

function requireBindings(env) {
  if (!env.DB?.prepare || !env.DB?.batch || !env.INGEST_LIMITER?.limit
    || typeof env.RATE_SALT !== 'string' || env.RATE_SALT.length < 32) {
    throw new HttpError(503, 'Analytics unavailable');
  }
}

async function rateLimit(request, env, now, kind) {
  const address = request.headers.get('CF-Connecting-IP');
  // The trusted edge supplies this header. Missing addresses fail closed, including local dev.
  if (!address || address.length > 64) throw new HttpError(400, 'Missing edge address');
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.RATE_SALT),
    {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(`${kind}:${Math.floor(now / DAY)}:${address}`));
  const digest = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const {success} = await env.INGEST_LIMITER.limit({key:digest});
  if (!success) throw new HttpError(429, 'Too many requests');
}

async function authorized(request, env) {
  if (typeof env.READ_TOKEN !== 'string' || env.READ_TOKEN.length < 32
    || typeof crypto.subtle.timingSafeEqual !== 'function') throw new HttpError(503, 'Analytics unavailable');
  const authorization = request.headers.get('Authorization') ?? '';
  if (authorization.length > 512 || !authorization.startsWith('Bearer ')) return false;
  const [expected, supplied] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(env.READ_TOKEN)),
    crypto.subtle.digest('SHA-256', encoder.encode(authorization.slice(7))),
  ]);
  return crypto.subtle.timingSafeEqual(expected, supplied);
}

export async function ingest(db, payload, country, now) {
  const {sessionId, source, account, device, events} = payload;
  // batch() is one D1 transaction: retries cannot duplicate an event or change first attribution.
  const statements = [db.prepare(`INSERT OR IGNORE INTO sessions
    (id, first_at, last_at, source, account, device, country, landing_page)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM json_each(?) AS incoming
      WHERE NOT EXISTS (SELECT 1 FROM events WHERE id = json_extract(incoming.value, '$.id')))`)
    .bind(sessionId, now, now, source, account, device, country, events[0].page, JSON.stringify(events))];
  for (const event of events) {
    statements.push(db.prepare(`INSERT OR IGNORE INTO events (id, session_id, received_at, type, page, target)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM sessions WHERE id = ? AND last_at >= ? AND first_at >= ?)
        AND (SELECT COUNT(*) FROM events WHERE session_id = ?) < ?`)
      .bind(event.id, sessionId, now, event.type, event.page, event.target, sessionId, now - 30 * 60_000,
        now - 4 * 60 * 60_000, sessionId, SESSION_EVENT_LIMIT));
  }
  statements.push(db.prepare(`UPDATE sessions SET last_at = COALESCE(
    (SELECT MAX(received_at) FROM events WHERE session_id = ?), last_at) WHERE id = ?`).bind(sessionId, sessionId));
  statements.push(db.prepare(`INSERT OR IGNORE INTO metadata (key, value)
    SELECT 'collection_started_at', ? WHERE EXISTS (SELECT 1 FROM events LIMIT 1)`).bind(new Date(now).toISOString()));
  const results = await db.batch(statements);
  return results.slice(1, events.length + 1).reduce((sum, result) => sum + Number(result.meta?.changes ?? 0), 0);
}

export async function snapshot(db, range, now) {
  const today = Math.floor(now / DAY) * DAY;
  const since = today - (range - 1) * DAY;
  const until = now + 1;
  const queries = [
    db.prepare("SELECT value FROM metadata WHERE key = 'collection_started_at'"),
    db.prepare(`SELECT COUNT(*) AS sessions FROM sessions WHERE first_at >= ? AND first_at < ?`).bind(since, until),
    db.prepare(`SELECT COALESCE(SUM(type = 'pageview'),0) AS pageViews,
      COALESCE(SUM(type = 'click'),0) AS outboundClicks FROM events WHERE received_at >= ? AND received_at < ?`).bind(since, until),
    db.prepare(`SELECT COUNT(*) AS engagedSessions FROM (SELECT session_id FROM events
      WHERE received_at >= ? AND received_at < ?
        AND session_id IN (SELECT id FROM sessions WHERE first_at >= ? AND first_at < ?)
      GROUP BY session_id
      HAVING SUM(type = 'click') > 0 OR SUM(type = 'pageview') >= 2
        OR SUM(type = 'action' AND target IN ('scroll-50','scroll-75','scroll-100')) > 0)`).bind(since, until, since, until),
    db.prepare(`SELECT strftime('%Y-%m-%d', first_at / 1000, 'unixepoch') AS date,
      COUNT(*) AS sessions FROM sessions WHERE first_at >= ? AND first_at < ? GROUP BY date`).bind(since, until),
    db.prepare(`SELECT strftime('%Y-%m-%d', received_at / 1000, 'unixepoch') AS date,
      SUM(type = 'pageview') AS pageViews, SUM(type = 'click') AS outboundClicks
      FROM events WHERE received_at >= ? AND received_at < ? GROUP BY date`).bind(since, until),
    db.prepare(`SELECT source, account, COUNT(*) AS sessions FROM sessions WHERE first_at >= ? AND first_at < ?
      GROUP BY source, account ORDER BY sessions DESC, source, account`).bind(since, until),
    db.prepare(`SELECT target AS id, COUNT(*) AS clicks FROM events WHERE received_at >= ? AND received_at < ?
      AND type = 'click' GROUP BY target ORDER BY clicks DESC, target`).bind(since, until),
    db.prepare(`SELECT country AS code, COUNT(*) AS sessions FROM sessions WHERE first_at >= ? AND first_at < ?
      GROUP BY country ORDER BY sessions DESC, country`).bind(since, until),
    db.prepare(`SELECT device AS name, COUNT(*) AS sessions FROM sessions WHERE first_at >= ? AND first_at < ?
      GROUP BY device ORDER BY sessions DESC, device`).bind(since, until),
    db.prepare(`SELECT landing_page AS path, COUNT(*) AS views FROM sessions WHERE first_at >= ? AND first_at < ?
      GROUP BY landing_page ORDER BY views DESC, landing_page`).bind(since, until),
    db.prepare(`SELECT target AS id, COUNT(*) AS events FROM events WHERE received_at >= ? AND received_at < ?
      AND type = 'action' GROUP BY target ORDER BY events DESC, target`).bind(since, until),
  ];
  const results = (await db.batch(queries)).map(result => result.results);
  const [metadata, sessionCount, eventCount, engagedCount, dailySessions, dailyEvents, sourceRows,
    destinationRows, countryRows, deviceRows, landingRows, actionRows] = results;
  const sessionsByDay = new Map(dailySessions.map(row => [row.date, row.sessions]));
  const eventsByDay = new Map(dailyEvents.map(row => [row.date, row]));
  return {
    project:'wensday', schemaVersion:1, generatedAt:new Date(now).toISOString(),
    collectionStartedAt:metadata[0]?.value ?? null,
    summary:{...sessionCount[0], ...eventCount[0], ...engagedCount[0]},
    timeseries:Array.from({length:range}, (_, index) => {
      const date = new Date(since + index * DAY).toISOString().slice(0,10);
      return {date, sessions:sessionsByDay.get(date) ?? 0,
        pageViews:eventsByDay.get(date)?.pageViews ?? 0, outboundClicks:eventsByDay.get(date)?.outboundClicks ?? 0};
    }),
    sources:sourceRows.map(row => ({...row, name:accountNames[`${row.source}-${row.account}`] ?? sourceNames[row.source] ?? 'Другие сайты'})),
    destinations:destinationRows.map(row => ({...row, name:destinationNames.get(row.id) ?? 'Ссылка на сайте'})),
    countries:countryRows, devices:deviceRows, landingPages:landingRows,
    actions:actionRows.map(row => ({name:row.id, events:row.events})),
  };
}

export async function prune(db, now) {
  const cutoff = Math.floor(now / DAY) * DAY - 89 * DAY;
  await db.batch([
    db.prepare('DELETE FROM events WHERE received_at < ?').bind(cutoff),
    db.prepare('DELETE FROM sessions WHERE last_at < ? AND NOT EXISTS (SELECT 1 FROM events WHERE session_id = sessions.id)').bind(cutoff),
  ]);
}

export function createHandler({now = () => Date.now()} = {}) {
  return {
    async fetch(request, env) {
      let corsOrigin = null;
      try {
        const url = new URL(request.url);
        if (url.pathname === '/health' && request.method === 'GET') {
          return response(200, {service:'wensday-analytics', schemaVersion:1});
        }
        if (url.pathname === '/v1/events') {
          if (request.headers.get('Origin') !== ORIGIN) throw new HttpError(403, 'Origin not allowed');
          corsOrigin = ORIGIN;
          if (request.method === 'OPTIONS') {
            if (request.headers.get('Access-Control-Request-Method') !== 'POST'
              || (request.headers.get('Access-Control-Request-Headers') ?? '').split(',').some(
                header => header.trim() && !['content-type', 'dnt', 'sec-gpc'].includes(header.trim().toLowerCase()))) {
              throw new HttpError(403, 'Preflight not allowed');
            }
            return response(204, null, corsOrigin, {'Access-Control-Allow-Methods':'POST',
              'Access-Control-Allow-Headers':'Content-Type, DNT, Sec-GPC', 'Access-Control-Max-Age':'3600'});
          }
          if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
          if (url.search) throw new HttpError(400, 'Query parameters not supported');
          if (ignored(request)) return response(204, null, corsOrigin);
          requireBindings(env);
          const timestamp = now();
          await rateLimit(request, env, timestamp, 'ingest');
          const payload = await readPayload(request);
          const country = /^[A-Z]{2}$/.test(request.cf?.country ?? '') ? request.cf.country : 'XX';
          await ingest(env.DB, payload, country, timestamp);
          return response(204, null, corsOrigin);
        }
        if (url.pathname === '/api/control/v1/projects/wensday/analytics') {
          if (request.method !== 'GET') throw new HttpError(405, 'Method not allowed');
          // This endpoint is for the native owner app: never grant browser CORS access.
          requireBindings(env);
          const timestamp = now();
          await rateLimit(request, env, timestamp, 'read');
          if (!await authorized(request, env)) throw new HttpError(401, 'Unauthorized');
          const entries = [...url.searchParams.entries()];
          const rawRange = url.searchParams.get('range') ?? '30';
          if (entries.some(([key]) => key !== 'range') || entries.length > 1 || !['7','30','90'].includes(rawRange)) {
            throw new HttpError(400, 'Invalid range');
          }
          return response(200, await snapshot(env.DB, Number(rawRange), timestamp));
        }
        throw new HttpError(404, 'Not found');
      } catch (error) {
        // Never log event bodies, authorization headers, edge addresses, or database errors.
        return response(error instanceof HttpError ? error.status : 503,
          {error:error instanceof HttpError ? error.message : 'Analytics unavailable'}, corsOrigin);
      }
    },
    async scheduled(controller, env, ctx) {
      if (!env.DB?.batch) throw new Error('Missing database');
      ctx.waitUntil(prune(env.DB, controller.scheduledTime ?? now()));
    },
  };
}

export default createHandler();
