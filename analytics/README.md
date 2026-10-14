# WENSDAY analytics service

An independent Cloudflare Worker and D1 database receive a small anonymous event batch from the GitHub Pages website. The owner's 67 Control app reads aggregates through a separate bearer-protected route. This does not provide access to social accounts or the website repository. No account credentials, IP addresses, full user agents, full referrers, or arbitrary URLs are written to D1.

The collector was deployed on 2026-10-14 at `https://wensday-analytics.zendard78.workers.dev`, with a dedicated `wensday-analytics` D1 database and the daily retention cron. The live access checks confirmed `401` without the read key or with an incorrect key, `403` for a foreign browser origin, the trusted site's `204` preflight, and a private `200` aggregate report without browser CORS access. No synthetic visits were inserted. The WENSDAY connection in 67 Control stores its read key in macOS Keychain. The public site configuration contains only the ingestion URL. Nothing here enables a paid Cloudflare plan.

## Setup

Use Wrangler 4.36 or newer. Authenticate with `wrangler whoami` before making changes and confirm the configured account. The database is already provisioned in `wrangler.json`; reuse it rather than creating a second copy. Apply future migrations with Wrangler. The configured rate limiter namespace `671410` belongs to this collector and must remain unique within the account.

Wrangler 4.150 requires both `workers:write` and `workers_scripts:write` for deployment and the existing workers.dev subdomain, plus `d1:write`, `account:read` and `user:read`. The login uses `--use-keyring`; Cloudflare credentials are encrypted locally with their encryption key in macOS Keychain. Do not broaden to Wrangler's full default scope set. No Cloudflare administrative credential belongs in this repository or in 67 Control.

Set two independently generated random secrets of at least 32 characters through Wrangler secret input:

- `READ_TOKEN`: the native app's read credential. Store the same value in macOS Keychain. Never put it in the site, repository, URL, screenshots, or command arguments.
- `RATE_SALT`: server-only HMAC key for transient daily rate-limit keys. Never publish it or reuse `READ_TOKEN`.

Run `node --test analytics/worker.test.mjs` from the repository root (Node 24 with built-in SQLite), then validate a Wrangler dry run. Deploy only after actual account authorization. Confirm a private report rejects a missing/wrong token, returns an empty report with the correct token, and emits no CORS allow header. Use a separate local database for synthetic event tests; do not seed production with test visits. Enable the site's endpoint only after those checks.

The site's origin is hardcoded to `https://weensdaay.github.io`; a custom domain needs an explicit code/config change on both sides. Local tests send this origin against an in-memory database. There is no production bypass for localhost or missing security bindings. For `wrangler dev`, use development secrets and the trusted local `CF-Connecting-IP` test header; never route production events into a development database.

## Public write contract

`POST /v1/events`, `Content-Type: application/json`, exact allowed Origin; no cookies or authentication. Maximum 12,288 bytes streamed and 16 events. Unknown fields invalidate the whole batch so accidental personal data is never silently retained.

```json
{
  "sessionId": "21a5ca2c-74fa-44bd-8ce9-4943651dc9f8",
  "source": "instagram",
  "account": "life",
  "device": "mobile",
  "events": [
    {"id":"7ce013ca-e489-465e-a686-d9386801e607","type":"pageview","page":"/"},
    {"id":"629cdab2-c3cd-4578-9019-5d3e6faec289","type":"click","page":"/","target":"telegram"}
  ]
}
```

`sessionId` and event IDs are random UUID v4 values, unrelated to account identities. The client rotates its session after 30 minutes of inactivity or four hours total. The server refuses further events for a session inactive longer than 30 minutes or created more than four hours ago. A session is a visit, **not a unique person**; different tabs/devices or cleared storage can produce more visits. Client timestamps are not accepted. D1 records server receive time in UTC and the first request's edge country. A missing/invalid country becomes `XX`.

Allowed pages: `/`, `/en/`. Device classes: `mobile`, `tablet`, `desktop`, `unknown`. Sources: `instagram`, `tiktok`, `youtube`, `telegram`, `google`, `yandex`, `other`, `direct`. Allowed account/source pairs:

- `source: "instagram"`: `account: "life"` or `"science"`.
- `source: "tiktok"`: `account: "life"` or `"science"`.
- `source: "youtube"`: `account: "life"`, `"science"`, `"archive"`, or `"music"`.
- `source: "telegram"`: `account: "main"`.
- Every source can have `account: null` when the specific account is unknown.

Referrers usually identify only a platform and are often absent. Distinguishing particular Instagram/TikTok profiles requires separate tagged website links; it cannot be reconstructed from untagged historical visits. First accepted attribution, country and device are immutable for the session. No cookies, fingerprinting, IP-based people counting or inferred demographics are used.

Events: `pageview` has no `target`; `click` uses a destination ID from `catalog.json`; `action` uses one of `section-science`, `section-life`, `section-music`, `section-projects`, `section-stats`, `language-ru`, `language-en`, `gallery-next`, `gallery-previous`, `links-scroll`, `copy-email`, `scroll-25`, `scroll-50`, `scroll-75`, `scroll-100`. The catalog's fixed labels are used in reports; supplied event text/HTML/URLs are never accepted. The parent website build generates `catalog.json` from public links.

Successful and intentionally ignored writes return `204`; malformed input returns `400/413/415`, disallowed origins `403`, rate limits `429`, missing configuration/database failures `503`. DNT, GPC and known crawlers are ignored before collection. A whole D1 transaction deduplicates event IDs, including retries under another session ID. Each session accepts at most 256 events. Edge rate limiting uses a daily salted HMAC of the connecting address, held only in the rate limiter; the address and its HMAC never enter D1 or application logs. Limits are per Cloudflare location, not an exact global quota.

## Private read contract

`GET /api/control/v1/projects/wensday/analytics?range=7|30|90`

`Authorization: Bearer <READ_TOKEN>` is required. Missing or wrong credentials return `401`. Missing bindings/secrets return `503`. The service uses SHA-256 digests and Workers' native constant-time comparison. No cookies, token query parameter or browser CORS access is supported. Every response is `Cache-Control: no-store`.

Required response fields:

```text
project: "wensday"
schemaVersion: 1
generatedAt: ISO 8601 UTC timestamp
collectionStartedAt: ISO 8601 UTC timestamp | null
summary: {sessions, pageViews, outboundClicks, engagedSessions}
timeseries: [{date:"YYYY-MM-DD", sessions, pageViews, outboundClicks}]
sources: [{source, account:string|null, name, sessions}]
destinations: [{id, name, clicks}]
countries: [{code, sessions}]
devices: [{name, sessions}]
landingPages: [{path, views}]
actions: [{name, events}]
```

All counts are nonnegative integers. Every array is present even when empty. `actions.name` is the stable action ID (for example `section-music` or `scroll-50`), localized in the native app. `fixtures/empty-response.json` and `fixtures/populated-response.json` are **test fixtures only**, never production data fallbacks; both are checked against actual SQLite report output. Each range includes the current partial UTC day and the preceding 6/29/89 days. Timeseries includes zero rows for empty days. Sessions, sources, devices, countries and landing pages count visits **starting** in the range. `landingPages.views` counts first entries, not all reloads. Page views, destination clicks and actions count events received during the range. Engaged sessions are visits starting in the range with an outbound click, at least two page views, or scrolling to 50%/75%/100% in that range. This is an explicit interaction measure, not time-on-site.

Historical traffic before deployment cannot be recovered. `collectionStartedAt` records the first accepted event and is retained independently of the daily cleanup. The 04:17 UTC cron removes events before the oldest included day of the last 90 UTC days and removes inactive, empty old sessions. Provider disaster-recovery backups can have their own retention policy; application deletion is not a claim that such backups are instantly erased.

## Security and limitations

No public database read, HTML upload, administrative operation, site-content mutation, login, form submission or arbitrary SQL exists. Every query is prepared and bound. Origin/CORS checks protect browser use, but **they do not prove that an event came from a human**: non-browser callers can spoof Origin and random session IDs. Rate limits and caps reduce abuse; these figures are operational analytics, not independently certified advertising measurements. Ad blockers, tracking preferences, network failures, app referrer stripping, VPNs and bots can affect completeness, source and country accuracy.

The Worker never logs requests or exceptions; Workers observability is disabled. Cloudflare still necessarily processes connection addresses as the hosting provider. No social-platform access token or Cloudflare administrative key belongs in the website or native app. The app's dedicated read token cannot modify data or site contents; it can read only these aggregates. Rotate it if exposed. A public write endpoint cannot be made tamper-proof without authenticating visitors, which this site deliberately does not do.

Implementation references: [D1 transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), [rate-limit binding and its scope](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [native constant-time secret comparison](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/#timingsafeequal).
