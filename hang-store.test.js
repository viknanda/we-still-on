import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HANG_TTL_MS,
  cleanLine,
  cleanName,
  createStore,
  isHangId,
  newHangId,
} from "./hang-store.js";

describe("ids", () => {
  it("mints short unguessable ids", () => {
    const id = newHangId();
    assert.equal(id.length, 12);
    assert.equal(isHangId(id), true);
    assert.equal(isHangId("abc"), false);
    assert.equal(isHangId("abcdefgh"), false);
  });
});

describe("names", () => {
  it("keeps what people typed", () => {
    assert.equal(cleanName("  Mike  "), "Mike");
    assert.equal(cleanName("mike"), "mike");
  });
});

describe("store", () => {
  it("start yours is a new hang, not a copy", () => {
    const store = createStore();
    const a = store.create();
    store.tap(a.id, "Sam", "yes");
    const b = store.create();
    assert.notEqual(a.id, b.id);
    assert.equal(store.view(b.id).people.length, 0);
    assert.equal(store.view(a.id).people[0].name, "Sam");
  });

  it("same name is one row — two Mikes collide", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "Mike", "yes");
    store.tap(hang.id, "Mike", "late");
    const view = store.view(hang.id);
    assert.equal(view.people.length, 1);
    assert.equal(view.people[0].status, "late");
  });

  it("different names stay different rows", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "Mike", "yes");
    store.tap(hang.id, "mike", "late");
    const view = store.view(hang.id);
    assert.equal(view.people.length, 2);
  });

  it("view has no you and no client ids", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "Kim", "yes");
    const view = store.view(hang.id);
    assert.equal("you" in view, false);
    assert.equal(JSON.stringify(view).includes("device"), false);
  });

  it("same name retap moves that person, not a new row", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "Alex", "yes");
    store.tap(hang.id, "Alex", "out");
    const view = store.view(hang.id);
    assert.equal(view.people.length, 1);
    assert.equal(view.people[0].status, "out");
  });

  it("first tap freezes the hang line, later taps cannot change it", () => {
    const store = createStore();
    const hang = store.create();
    const before = store.view(hang.id);
    assert.equal(before.frozen, false);
    assert.equal(before.line, "");

    store.tap(hang.id, "Alex", "yes", "Luigi's");
    assert.equal(store.view(hang.id).line, "Luigi's");
    assert.equal(store.view(hang.id).frozen, true);

    store.tap(hang.id, "Alex", "late", "Friday dinner");
    store.tap(hang.id, "Sam", "out", "somewhere else");
    const view = store.view(hang.id);
    assert.equal(view.line, "Luigi's");
    assert.equal(view.frozen, true);
  });

  it("empty hang line still freezes on first tap", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "Alex", "yes", "  ");
    store.tap(hang.id, "Sam", "late", "Friday dinner");
    const view = store.view(hang.id);
    assert.equal(view.line, "");
    assert.equal(view.frozen, true);
  });

  it("start yours does not copy the hang line", () => {
    const store = createStore();
    const a = store.create();
    store.tap(a.id, "Sam", "yes", "Luigi's");
    const b = store.create();
    const view = store.view(b.id);
    assert.equal(view.frozen, false);
    assert.equal(view.line, "");
  });

  it("expires one hour after last tap", () => {
    let t = 1_000_000;
    const store = createStore({ ttlMs: HANG_TTL_MS, now: () => t });
    const hang = store.create();
    store.tap(hang.id, "Sam", "yes");
    t += HANG_TTL_MS - 1;
    assert.ok(store.view(hang.id));
    t += 2;
    assert.equal(store.view(hang.id), null);
  });

  it("create counts as activity for ttl", () => {
    let t = 1_000_000;
    const store = createStore({ ttlMs: HANG_TTL_MS, now: () => t });
    const hang = store.create();
    t += HANG_TTL_MS - 1;
    assert.ok(store.view(hang.id));
    t += 2;
    assert.equal(store.view(hang.id), null);
  });

  it("tracks aggregate counters only", () => {
    const store = createStore();
    const a = store.create();
    store.tap(a.id, "Sam", "yes");
    assert.deepEqual(store.stats(), {
      hangsCreated: 1,
      hangsActivated: 0,
      taps: 1,
      hangsLive: 1,
    });
    store.tap(a.id, "Alex", "late");
    assert.equal(store.stats().hangsActivated, 1);
    assert.equal(store.stats().taps, 2);
  });

  it("keeps ttl editable until a second person joins", () => {
    const store = createStore();
    const hang = store.create();
    assert.equal(store.view(hang.id).ttlHours, 1);
    assert.equal(store.view(hang.id).ttlLocked, false);

    assert.equal(store.setTtl(hang.id, 24).error, undefined);
    assert.equal(store.view(hang.id).ttlHours, 24);

    store.tap(hang.id, "Sam", "yes", "", 1);
    assert.equal(store.view(hang.id).ttlHours, 1);
    assert.equal(store.view(hang.id).ttlLocked, false);

    store.tap(hang.id, "Sam", "late", "", 24);
    assert.equal(store.view(hang.id).ttlHours, 24);
    assert.equal(store.view(hang.id).ttlLocked, false);

    assert.equal(store.setTtl(hang.id, 1, "Sam").error, undefined);
    assert.equal(store.view(hang.id).ttlHours, 1);
    assert.equal(store.setTtl(hang.id, 24, "Alex").error, "locked");
    assert.equal(store.setTtl(hang.id, 24).error, "locked");
    assert.equal(store.view(hang.id).ttlHours, 1);

    store.tap(hang.id, "Alex", "yes", "", 24);
    assert.equal(store.view(hang.id).ttlHours, 1);
    assert.equal(store.view(hang.id).ttlLocked, true);

    assert.equal(store.setTtl(hang.id, 24, "Sam").error, "locked");
    store.tap(hang.id, "Sam", "out", "", 24);
    assert.equal(store.view(hang.id).ttlHours, 1);
  });

  it("24h hang outlives one hour idle", () => {
    let t = 1_000_000;
    const store = createStore({ now: () => t });
    const hang = store.create();
    store.tap(hang.id, "Sam", "yes", "", 24);
    t += HANG_TTL_MS + 1;
    assert.ok(store.view(hang.id));
    t += 23 * HANG_TTL_MS;
    assert.equal(store.view(hang.id), null);
  });
});

describe("hang line", () => {
  it("trims and keeps what was typed", () => {
    assert.equal(cleanLine("  Friday dinner  "), "Friday dinner");
    assert.equal(cleanLine(""), "");
  });
});
