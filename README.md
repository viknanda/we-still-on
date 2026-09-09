# we-still-on

A hang is a live score: names under Yes / Late / Out, plus one optional hang line.

No accounts. No cookies. No client IDs. Identity is the name you type on that hang. Hangs live in **server memory** and expire **1h or 24h after the last activity** (create, tap, or TTL change).

## Run locally

Needs Node 22+.

```bash
npm start
```

Open [http://127.0.0.1:47261](http://127.0.0.1:47261).

Local stats DB defaults to `./data/stats.sqlite` (gitignored).

## How a hang works

1. Tap **we still on?** → new hang URL (`/h/……`).
2. Type **your name**, optional **what's the hang**, tap **Yes** / **Late** / **Out**.
3. First tap freezes the hang line. Same name retap moves you. Same spelling = same person.
4. **Copy link** (or share sheet) → paste in the group chat. **Start yours** mints a new hang.
5. Pick **1h** or **24h** idle lifetime (locks once two people are on). Hangs go **gone** after that idle window.

## Privacy & stats

- No cookies, localStorage, or device IDs
- Hang payloads (names, hang line, hang id) live **only in process memory** — shared across everyone on that hang URL, wiped on idle TTL or process restart
- SQLite on disk holds **aggregate counters only** (UTC hourly buckets, 90-day retention): created, activated (2+ people), taps, expired — never names, lines, or hang ids
- On boot the server **drops any legacy `hangs` table** and vacuums so prior hang PII is removed from the live DB file
- Public `GET /api/pulse` returns live count + recent created/expired hours (no key, no PII)
- Raw SQLite is not served over HTTP; host/volume access can read aggregate counters only

With `STATS_KEY` set:

```bash
# lifetime totals (+ live hang count)
curl "https://we-still-on.fly.dev/api/stats?key=$STATS_KEY"

# hourly timeseries
curl "https://we-still-on.fly.dev/api/stats/series?key=$STATS_KEY"
curl "https://we-still-on.fly.dev/api/stats/series?key=$STATS_KEY&from=2026-09-07T00&to=2026-09-07T23"
```

Public pulse (no key):

```bash
curl "https://we-still-on.fly.dev/api/pulse"
```

Optional local snapshot: `node scripts/harvest-stats.mjs` (uses `.wso-stats-key`).

## Deploy (Fly.io)

```bash
# one-time volume for durable stats
fly volumes create wso_data --region sjc --size 1 -a we-still-on

fly deploy --ha=false -a we-still-on
```

`fly.toml` mounts `wso_data` at `/data` → `STATS_DB=/data/stats.sqlite`. Keep **one** machine (`--ha=false`) so in-memory hangs stay consistent.

## Tests

```bash
npm test
```
