# we-still-on

A hang is a live score: names under Yes / Late / Out, plus one optional hang line (where and what in a single line).

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
2. The hang page is: **your name**, one optional line (**what's the hang** — e.g. Luigi's, Friday dinner), then three fat rows: **Yes**, **Late**, **Out**. Each row is the word, a count, and names quiet underneath.
3. The hang line is where and what, together. It is optional. The first tap on this hang sets it, then it freezes. Nobody can edit it after that — not even the starter. There is no separate where field and no separate what field.
4. After this device has tapped, **Copy link** appears. That copies *this* hang’s URL — the thing you paste into the group chat. Under it, **Start yours** mints a brand-new hang. It never copies this one.
5. Everyone else opens the same URL. The hang line is already there and frozen. The name field is blank — type **your** name (placeholder **your name**), then tap. It is never filled in from the starter, a cookie, or anyone else. After you tap on this device, your name stays. Names show up quiet under the row they chose. Change your mind by tapping another row (same phone, same person).
6. The page does not end. Reopen the URL to watch who moved.

Two people named Mike stay two Mikes. Nobody is an admin.

## Two browsers on one machine

Identity is a cookie on this device. A second normal window in the same browser is still you.

To be a second person:

1. In browser A, start a hang, type a name, optionally the hang line, tap **Yes**. Hit **Copy link**.
2. Open that URL in a **private / incognito window**, or in a different browser.
3. The name field is empty (placeholder **your name**). Type another name. Tap **Late** or **Out**. You cannot change the hang line.
4. Both windows update on their own (they poll about every 700ms). No refresh.

**Start yours** in either window opens an empty hang with a new URL. The old hang keeps its own names and hang line.

## Tests

```bash
npm test
```
