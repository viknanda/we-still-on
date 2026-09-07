# we-still-on

A hang is a live score: names under Yes / Late / Out, plus one optional hang line.

No accounts. No cookies. No client IDs. Identity is the name you type on that hang. Hangs expire **1 hour after the last tap**.

## Run locally

Needs Node 18+.

```bash
npm start
```

Open [http://127.0.0.1:47261](http://127.0.0.1:47261).

## How a hang works

1. Tap **we still on?** → new hang URL (`/h/……`).
2. Type **your name**, optional **what's the hang**, tap **Yes** / **Late** / **Out**.
3. First tap freezes the hang line. Same name retap moves you. Same spelling = same person.
4. **Copy link** (or share sheet) → paste in the group chat. **Start yours** mints a new hang.
5. Hangs go **gone** after an hour idle.

## Privacy

- No cookies, localStorage, or device IDs
- Hang data deleted after TTL
- Optional aggregate counters only (`STATS_KEY` → `GET /api/stats?key=…`): created, activated (2+ people), taps — never names

## Deploy (Railway)

No Fly needed. Sign up at [railway.app](https://railway.app) with GitHub (free trial credit).

1. Push this repo to GitHub (or create a new Railway project from local).
2. **New Project** → **Deploy from GitHub** → pick `we-still-on`  
   (or install CLI: `npm i -g @railway/cli` → `railway login` → `railway up`)
3. Railway detects the Dockerfile, assigns a public URL, HTTPS included.
4. Optional: set variable `STATS_KEY` to a random string for `GET /api/stats?key=…`

Keep the service **always on** while you launch — hangs live in memory on that one process.

### Other options
- **Render**: same Dockerfile; free tier sleeps and wipes hangs — use a paid instance or add Redis later.
- **Fly.io**: fine too if you create an account later (`fly deploy`).

## Tests

```bash
npm test
```
