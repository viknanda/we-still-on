const STATUSES = new Set(["yes", "late", "out"]);
const ID_BYTES = 6;
const NAME_MAX = 48;
const LINE_MAX = 64;

export function newHangId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(ID_BYTES))).toString(
    "base64url",
  );
}

export function isHangId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{8}$/.test(id);
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

export function createStore() {
  const hangs = new Map();

  return {
    create() {
      let id = newHangId();
      while (hangs.has(id)) id = newHangId();
      hangs.set(id, { id, people: [], line: "", frozen: false });
      return hangs.get(id);
    },

    get(id) {
      return hangs.get(id) ?? null;
    },

    tap(id, deviceId, rawName, rawStatus, rawLine) {
      const hang = hangs.get(id);
      if (!hang) return { error: "gone" };
      if (typeof deviceId !== "string" || !deviceId) {
        return { error: "who" };
      }
      const name = cleanName(rawName);
      if (!name) return { error: "name" };
      const status = typeof rawStatus === "string" ? rawStatus.toLowerCase() : "";
      if (!STATUSES.has(status)) return { error: "status" };

      if (!hang.frozen) {
        hang.line = cleanLine(rawLine);
        hang.frozen = true;
      }

      const existing = hang.people.find((p) => p.deviceId === deviceId);
      if (existing) {
        existing.name = name;
        existing.status = status;
      } else {
        hang.people.push({ deviceId, name, status });
      }
      return { hang };
    },

    view(id, deviceId) {
      const hang = hangs.get(id);
      if (!hang) return null;
      const you = hang.people.find((p) => p.deviceId === deviceId) ?? null;
      return {
        id: hang.id,
        line: hang.line,
        frozen: hang.frozen,
        people: hang.people.map(({ name, status }) => ({ name, status })),
        you: you ? { name: you.name, status: you.status } : null,
      };
    },
  };
}
