const land = document.getElementById("land");
const hangEl = document.getElementById("hang");
const goneEl = document.getElementById("gone");
const nameEl = document.getElementById("who");
const lineEl = document.getElementById("line");
const frozenEl = document.getElementById("frozen");
const expireEl = document.getElementById("expire");
const after = document.getElementById("after");
const err = document.getElementById("err");
const copyBtn = document.getElementById("copy");
const startBtn = document.getElementById("start");
const yoursBtn = document.getElementById("yours");
const againBtn = document.getElementById("again");
const pulseChart = document.getElementById("pulse-chart");
const pulseLive = document.getElementById("pulse-live");

const match = location.pathname.match(/^\/h\/([A-Za-z0-9_-]+)$/);
const hangId = match ? match[1] : null;

let pollTimer = 0;
let pulseTimer = 0;
let lastJson = "";
let lastView = null;
let busy = false;
let typedName = false;
let focusedName = false;
let ttlHours = 1;

function show(el) {
  land.hidden = el !== land;
  hangEl.hidden = el !== hangEl;
  goneEl.hidden = el !== goneEl;
  if (el === land) startPulse();
  else stopPulse();
}

function flash(msg) {
  err.textContent = msg;
  err.hidden = !msg;
  if (msg) {
    setTimeout(() => {
      if (err.textContent === msg) err.hidden = true;
    }, 2200);
  }
}

function myName() {
  return nameEl.value.trim();
}

function ttlEditable(view) {
  if (!view || view.ttlLocked) return false;
  if (view.people.length === 0) return true;
  if (view.people.length >= 2) return false;
  const mine = myName();
  return Boolean(mine && view.people[0].name === mine);
}

function setTtlHours(hours, { locked = false } = {}) {
  ttlHours = hours === 24 ? 24 : 1;
  for (const btn of expireEl.querySelectorAll(".expire-opt")) {
    const on = Number(btn.dataset.hours) === ttlHours;
    btn.setAttribute("aria-checked", on ? "true" : "false");
    if (locked) btn.setAttribute("aria-disabled", "true");
    else btn.removeAttribute("aria-disabled");
  }
  expireEl.classList.toggle("is-locked", locked);
}

function paintPulse(data) {
  if (!pulseChart || !pulseLive || !data?.series) return;
  pulseLive.textContent = `${Number(data.hangsLive) || 0} live`;
  const series = data.series;
  const w = 320;
  const h = 72;
  const mid = h / 2;
  const root = getComputedStyle(document.documentElement);
  const createdFill = root.getPropertyValue("--out").trim() || "#3a4a3c";
  const goneFill = root.getPropertyValue("--coral").trim() || "#ff4d2e";
  const max = Math.max(
    1,
    ...series.map((s) => Math.max(s.created || 0, s.expired || 0)),
  );
  const n = series.length || 1;
  const gap = w / n;
  const barW = Math.max(1.2, Math.min(4, gap * 0.45));
  const parts = [
    `<line x1="0" y1="${mid}" x2="${w}" y2="${mid}" stroke="rgba(14,14,14,0.22)" stroke-width="1" />`,
  ];
  series.forEach((s, i) => {
    const x = gap * i + gap / 2;
    const up = ((s.created || 0) / max) * (mid - 4);
    const down = ((s.expired || 0) / max) * (mid - 4);
    if (up > 0.5) {
      parts.push(
        `<rect x="${x - barW / 2}" y="${mid - up}" width="${barW}" height="${up}" fill="${createdFill}" />`,
      );
    }
    if (down > 0.5) {
      parts.push(
        `<rect x="${x - barW / 2}" y="${mid}" width="${barW}" height="${down}" fill="${goneFill}" />`,
      );
    }
  });
  pulseChart.setAttribute("viewBox", `0 0 ${w} ${h}`);
  pulseChart.innerHTML = parts.join("");
}

async function pullPulse() {
  try {
    const res = await fetch("/api/pulse", { cache: "no-store" });
    if (!res.ok) return;
    paintPulse(await res.json());
  } catch {
    /* ignore */
  }
}

function startPulse() {
  if (!pulseChart) return;
  pullPulse();
  clearInterval(pulseTimer);
  pulseTimer = setInterval(pullPulse, 20_000);
}

function stopPulse() {
  clearInterval(pulseTimer);
  pulseTimer = 0;
}

async function persistTtl(hours) {
  if (!hangId) return;
  try {
    const res = await fetch(`/api/hangs/${hangId}/ttl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttlHours: hours, name: nameEl.value }),
    });
    if (res.status === 404) {
      show(goneEl);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "locked") {
        await pull().catch(() => {
          if (lastView) paint(lastView);
        });
      }
      return;
    }
    const view = await res.json();
    lastJson = JSON.stringify(view);
    paint(view);
  } catch {
    /* poll will reconcile */
  }
}

async function createHang() {
  if (busy) return;
  busy = true;
  try {
    const res = await fetch("/api/hangs", { method: "POST" });
    if (!res.ok) throw new Error("nope");
    const data = await res.json();
    location.assign(`/h/${data.id}`);
  } catch {
    busy = false;
    flash("couldn’t start");
  }
}

async function copyLink() {
  const url = location.href;
  if (navigator.share) {
    try {
      await navigator.share({ url, title: "we still on?" });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const t = document.createElement("textarea");
    t.value = url;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
  copyBtn.textContent = "Copied";
  setTimeout(() => {
    copyBtn.textContent = "Copy link";
  }, 1400);
}

function paintLine(view) {
  if (view.frozen) {
    lineEl.hidden = true;
    frozenEl.hidden = false;
    frozenEl.textContent = view.line;
  } else {
    frozenEl.hidden = true;
    lineEl.hidden = false;
  }
}

function paint(view) {
  lastView = view;
  const mine = myName();
  const signed = Boolean(mine && view.people.some((p) => p.name === mine));
  after.hidden = !signed;

  if (!typedName && !mine) {
    if (!focusedName) {
      focusedName = true;
      queueMicrotask(() => nameEl.focus());
    }
  }

  paintLine(view);
  setTtlHours(view.ttlHours ?? 1, { locked: !ttlEditable(view) });

  const myStatus = mine
    ? view.people.find((p) => p.name === mine)?.status
    : null;

  for (const status of ["yes", "late", "out"]) {
    const row = document.querySelector(`.row[data-status="${status}"]`);
    const countEl = document.querySelector(`[data-count="${status}"]`);
    const list = document.querySelector(`.names[data-status="${status}"]`);
    const names = view.people.filter((p) => p.status === status);
    row.classList.toggle("mine", myStatus === status);
    countEl.textContent = String(names.length);
    const nextKey = names.map((p) => p.name).join("\0");
    if (list.dataset.key === nextKey) continue;
    list.dataset.key = nextKey;
    list.replaceChildren();
    for (const person of names) {
      const who = document.createElement("span");
      who.className = "who";
      who.textContent = person.name;
      list.appendChild(who);
    }
  }
}

async function pull() {
  const res = await fetch(`/api/hangs/${hangId}`, { cache: "no-store" });
  if (res.status === 404) {
    show(goneEl);
    clearInterval(pollTimer);
    return null;
  }
  if (!res.ok) throw new Error("nope");
  const view = await res.json();
  const snap = JSON.stringify(view);
  if (snap === lastJson) return view;
  lastJson = snap;
  paint(view);
  return view;
}

async function tap(status) {
  const name = nameEl.value;
  if (!name.trim()) {
    nameEl.classList.remove("need");
    void nameEl.offsetWidth;
    nameEl.classList.add("need");
    nameEl.focus();
    return;
  }
  if (busy) return;
  busy = true;
  try {
    const res = await fetch(`/api/hangs/${hangId}/tap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        status,
        line: lineEl.value,
        ttlHours,
      }),
    });
    if (res.status === 404) {
      show(goneEl);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "name") {
        nameEl.focus();
        return;
      }
      throw new Error("nope");
    }
    const view = await res.json();
    lastJson = JSON.stringify(view);
    paint(view);
    const row = document.querySelector(`.row[data-status="${status}"]`);
    if (row) {
      row.classList.remove("slam");
      void row.offsetWidth;
      row.classList.add("slam");
    }
  } catch {
    flash("couldn’t tap");
  } finally {
    busy = false;
  }
}

startBtn.addEventListener("click", createHang);
againBtn.addEventListener("click", createHang);
yoursBtn.addEventListener("click", createHang);
copyBtn.addEventListener("click", copyLink);

for (const row of document.querySelectorAll(".row")) {
  row.addEventListener("click", () => tap(row.dataset.status));
}

for (const btn of expireEl.querySelectorAll(".expire-opt")) {
  btn.addEventListener("click", () => {
    if (expireEl.classList.contains("is-locked")) return;
    const hours = Number(btn.dataset.hours);
    setTtlHours(hours);
    persistTtl(hours);
  });
}

function blurOnEnter(el) {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el.blur();
    }
  });
}

nameEl.addEventListener("input", () => {
  typedName = nameEl.value.length > 0;
  if (lastView) paint(lastView);
});

nameEl.addEventListener("focus", () => {
  if (!typedName && after.hidden) nameEl.value = "";
});

blurOnEnter(nameEl);
blurOnEnter(lineEl);

if (!hangId) {
  show(land);
} else {
  show(hangEl);
  setTtlHours(1);
  pull().catch(() => flash("couldn’t load"));
  pollTimer = setInterval(() => {
    pull().catch(() => {});
  }, 2000);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

const helpBtn = document.getElementById("help");
const demoEl = document.getElementById("demo");
const demoScrim = document.getElementById("demo-scrim");
const demoClose = document.getElementById("demo-close");
const demoStage = document.getElementById("demo-stage");
const demoCaption = document.getElementById("demo-caption");
const demoName = document.getElementById("demo-name");
const demoLine = document.getElementById("demo-line");
const demoCopy = document.getElementById("demo-copy");
const demoYes = document.getElementById("demo-yes");
const demoLate = document.getElementById("demo-late");
const demoOut = document.getElementById("demo-out");
const demoYesN = document.getElementById("demo-yes-n");
const demoLateN = document.getElementById("demo-late-n");
const demoOutN = document.getElementById("demo-out-n");

let demoTimers = [];
let demoOpen = false;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  .matches;

function clearDemoTimers() {
  for (const id of demoTimers) clearTimeout(id);
  demoTimers = [];
}

function demoWait(ms) {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    demoTimers.push(id);
  });
}

function setBeat(beat, caption) {
  if (!demoStage) return;
  demoStage.dataset.beat = beat;
  if (demoCaption && caption != null) demoCaption.textContent = caption;
}

function setDemoNames(target, names) {
  target.replaceChildren();
  for (const name of names) {
    const who = document.createElement("span");
    who.className = "demo-who";
    who.textContent = name;
    target.appendChild(who);
  }
}

function paintDemoLanes({ yes = [], late = [], out = [], mine = null } = {}) {
  setDemoNames(demoYes, yes);
  setDemoNames(demoLate, late);
  setDemoNames(demoOut, out);
  demoYesN.textContent = String(yes.length);
  demoLateN.textContent = String(late.length);
  demoOutN.textContent = String(out.length);
  for (const row of demoStage.querySelectorAll(".demo-row")) {
    const on = row.dataset.status === mine;
    row.classList.toggle("is-mine", on);
  }
}

function slamDemo(status) {
  const row = demoStage.querySelector(`.demo-row[data-status="${status}"]`);
  if (!row) return;
  row.classList.remove("is-slam");
  void row.offsetWidth;
  row.classList.add("is-slam");
}

async function typeDemo(el, text, msPer = 70) {
  el.textContent = "";
  for (let i = 1; i <= text.length; i++) {
    if (!demoOpen) return;
    el.textContent = text.slice(0, i);
    await demoWait(msPer);
  }
}

function resetDemo() {
  setBeat("land", "tap to start a hang");
  demoName.textContent = "";
  demoLine.textContent = "";
  demoCopy.textContent = "Copy link";
  paintDemoLanes();
  for (const row of demoStage.querySelectorAll(".demo-row")) {
    row.classList.remove("is-slam", "is-mine");
  }
}

async function runDemoLoop() {
  while (demoOpen) {
    resetDemo();
    if (reduceMotion) {
      setBeat("share", "share the link — friends tap Yes / Late / Out");
      demoName.textContent = "Maya";
      demoLine.textContent = "matcha walk";
      paintDemoLanes({
        yes: ["Maya", "Sam"],
        late: ["Jordan"],
        out: [],
        mine: "yes",
      });
      demoCopy.textContent = "Copy link";
      await demoWait(4000);
      continue;
    }

    await demoWait(900);
    if (!demoOpen) break;

    setBeat("hang", "type your name");
    await demoWait(280);
    await typeDemo(demoName, "Maya", 85);
    if (!demoOpen) break;

    setBeat("hang", "optional: what's the hang");
    await typeDemo(demoLine, "matcha walk", 55);
    if (!demoOpen) break;

    await demoWait(350);
    setBeat("tap", "tap Yes / Late / Out");
    paintDemoLanes({ yes: ["Maya"], late: [], out: [], mine: "yes" });
    slamDemo("yes");
    await demoWait(900);
    if (!demoOpen) break;

    setBeat("fill", "friends land on the same link");
    paintDemoLanes({
      yes: ["Maya"],
      late: ["Jordan"],
      out: [],
      mine: "yes",
    });
    await demoWait(700);
    if (!demoOpen) break;

    paintDemoLanes({
      yes: ["Maya", "Sam"],
      late: ["Jordan"],
      out: [],
      mine: "yes",
    });
    await demoWait(1100);
    if (!demoOpen) break;

    setBeat("share", "share the link");
    demoCopy.textContent = "Copy link";
    await demoWait(1600);
    if (!demoOpen) break;

    demoCopy.textContent = "Copied";
    setBeat("done", "that's it");
    await demoWait(1400);
    if (!demoOpen) break;

    await demoWait(500);
  }
}

function openDemo() {
  if (!demoEl || demoOpen) return;
  demoOpen = true;
  demoEl.hidden = false;
  helpBtn?.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  demoClose?.focus();
  clearDemoTimers();
  runDemoLoop();
}

function closeDemo() {
  if (!demoEl || !demoOpen) return;
  demoOpen = false;
  clearDemoTimers();
  demoEl.hidden = true;
  helpBtn?.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
  helpBtn?.focus();
  resetDemo();
}

helpBtn?.addEventListener("click", () => {
  if (demoOpen) closeDemo();
  else openDemo();
});
demoScrim?.addEventListener("click", closeDemo);
demoClose?.addEventListener("click", closeDemo);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && demoOpen) closeDemo();
});
