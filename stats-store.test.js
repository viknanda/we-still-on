import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createStatsStore, hourKey } from "./stats-store.js";
import { createStore } from "./hang-store.js";

describe("stats store", () => {
  it("buckets events by UTC hour and survives reopen", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wso-stats-"));
    const dbPath = path.join(dir, "stats.sqlite");
    let t = Date.parse("2026-09-07T21:10:00Z");
    const a = createStatsStore({ dbPath, now: () => t });
    a.recordCreated();
    a.recordTap();
    a.recordTap();
    a.recordActivated();
    assert.deepEqual(a.totals(), {
      hangsCreated: 1,
      hangsActivated: 1,
      taps: 2,
    });
    const series = a.series("2026-09-07T21", "2026-09-07T21");
    assert.equal(series.length, 1);
    assert.equal(series[0].hour, "2026-09-07T21");
    assert.equal(series[0].taps, 2);
    a.close();

    const b = createStatsStore({ dbPath, now: () => t });
    assert.deepEqual(b.totals(), {
      hangsCreated: 1,
      hangsActivated: 1,
      taps: 2,
    });
    b.close();
  });

  it("splits across hours", () => {
    let t = Date.parse("2026-09-07T21:50:00Z");
    const s = createStatsStore({ now: () => t });
    s.recordCreated();
    t = Date.parse("2026-09-07T22:05:00Z");
    s.recordCreated();
    s.recordTap();
    const series = s.series("2026-09-07T21", "2026-09-07T22");
    assert.equal(series.length, 2);
    assert.equal(series[0].hangsCreated, 1);
    assert.equal(series[1].hangsCreated, 1);
    assert.equal(series[1].taps, 1);
    s.close();
  });

  it("hourKey is UTC", () => {
    assert.equal(hourKey(Date.parse("2026-09-07T21:59:00Z")), "2026-09-07T21");
  });

  it("hang store records into stats store", () => {
    const stats = createStatsStore();
    const store = createStore({ stats });
    const hang = store.create();
    store.tap(hang.id, "Sam", "yes");
    store.tap(hang.id, "Alex", "late");
    assert.deepEqual(store.stats(), {
      hangsCreated: 1,
      hangsActivated: 1,
      taps: 2,
      hangsLive: 1,
    });
    stats.close();
  });
});
