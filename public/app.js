const land = document.getElementById("land");
const hangEl = document.getElementById("hang");
const goneEl = document.getElementById("gone");
const nameEl = document.getElementById("name");
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
let busy = false;

function show(el) {
  land.hidden = el !== land;
  hangEl.hidden = el !== hangEl;
  goneEl.hidden = el !== goneEl;
}

function flash(msg) {
  err.textContent = msg;
  err.hidden = !msg;
  if (msg) setTimeout(() => {
    if (err.textContent === msg) err.hidden = true;
  }, 2200);
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

function paint(view) {
  const signed = Boolean(view.you);
  after.hidden = !signed;
  if (view.you?.name && nameEl.value === "") {
    nameEl.value = view.you.name;
  }

  const hasAnyone = view.people.length > 0;
  for (const status of ["yes", "late", "out"]) {
    const btn = document.querySelector(`.choice[data-status="${status}"]`);
    const list = document.querySelector(`.names[data-status="${status}"]`);
    btn.classList.toggle("mine", view.you?.status === status);
    list.replaceChildren();
    const names = view.people.filter((p) => p.status === status);
    if (!hasAnyone || names.length === 0) {
      list.hidden = true;
      continue;
    }
    for (const person of names) {
      const li = document.createElement("li");
      li.textContent = person.name;
      list.appendChild(li);
    }
    list.hidden = false;
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
      body: JSON.stringify({ name, status }),
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

for (const btn of document.querySelectorAll(".choice")) {
  btn.addEventListener("click", () => tap(btn.dataset.status));
}

nameEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    nameEl.blur();
  }
});

if (!hangId) {
  show(land);
} else {
  show(hangEl);
  pull().catch(() => flash("couldn’t load"));
  pollTimer = setInterval(() => {
    pull().catch(() => {});
  }, 700);
}
