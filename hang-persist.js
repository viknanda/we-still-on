import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function createHangPersist(dbPath) {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS hangs (
      id TEXT PRIMARY KEY,
      line TEXT NOT NULL DEFAULT '',
      frozen INTEGER NOT NULL DEFAULT 0,
      ttl_hours INTEGER NOT NULL DEFAULT 1,
      ttl_locked INTEGER NOT NULL DEFAULT 0,
      touched_at INTEGER NOT NULL,
      people_json TEXT NOT NULL DEFAULT '[]'
    );
  `);

  const upsert = db.prepare(`
    INSERT INTO hangs (id, line, frozen, ttl_hours, ttl_locked, touched_at, people_json)
    VALUES (@id, @line, @frozen, @ttl_hours, @ttl_locked, @touched_at, @people_json)
    ON CONFLICT(id) DO UPDATE SET
      line = excluded.line,
      frozen = excluded.frozen,
      ttl_hours = excluded.ttl_hours,
      ttl_locked = excluded.ttl_locked,
      touched_at = excluded.touched_at,
      people_json = excluded.people_json
  `);
  const del = db.prepare(`DELETE FROM hangs WHERE id = ?`);
  const all = db.prepare(`SELECT * FROM hangs`);

  return {
    save(hang) {
      upsert.run({
        id: hang.id,
        line: hang.line ?? "",
        frozen: hang.frozen ? 1 : 0,
        ttl_hours: hang.ttlHours ?? 1,
        ttl_locked: hang.ttlLocked ? 1 : 0,
        touched_at: hang.touchedAt,
        people_json: JSON.stringify(hang.people ?? []),
      });
    },
    remove(id) {
      del.run(id);
    },
    loadAll() {
      return all.all().map((row) => ({
        id: row.id,
        line: row.line,
        frozen: Boolean(row.frozen),
        ttlHours: Number(row.ttl_hours) === 24 ? 24 : 1,
        ttlLocked: Boolean(row.ttl_locked),
        touchedAt: Number(row.touched_at),
        people: JSON.parse(row.people_json || "[]"),
      }));
    },
  };
}
