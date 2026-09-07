const STATUSES = new Set(["yes", "late", "out"]);
const ID_BYTES = 9;
const NAME_MAX = 48;
const LINE_MAX = 64;
export const HANG_TTL_MS = 60 * 60 * 1000;

export function newHangId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(ID_BYTES))).toString(
    "base64url",
  );
}

export function isHangId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{12}$/.test(id);
}

export function cleanName(raw) {
  if (typeof raw !== "string") return "";
  const name = raw.trim();
  if (!name) return "";
  return name.slice(0, NAME_MAX);
}

export function cleanLine(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, LINE_MAX);
}

export function createStore(opts = {}) {
  const hangs = new Map();
  const ttlMs = opts.ttlMs ?? HANG_TTL_MS;
  const now = opts.now ?? (() => Date.now());
  const stats = opts.stats ?? null;
  const mem = {
    hangsCreated: 0,
    hangsActivated: 0,
    taps: 0,
  };

  function touch(hang) {
    hang.touchedAt = now();
  }

  function alive(id) {
    const hang = hangs.get(id);
    if (!hang) return null;
    if (now() - hang.touchedAt > ttlMs) {
      hangs.delete(id);
      return null;
    }
    return hang;
  }

  function sweep() {
    const t = now();
    for (const [id, hang] of hangs) {
      if (t - hang.touchedAt > ttlMs) hangs.delete(id);
    }
  }

  return {
    stats() {
      const totals = stats ? stats.totals() : { ...mem };
      return { ...totals, hangsLive: hangs.size };
    },

    sweep,

    create() {
      sweep();
      let id = newHangId();
      while (hangs.has(id)) id = newHangId();
      const hang = {
        id,
        people: [],
        line: "",
        frozen: false,
        touchedAt: now(),
      };
      hangs.set(id, hang);
      mem.hangsCreated += 1;
      stats?.recordCreated();
      return hang;
    },

    get(id) {
      return alive(id);
    },

    tap(id, rawName, rawStatus, rawLine) {
      const hang = alive(id);
      if (!hang) return { error: "gone" };
      const name = cleanName(rawName);
      if (!name) return { error: "name" };
      const status =
        typeof rawStatus === "string" ? rawStatus.toLowerCase() : "";
      if (!STATUSES.has(status)) return { error: "status" };

      if (!hang.frozen) {
        hang.line = cleanLine(rawLine);
        hang.frozen = true;
      }

      const before = hang.people.length;
      const existing = hang.people.find((p) => p.name === name);
      if (existing) {
        existing.status = status;
      } else {
        hang.people.push({ name, status });
      }

      mem.taps += 1;
      stats?.recordTap();
      if (before < 2 && hang.people.length >= 2) {
        mem.hangsActivated += 1;
        stats?.recordActivated();
      }
      touch(hang);
      return { hang };
    },

    view(id) {
      const hang = alive(id);
      if (!hang) return null;
      return {
        id: hang.id,
        line: hang.line,
        frozen: hang.frozen,
        people: hang.people.map(({ name, status }) => ({ name, status })),
      };
    },
  };
}
