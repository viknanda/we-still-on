# we-still-on

A hang is a live score: names under Yes / Late / Out, plus one optional hang line.

## Front door (give this to Joey)

**https://temporary-rapid-spruce-8a01c5z.vercel.app**

Two phones open that URL. The first tap on a hang freezes the hang line; Copy link pastes that hang into the group chat.

This deploy is a Vercel anonymous/claimable production URL. **It expires about 60 minutes after deploy unless the owner claims it.** Claim it (keeps the project on your Vercel account, no GitHub):

**https://vercel.com/claim-deployment?code=27c27530-851a-49cd-97bf-55289ba1787f**

After you claim it, the same `*.vercel.app` host should stay up. Origin+Vercel git (repo Apps tab) is not connected from this agent — this was a direct Vercel deploy, not a GitHub mirror.

## Privacy

- No accounts. No ads. No analytics pixels. Names are not sent to third-party APIs by this app.
- The process does not log names, hang lines, device ids, or request bodies.
- A hang is only in memory: names, status, hang line, random device cookie. **48 hours after the last tap, that hang is gone.**
- The device cookie is a random id so a retap moves you. Not a user record. Max-Age matches the hang TTL (48 hours, refreshed while you use the site).
- Mint counter: one integer, incremented when someone hits **we still on?** or **Start yours** (`POST /api/hangs`). Not shown on the hang. `GET /internal/mints` returns `{"mints":N}` and is not linked from the UI.

Vercel as a host may still see HTTPS request metadata. This app does not write those fields down.

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
