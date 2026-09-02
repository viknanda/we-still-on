# we-still-on

A hang is a live score: names under Yes / Late / Out, plus one optional hang line.

There is **no public front door yet**. Vercel serverless was tried and **failed**: a second phone hitting `/h/…` got "gone" because each request can be a new isolate and the in-memory map dies. Do not use that Vercel URL.

A hang must live in **one always-on Node process** (Fly.io one machine). Deploy needs a Fly token this agent does not have. Add `FLY_API_TOKEN` (from `fly tokens create` or the Fly dashboard) and ask again — then we ship `https://we-still-on.fly.dev` (or the name Fly assigns) and prove two cookies share one hang.

```bash
fly deploy --ha=false
```

`fly.toml` pins one machine, no autostop. `Dockerfile` runs `node server.js` on port 8080.

## Privacy

- No accounts. No ads. No analytics pixels. Names are not sent to third-party APIs by this app.
- The process does not log names, hang lines, device ids, or request bodies.
- A hang is only in memory: names, status, hang line, random device cookie. **48 hours after the last tap, that hang is gone.**
- The device cookie is a random id so a retap moves you. Not a user record. Max-Age matches the hang TTL.
- Mint counter: one integer on `POST /api/hangs`. `GET /internal/mints` returns `{"mints":N}` and is not linked from the UI.

## How a hang works

1. First visit is almost blank. Tap **we still on?** That mints a new hang URL (`/h/……`).
2. Hang page: **your name**, one optional **what's the hang** line, three full-bleed rows (Yes / Late / Out) with hairlines. System sans. No webfont.
3. First tap freezes the hang line. Nobody can edit it after that.
4. After this device taps: **Copy link** (this hang) and **Start yours** (a brand-new hang).
5. A shared link: frozen hang line, blank **your name**. Type yours, tap.

## Run locally

```bash
npm start
```

Then open [http://127.0.0.1:47261](http://127.0.0.1:47261).

```bash
npm test
```
