# we-still-on

A hang is a live score: names under Yes / Late / Out.

This is local-only. Do not deploy it, do not put it on Vercel / Netlify / GitHub Pages, and do not tunnel it. One machine, a browser, a group chat paste of a localhost URL if you want — that’s it.

## Run locally

Needs Node 18+.

```bash
npm start
```

Then open [http://127.0.0.1:47261](http://127.0.0.1:47261) on your phone or laptop.

`npm start` serves the page and a tiny JSON API. Hangs live in memory. Restarting the server forgets them.

## How a hang works

1. First visit is almost blank. Tap **we still on**. That mints a new hang URL (`/h/……`) and puts you on it.
2. Type the name people actually use. Tap **Yes**, **Late**, or **Out**.
3. After this device has tapped, **Copy link** appears. That copies *this* hang’s URL — the thing you paste into the group chat. Under it, **Start yours** mints a brand-new hang. It never copies this one.
4. Everyone else opens the same URL, types a name, taps. Names show up under the button they chose. Change your mind by tapping another button (same phone, same person).
5. The page does not end. Reopen the URL to watch who moved.

Two people named Mike stay two Mikes. Nobody is an admin.

## Two browsers on one machine

Identity is a cookie on this device. A second normal window in the same browser is still you.

To be a second person:

1. In browser A, start a hang, type a name, tap **Yes**. Hit **Copy link**.
2. Open that URL in a **private / incognito window**, or in a different browser.
3. Type another name. Tap **Late** or **Out**.
4. Both windows update on their own (they poll about every 700ms). No refresh.

**Start yours** in either window opens an empty hang with a new URL. The old hang keeps its own names.

## Tests

```bash
npm test
```
