import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOUR_RE = /^\d{4}-\d{2}-\d{2}T\d{2}$/;
const DEFAULT_KEEP_HOURS = 24 * 90;
const MS_PER_HOUR = 60 * 60 * 1000;

export function hourKey(ms = Date.now()) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}`;
}

function scrubHangPii(db) {
  db.exec(`DROP TABLE IF EXISTS hangs;`);
  try {
    db.exec(`PRAGMA wal_checkpoint(TRUNCATE);`);
  } catch {
    /* :memory: or no WAL */
  }
  try {
    db.exec(`VACUUM;`);
  } catch {
    /* ignore */
  }
}

function ensureHourlySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hourly (
      hour TEXT PRIMARY KEY,
      hangs_created INTEGER NOT NULL DEFAULT 0,
      hangs_activated INTEGER NOT NULL DEFAULT 0,
      taps INTEGER NOT NULL DEFAULT 0,
      hangs_expired INTEGER NOT NULL DEFAULT 0
    );
  `);
  const cols = db.prepare(`PRAGMA table_info(hourly)`).all();
  if (!cols.some((c) => c.name === "hangs_expired")) {
    db.exec(
      `ALTER TABLE hourly ADD COLUMN hangs_expired INTEGER NOT NULL DEFAULT 0`,
    );
  }
}

export function createStatsStore(opts = {}) {
  const dbPath = opts.dbPath ?? ":memory:";
  const now = opts.now ?? (() => Date.now());
  const keepHours = opts.keepHours ?? DEFAULT_KEEP_HOURS;

  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode = WAL;`);
  scrubHangPii(db);
  ensureHourlySchema(db);

  const bump = db.prepare(`
    INSERT INTO hourly (hour, hangs_created, hangs_activated, taps, hangs_expired)
    VALUES (@hour, @created, @activated, @taps, @expired)
    ON CONFLICT(hour) DO UPDATE SET
      hangs_created = hangs_created + @created,
      hangs_activated = hangs_activated + @activated,
      taps = taps + @taps,
      hangs_expired = hangs_expired + @expired
  `);

  const sumStmt = db.prepare(`
    SELECT
      COALESCE(SUM(hangs_created), 0) AS hangsCreated,
      COALESCE(SUM(hangs_activated), 0) AS hangsActivated,
      COALESCE(SUM(taps), 0) AS taps,
      COALESCE(SUM(hangs_expired), 0) AS hangsExpired
    FROM hourly
  `);

  const seriesStmt = db.prepare(`
    SELECT hour, hangs_created AS hangsCreated,
           hangs_activated AS hangsActivated, taps,
           hangs_expired AS hangsExpired
    FROM hourly
    WHERE hour >= ? AND hour <= ?
    ORDER BY hour ASC
  `);

  const pruneStmt = db.prepare(`DELETE FROM hourly WHERE hour < ?`);

  let writes = 0;

  function prune() {
    const cutoffMs = now() - keepHours * MS_PER_HOUR;
    pruneStmt.run(hourKey(cutoffMs));
  }

  function record({
    created = 0,
    activated = 0,
    taps = 0,
    expired = 0,
  } = {}) {
    if (!created && !activated && !taps && !expired) return;
    bump.run({
      hour: hourKey(now()),
      created,
      activated,
      taps,
      expired,
    });
    writes += 1;
    if (writes % 25 === 0) prune();
  }

  return {
    recordCreated() {
      record({ created: 1 });
    },
    recordTap() {
      record({ taps: 1 });
    },
    recordActivated() {
      record({ activated: 1 });
    },
    recordExpired() {
      record({ expired: 1 });
    },
    totals() {
      const row = sumStmt.get();
      return {
        hangsCreated: Number(row.hangsCreated),
        hangsActivated: Number(row.hangsActivated),
        taps: Number(row.taps),
        hangsExpired: Number(row.hangsExpired),
      };
    },
    series(fromHour, toHour) {
      const from = fromHour && HOUR_RE.test(fromHour) ? fromHour : hourKey(0);
      const to =
        toHour && HOUR_RE.test(toHour) ? toHour : hourKey(now());
      return seriesStmt.all(from, to).map((r) => ({
        hour: r.hour,
        hangsCreated: Number(r.hangsCreated),
        hangsActivated: Number(r.hangsActivated),
        taps: Number(r.taps),
        hangsExpired: Number(r.hangsExpired),
      }));
    },
    /** Last N UTC hours, zero-filled; public-safe fields only. */
    pulse(hours = 48) {
      const n = Math.max(1, Math.min(168, Number(hours) || 48));
      const end = now();
      const from = hourKey(end - (n - 1) * MS_PER_HOUR);
      const to = hourKey(end);
      const byHour = new Map(
        seriesStmt.all(from, to).map((r) => [
          r.hour,
          {
            created: Number(r.hangsCreated),
            expired: Number(r.hangsExpired),
          },
        ]),
      );
      const series = [];
      for (let i = n - 1; i >= 0; i--) {
        const hour = hourKey(end - i * MS_PER_HOUR);
        const row = byHour.get(hour);
        series.push({
          hour,
          created: row?.created ?? 0,
          expired: row?.expired ?? 0,
        });
      }
      return series;
    },
    prune,
    close() {
      db.close();
    },
  };
}
