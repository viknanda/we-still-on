const STATUSES = new Set(["yes", "late", "out"]);
const ID_BYTES = 9;
const NAME_MAX = 48;
const LINE_MAX = 64;
export const HANG_TTL_MS = 60 * 60 * 1000;
export const TTL_HOURS = new Set([1, 24]);

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

export function cleanTtlHours(raw) {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (TTL_HOURS.has(n)) return n;
  return 1;
}

export function createStore(opts = {}) {
  const hangs = new Map();
  const now = opts.now ?? (() => Date.now());
  const stats = opts.stats ?? null;
  const mem = {
    hangsCreated: 0,
    hangsActivated: 0,
    taps: 0,
    hangsExpired: 0,
  };

  function ttlMs(hang) {
    return (hang.ttlHours || 1) * HANG_TTL_MS;
  }

  function touch(hang) {
    hang.touchedAt = now();
  }

  function expire(id) {
    if (!hangs.delete(id)) return false;
    mem.hangsExpired += 1;
    stats?.recordExpired();
    return true;
  }

  function alive(id) {
    const hang = hangs.get(id);
    if (!hang) return null;
    if (now() - hang.touchedAt > ttlMs(hang)) {
      expire(id);
      return null;
    }
    return hang;
  }

  function sweep() {
    const t = now();
    for (const [id, hang] of hangs) {
      if (t - hang.touchedAt > ttlMs(hang)) expire(id);
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
        ttlHours: 1,
        ttlLocked: false,
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

    tap(id, rawName, rawStatus, rawLine, rawTtlHours) {
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
      const isNew = !existing;
      if (isNew && hang.people.length >= 1) {
        hang.ttlLocked = true;
      } else if (!hang.ttlLocked) {
        hang.ttlHours = cleanTtlHours(rawTtlHours);
      }

      if (existing) {
        existing.status = status;
      } else {
        hang.people.push({ name, status });
      }
      if (hang.people.length >= 2) hang.ttlLocked = true;

      mem.taps += 1;
      stats?.recordTap();
      if (before < 2 && hang.people.length >= 2) {
        mem.hangsActivated += 1;
        stats?.recordActivated();
      }
      touch(hang);
      return { hang };
    },

    setTtl(id, rawTtlHours, rawName) {
      const hang = alive(id);
      if (!hang) return { error: "gone" };
      if (hang.people.length >= 2) hang.ttlLocked = true;
      if (hang.ttlLocked) return { error: "locked" };
      // Empty hang: anyone may set duration. Solo hang: only that person.
      if (hang.people.length === 1) {
        const name = cleanName(rawName);
        if (!name || hang.people[0].name !== name) return { error: "locked" };
      }
      hang.ttlHours = cleanTtlHours(rawTtlHours);
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
        ttlHours: hang.ttlHours,
        ttlLocked: hang.ttlLocked,
        people: hang.people.map(({ name, status }) => ({ name, status })),
      };
    },
  };
}
