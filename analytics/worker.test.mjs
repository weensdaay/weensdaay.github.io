import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID, timingSafeEqual} from 'node:crypto';
import {createHandler, ingest, snapshot, prune, validatePayload} from './worker.mjs';

// Node's crypto lacks Workers' extension; use Node's equivalent native constant-time comparison.
crypto.subtle.timingSafeEqual ??= (a, b) => timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
const NOW = Date.parse('2026-10-14T08:00:00Z');
const DAY = 86_400_000;
const ORIGIN = 'https://weensdaay.github.io';
const TOKEN = 'test-only-read-token-not-a-deployed-secret-0000';

function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(readFileSync(new URL('./migrations/0001_events.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const db = {
    prepare(sql) {
      return {sql, params:[], bind(...params) { return {...this, params}; }};
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(({sql, params}) => {
          const statement = sqlite.prepare(sql);
          if (/^\s*SELECT\b/i.test(sql)) return {success:true, results:statement.all(...params).map(row => ({...row}))};
          return {success:true, results:[], meta:statement.run(...params)};
        });
        sqlite.exec('COMMIT'); return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return {db, sqlite};
}

function env(db, overrides = {}) {
  return {DB:db, READ_TOKEN:TOKEN, RATE_SALT:'test-only-independent-rate-limit-salt-0000',
    INGEST_LIMITER:{limit:async () => ({success:true})}, ...overrides};
}
function event(type = 'pageview', target) {
  return {id:randomUUID(), type, page:'/', ...(target ? {target} : {})};
}
function batch(events = [event()], overrides = {}) {
  return {sessionId:randomUUID(), source:'instagram', account:'life', device:'mobile', events, ...overrides};
}
function request(path, {body, method = 'POST', headers = {}, country = 'ID'} = {}) {
  const req = new Request(`https://analytics.example.test${path}`, {
    method, headers:{Origin:ORIGIN, 'CF-Connecting-IP':'192.0.2.19', 'Content-Type':'application/json', ...headers},
    ...(body !== undefined ? {body:typeof body === 'string' ? body : JSON.stringify(body)} : {}),
  });
  Object.defineProperty(req, 'cf', {value:{country}});
  return req;
}
function readRequest(range = '7', headers = {}) {
  return request(`/api/control/v1/projects/wensday/analytics?range=${range}`, {
    method:'GET', headers:{Authorization:`Bearer ${TOKEN}`, ...headers},
  });
}

test('public write → private report: totals, first attribution, devices, country and destinations', async t => {
  const {db, sqlite} = database(t);
  let timestamp = NOW;
  const handler = createHandler({now:() => timestamp});
  const payload = batch([event(), event('click', 'telegram'), event('action', 'scroll-50')]);
  const result = await handler.fetch(request('/v1/events', {body:payload}), env(db));
  assert.equal(result.status, 204);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  timestamp += 5000;
  const later = {...payload, source:'tiktok', account:'science', device:'desktop', events:[event('click', 'contact-email')]};
  assert.equal((await handler.fetch(request('/v1/events', {body:later, country:'US'}), env(db))).status, 204);
  const reportResponse = await handler.fetch(readRequest(), env(db));
  assert.equal(reportResponse.status, 200);
  assert.equal(reportResponse.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(reportResponse.headers.get('Cache-Control'), 'no-store');
  const report = await reportResponse.json();
  assert.deepEqual(report.summary, {sessions:1, pageViews:1, outboundClicks:2, engagedSessions:1});
  assert.equal(report.collectionStartedAt, new Date(NOW).toISOString());
  assert.deepEqual(report.sources, [{source:'instagram', account:'life', sessions:1, name:'Instagram · жизнь'}]);
  assert.deepEqual(report.devices, [{name:'mobile', sessions:1}]);
  assert.deepEqual(report.countries, [{code:'ID', sessions:1}]);
  assert.deepEqual(report.landingPages, [{path:'/', views:1}]);
  assert.equal(report.destinations.length, 2);
  assert.equal(report.actions[0].events, 1);
  assert.equal(report.timeseries.length, 7);
  assert.deepEqual(report.timeseries.at(-1), {date:'2026-10-14', sessions:1, pageViews:1, outboundClicks:2});
  const serialized = JSON.stringify(sqlite.prepare('SELECT * FROM sessions').all())
    + JSON.stringify(sqlite.prepare('SELECT * FROM events').all());
  assert.ok(!serialized.includes('192.0.2.19'));
  assert.ok(!serialized.includes(TOKEN));
  assert.deepEqual(sqlite.prepare('PRAGMA table_info(sessions)').all().map(row => row.name),
    ['id','first_at','last_at','source','account','device','country','landing_page']);
});

test('retry and cross-session replay do not duplicate either sessions or events', async t => {
  const {db} = database(t);
  const payload = validatePayload(batch([event(), event('click', 'telegram')]));
  assert.equal(await ingest(db, payload, 'GB', NOW), 2);
  assert.equal(await ingest(db, payload, 'GB', NOW + 10), 0);
  assert.equal(await ingest(db, {...payload, sessionId:randomUUID()}, 'GB', NOW + 20), 0);
  const report = await snapshot(db, 7, NOW + 20);
  assert.deepEqual(report.summary, {sessions:1, pageViews:1, outboundClicks:1, engagedSessions:1});
});

test('session inactivity and hard per-session event cap limit ingestion atomically', async t => {
  const {db} = database(t);
  const id = randomUUID();
  for (let index = 0; index < 17; index++) {
    await ingest(db, validatePayload(batch(Array.from({length:16}, () => event('action', 'gallery-next')), {sessionId:id})), 'XX', NOW + index);
  }
  assert.equal((await snapshot(db, 7, NOW + 100)).actions[0].events, 256);
  const stale = validatePayload(batch([event()], {sessionId:id}));
  assert.equal(await ingest(db, stale, 'XX', NOW + 31 * 60_000), 0);
  assert.equal(await ingest(db, {...stale, sessionId:randomUUID()}, 'XX', NOW + 31 * 60_000), 1);
  assert.equal((await snapshot(db, 7, NOW + 31 * 60_000)).summary.sessions, 2);
});

test('unknown country is XX; non-allowlisted fields, identifiers, pages and attribution are rejected', async t => {
  const {db} = database(t);
  const handler = createHandler({now:() => NOW});
  const invalid = [
    batch([], {}), batch(Array.from({length:17}, () => event())),
    batch([event()], {email:'unwanted@example.test'}), batch([event()], {source:'instagram', account:'archive'}),
    batch([event()], {source:'instagram', account:'instagram-life'}),
    batch([event()], {sessionId:[randomUUID()]}), batch([event()], {sessionId:'not-a-uuid'}),
    batch([{...event(), ip:'192.0.2.1'}]), batch([{...event(), page:'/?private=secret'}]),
    batch([{...event(), target:null}]), batch([event('click', 'https://evil.example')]),
    batch([event('action', "'; DROP TABLE events;--")]), batch([event()], {device:'Safari'}),
  ];
  const duplicate = event(); invalid.push(batch([duplicate, duplicate]));
  for (const payload of invalid) {
    assert.equal((await handler.fetch(request('/v1/events', {body:payload}), env(db))).status, 400);
  }
  assert.equal((await snapshot(db, 7, NOW)).summary.sessions, 0);
  assert.equal((await handler.fetch(request('/v1/events', {body:batch(), country:'some-country'}), env(db))).status, 204);
  assert.deepEqual((await snapshot(db, 7, NOW)).countries, [{code:'XX', sessions:1}]);
});

test('even continuously active session IDs expire after four hours', async t => {
  const {db} = database(t);
  const id = randomUUID();
  for (let minutes = 0; minutes <= 240; minutes += 20) {
    assert.equal(await ingest(db, validatePayload(batch([event()], {sessionId:id})), 'XX', NOW + minutes * 60_000), 1);
  }
  assert.equal(await ingest(db, validatePayload(batch([event()], {sessionId:id})), 'XX', NOW + 241 * 60_000), 0);
  assert.equal((await snapshot(db, 7, NOW + 241 * 60_000)).summary.pageViews, 13);
});

test('strict origin, methods, preflight, content type, byte-size and query boundaries', async t => {
  const {db} = database(t);
  const handler = createHandler({now:() => NOW});
  for (const origin of ['null', '', 'https://evil.example', 'https://weensdaay.github.io.evil.example']) {
    const result = await handler.fetch(request('/v1/events', {body:batch(), headers:{Origin:origin}}), env(db));
    assert.equal(result.status, 403); assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal((await handler.fetch(request('/v1/events', {method:'GET'}), env(db))).status, 405);
  assert.equal((await handler.fetch(request('/v1/events?email=bad', {body:batch()}), env(db))).status, 400);
  assert.equal((await handler.fetch(request('/v1/events', {body:batch(), headers:{'Content-Type':'text/plain'}}), env(db))).status, 415);
  assert.equal((await handler.fetch(request('/v1/events', {body:'{broken'}), env(db))).status, 400);
  assert.equal((await handler.fetch(request('/v1/events', {body:' '.repeat(12_289)}), env(db))).status, 413);
  assert.equal((await handler.fetch(request('/v1/events', {body:batch(), headers:{'Content-Length':'13000'}}), env(db))).status, 413);
  const preflight = await handler.fetch(request('/v1/events', {method:'OPTIONS', headers:{
    'Access-Control-Request-Method':'POST', 'Access-Control-Request-Headers':'content-type',
  }}), env(db));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), null);
  assert.equal((await handler.fetch(request('/v1/events', {method:'OPTIONS', headers:{
    'Access-Control-Request-Method':'POST', 'Access-Control-Request-Headers':'authorization',
  }}), env(db))).status, 403);
  assert.equal((await handler.fetch(request('/v1/events', {body:batch(), headers:{'Content-Encoding':'gzip'}}), env(db))).status, 415);
});

test('tracking preferences and known bots generate no data or rate-limit keys', async t => {
  const {db} = database(t);
  const handler = createHandler({now:() => NOW});
  let rateCalls = 0;
  const bindings = env(db, {INGEST_LIMITER:{limit:async () => { rateCalls++; return {success:true}; }}});
  for (const headers of [{DNT:'1'}, {'Sec-GPC':'1'}, {'User-Agent':'Googlebot'}, {'User-Agent':'HeadlessChrome'}]) {
    assert.equal((await handler.fetch(request('/v1/events', {body:batch(), headers}), bindings)).status, 204);
  }
  assert.equal(rateCalls, 0);
  assert.equal((await snapshot(db, 7, NOW)).collectionStartedAt, null);
});

test('read auth, configuration failures and rate limits fail closed without leaking details', async t => {
  const {db} = database(t);
  const handler = createHandler({now:() => NOW});
  for (const header of ['', 'Bearer wrong', `Basic ${TOKEN}`, `Bearer ${TOKEN}x`]) {
    assert.equal((await handler.fetch(readRequest('7', {Authorization:header}), env(db))).status, 401);
  }
  for (const override of [{DB:null}, {INGEST_LIMITER:null}, {RATE_SALT:''}]) {
    assert.equal((await handler.fetch(request('/v1/events', {body:batch()}), env(db, override))).status, 503);
  }
  assert.equal((await handler.fetch(readRequest(), env(db, {READ_TOKEN:''}))).status, 503);
  assert.equal((await handler.fetch(readRequest('365'), env(db))).status, 400);
  assert.equal((await handler.fetch(readRequest('7&range=90'), env(db))).status, 400);
  assert.equal((await handler.fetch(request('/v1/events', {body:batch()}),
    env(db, {INGEST_LIMITER:{limit:async () => ({success:false})}}))).status, 429);
  assert.equal((await handler.fetch(request('/v1/events', {body:batch(), headers:{'CF-Connecting-IP':''}}), env(db))).status, 400);
  const failure = await handler.fetch(request('/v1/events', {body:batch()}),
    env({...db, batch:async () => {throw new Error('sensitive database state');}}));
  assert.equal(failure.status, 503); assert.deepEqual(await failure.json(), {error:'Analytics unavailable'});
});

test('rate keys are salted daily HMACs without the address and separate read/write namespaces', async t => {
  const {db} = database(t);
  let timestamp = NOW; const keys = [];
  const handler = createHandler({now:() => timestamp});
  const bindings = env(db, {INGEST_LIMITER:{limit:async ({key}) => { keys.push(key); return {success:true}; }}});
  await handler.fetch(request('/v1/events', {body:batch()}), bindings);
  await handler.fetch(readRequest(), bindings);
  timestamp += DAY;
  await handler.fetch(request('/v1/events', {body:batch()}), bindings);
  assert.equal(new Set(keys).size, 3);
  assert.ok(keys.every(key => /^[0-9a-f]{64}$/.test(key) && !key.includes('192.0.2.19')));
});

test('UTC range boundaries, empty report and retention preserve original collection start', async t => {
  const {db, sqlite} = database(t);
  const empty = await snapshot(db, 90, NOW);
  assert.deepEqual(empty.summary, {sessions:0, pageViews:0, outboundClicks:0, engagedSessions:0});
  assert.equal(empty.timeseries.length, 90);
  assert.equal(empty.collectionStartedAt, null);
  for (const name of ['sources','destinations','countries','devices','landingPages','actions']) assert.deepEqual(empty[name], []);
  await ingest(db, validatePayload(batch()), 'FR', NOW - 100 * DAY);
  const first = (await snapshot(db, 7, NOW)).collectionStartedAt;
  const today = Math.floor(NOW / DAY) * DAY;
  await ingest(db, validatePayload(batch()), 'FR', today - 6 * DAY);
  await ingest(db, validatePayload(batch()), 'FR', today - 6 * DAY - 1);
  assert.equal((await snapshot(db, 7, NOW)).summary.sessions, 1);
  await prune(db, NOW);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM events').get().count, 2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 2);
  assert.equal((await snapshot(db, 90, NOW)).collectionStartedAt, first);
});

test('native-app fixtures match real SQLite report serialization for empty and populated data', async t => {
  const {db} = database(t);
  assert.deepEqual(await snapshot(db, 7, NOW), JSON.parse(readFileSync(new URL('./fixtures/empty-response.json', import.meta.url))));
  await ingest(db, validatePayload(batch([event(), event(), event('click', 'telegram'), event('action', 'scroll-50')])), 'ID', NOW);
  const music = [event(), event('click', 'contact-email'), event('action', 'section-music')].map(item => ({...item, page:'/en/'}));
  await ingest(db, validatePayload(batch(music, {source:'youtube', account:'music', device:'desktop'})), 'US', NOW + 1000);
  assert.deepEqual(await snapshot(db, 7, NOW + 1000), JSON.parse(readFileSync(new URL('./fixtures/populated-response.json', import.meta.url))));
});
