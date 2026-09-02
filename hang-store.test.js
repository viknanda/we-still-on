import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cleanLine,
  cleanName,
  createStore,
  isHangId,
  newHangId,
} from "./hang-store.js";

describe("ids", () => {
  it("mints short unguessable ids", () => {
    const id = newHangId();
    assert.equal(id.length, 8);
    assert.equal(isHangId(id), true);
    assert.equal(isHangId("abc"), false);
  });
});

describe("names", () => {
  it("keeps what people typed, including two Mikes", () => {
    assert.equal(cleanName("  Mike  "), "Mike");
    assert.equal(cleanName("mike"), "mike");
  });
});

describe("store", () => {
  it("start yours is a new hang, not a copy", () => {
    const store = createStore();
    const a = store.create();
    store.tap(a.id, "dev-a", "Sam", "yes");
    const b = store.create();
    assert.notEqual(a.id, b.id);
    assert.equal(store.view(b.id, "dev-b").people.length, 0);
    assert.equal(store.view(a.id, "dev-a").people[0].name, "Sam");
  });

  it("two devices named Mike stay two rows", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "d1", "Mike", "yes");
    store.tap(hang.id, "d2", "Mike", "late");
    const view = store.view(hang.id, "d1");
    assert.equal(view.people.length, 2);
    assert.deepEqual(
      view.people.map((p) => p.status),
      ["yes", "late"],
    );
    assert.equal(view.you.status, "yes");
  });

  it("a new device sees the hang line but is not you until they tap", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "starter", "Alex", "yes", "Luigi's");
    const joiner = store.view(hang.id, "incognito");
    assert.equal(joiner.you, null);
    assert.equal(joiner.line, "Luigi's");
    assert.equal(joiner.frozen, true);
    assert.equal(store.view(hang.id, "starter").you.name, "Alex");
  });

  it("same device retap moves that person, not a new row", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "d1", "Alex", "yes");
    store.tap(hang.id, "d1", "Alex", "out");
    const view = store.view(hang.id, "d1");
    assert.equal(view.people.length, 1);
    assert.equal(view.people[0].status, "out");
    assert.equal(view.you.status, "out");
  });

  it("changing the typed name updates this device only", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "d1", "Alex", "yes");
    store.tap(hang.id, "d2", "Sam", "yes");
    store.tap(hang.id, "d1", "A.", "late");
    const view = store.view(hang.id, "d2");
    assert.deepEqual(view.people, [
      { name: "A.", status: "late" },
      { name: "Sam", status: "yes" },
    ]);
  });

  it("view never leaks device ids", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "secret-device", "Kim", "yes");
    const json = JSON.stringify(store.view(hang.id, "secret-device"));
    assert.equal(json.includes("secret-device"), false);
  });

  it("first tap freezes the hang line, later taps cannot change it", () => {
    const store = createStore();
    const hang = store.create();
    const before = store.view(hang.id, "d1");
    assert.equal(before.frozen, false);
    assert.equal(before.line, "");

    store.tap(hang.id, "d1", "Alex", "yes", "Luigi's");
    assert.equal(store.view(hang.id, "d1").line, "Luigi's");
    assert.equal(store.view(hang.id, "d1").frozen, true);

    store.tap(hang.id, "d1", "Alex", "late", "Friday dinner");
    store.tap(hang.id, "d2", "Sam", "out", "somewhere else");
    const view = store.view(hang.id, "d2");
    assert.equal(view.line, "Luigi's");
    assert.equal(view.frozen, true);
  });

  it("empty hang line still freezes on first tap", () => {
    const store = createStore();
    const hang = store.create();
    store.tap(hang.id, "d1", "Alex", "yes", "  ");
    store.tap(hang.id, "d2", "Sam", "late", "Friday dinner");
    const view = store.view(hang.id, "d1");
    assert.equal(view.line, "");
    assert.equal(view.frozen, true);
  });

  it("start yours does not copy the hang line", () => {
    const store = createStore();
    const a = store.create();
    store.tap(a.id, "d1", "Sam", "yes", "Luigi's");
    const b = store.create();
    const view = store.view(b.id, "d1");
    assert.equal(view.frozen, false);
    assert.equal(view.line, "");
  });
});

describe("hang line", () => {
  it("trims and keeps what was typed", () => {
    assert.equal(cleanLine("  Friday dinner  "), "Friday dinner");
    assert.equal(cleanLine(""), "");
  });
});

describe("mints and ttl", () => {
  it("increments mints on each create, not on tap", () => {
    const store = createStore();
    assert.equal(store.mints(), 0);
    store.create();
    store.create();
    assert.equal(store.mints(), 2);
    const hang = store.create();
    store.tap(hang.id, "d1", "Sam", "yes");
    assert.equal(store.mints(), 3);
  });

  it("a hang is gone 48 hours after last tap", () => {
    let t = 1_000;
    const store = createStore({
      ttlMs: 48 * 60 * 60 * 1000,
      now: () => t,
    });
    const hang = store.create();
    store.tap(hang.id, "d1", "Sam", "yes", "Luigi's");
    t += 48 * 60 * 60 * 1000 + 1;
    assert.equal(store.view(hang.id, "d1"), null);
    assert.equal(store.tap(hang.id, "d1", "Sam", "late").error, "gone");
  });

  it("a tap refreshes the 48 hour window", () => {
    let t = 1_000;
    const hour = 60 * 60 * 1000;
    const store = createStore({ ttlMs: 48 * hour, now: () => t });
    const hang = store.create();
    store.tap(hang.id, "d1", "Sam", "yes");
    t += 47 * hour;
    store.tap(hang.id, "d1", "Sam", "late");
    t += 47 * hour;
    assert.equal(store.view(hang.id, "d1").you.status, "late");
  });
});
