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

const match = location.pathname.match(/^\/h\/([A-Za-z0-9_-]+)$/);
const hangId = match ? match[1] : null;

let pollTimer = 0;
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

function setTtlHours(hours, { locked = false } = {}) {
  ttlHours = hours === 24 ? 24 : 1;
  for (const btn of expireEl.querySelectorAll(".expire-opt")) {
    const on = Number(btn.dataset.hours) === ttlHours;
    btn.setAttribute("aria-checked", on ? "true" : "false");
  }
  expireEl.classList.toggle("is-locked", locked);
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
  if (view.ttlLocked) {
    setTtlHours(view.ttlHours ?? 1, { locked: true });
  } else {
    setTtlHours(ttlHours, { locked: false });
  }

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
  if (snap !== lastJson) {
    lastJson = snap;
    paint(view);
  } else if (lastView) {
    paint(lastView);
  }
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
    setTtlHours(Number(btn.dataset.hours));
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
