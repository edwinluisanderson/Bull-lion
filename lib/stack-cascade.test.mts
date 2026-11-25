import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CASCADE_STAGGER_MS,
  TOTAL_BOARD_ID,
  TOTAL_WORD_ID,
  priceCascade,
  rectIntersectsViewport,
  seedCascade,
  settleCascade,
  startCascade,
  type CascadeBoard,
  type CascadeEffect,
  type CascadeSlot,
} from "@/lib/stack-cascade";

const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");
const flap = readFileSync(new URL("../components/split-flap.tsx", import.meta.url), "utf8");
const sound = readFileSync(new URL("./flap-sound.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function boards(lives: Record<string, string>, hidden: readonly string[] = []): CascadeBoard[] {
  return Object.entries(lives).map(([id, live]) => ({ id, live, visible: !hidden.includes(id) }));
}

function slot(slots: readonly CascadeSlot[], id: string): CascadeSlot {
  const found = slots.find((entry) => entry.id === id);
  assert.ok(found, id);
  return found;
}

function commits(effects: readonly CascadeEffect[], id: string): Extract<CascadeEffect, { type: "commit" }>[] {
  return effects.filter((effect): effect is Extract<CascadeEffect, { type: "commit" }> => effect.type === "commit" && effect.id === id);
}

const stack = () =>
  boards({
    a: "$1",
    b: "$1",
    c: "$1",
    [TOTAL_BOARD_ID]: "$3",
  });

test("visible boards run one at a time and the total waits for the last landing", () => {
  assert.equal(CASCADE_STAGGER_MS, 150);
  const seeded = seedCascade(stack());
  let step = priceCascade(
    seeded,
    boards({ a: "$2", b: "$4", c: "$6", [TOTAL_BOARD_ID]: "$12" }),
    1_000,
    false,
  );

  assert.equal(slot(step.slots, "a").status, "flipping");
  assert.equal(slot(step.slots, "a").committed, "$2");
  assert.equal(slot(step.slots, "b").status, "pending");
  assert.equal(slot(step.slots, "b").startAt, null);
  assert.equal(slot(step.slots, "c").status, "pending");
  assert.equal(slot(step.slots, "c").startAt, null);
  assert.equal(slot(step.slots, TOTAL_BOARD_ID).status, "pending");
  assert.equal(slot(step.slots, TOTAL_BOARD_ID).startAt, null);
  assert.equal(step.effects.filter((effect) => effect.type === "schedule").length, 0);
  assert.equal(seeded[0]?.committed, "$1");

  const landed = [5_000, 9_000, 14_000];
  for (const [index, id] of ["a", "b", "c"].entries()) {
    const now = landed[index] ?? 0;
    step = settleCascade(step.slots, id, now, false, boards({ a: "$2", b: "$4", c: "$6", [TOTAL_BOARD_ID]: "$12" }));
    const follower = ["b", "c", TOTAL_BOARD_ID][index] ?? TOTAL_BOARD_ID;
    assert.equal(slot(step.slots, id).status, "idle");
    assert.equal(slot(step.slots, follower).status, "pending");
    assert.equal(slot(step.slots, follower).startAt, now + CASCADE_STAGGER_MS);
    if (follower !== TOTAL_BOARD_ID) {
      step = startCascade(step.slots, follower, now + CASCADE_STAGGER_MS, true, false);
      assert.equal(slot(step.slots, follower).status, "flipping");
    }
  }
  assert.equal(slot(step.slots, TOTAL_BOARD_ID).startAt, 14_000 + CASCADE_STAGGER_MS);
  assert.equal(slot(step.slots, "b").status, "idle");
  assert.equal(slot(step.slots, "c").status, "idle");
});

test("an off-screen card snaps and does not take a stagger slot", () => {
  const step = priceCascade(
    seedCascade(stack()),
    boards({ a: "$2", b: "$9", c: "$6", [TOTAL_BOARD_ID]: "$17" }, ["b"]),
    500,
    false,
  );

  assert.equal(slot(step.slots, "b").status, "idle");
  assert.equal(slot(step.slots, "b").committed, "$9");
  assert.equal(slot(step.slots, "b").animate, false);
  assert.equal(slot(step.slots, "b").startAt, null);
  assert.deepEqual(commits(step.effects, "b"), [{ type: "commit", id: "b", value: "$9", animate: false }]);
  assert.equal(step.effects.some((effect) => effect.type === "schedule" && effect.id === "b"), false);

  assert.equal(slot(step.slots, "a").status, "flipping");
  assert.equal(slot(step.slots, "c").status, "pending");
  assert.equal(slot(step.slots, "c").startAt, null);
  assert.equal(slot(step.slots, TOTAL_BOARD_ID).startAt, null);
  const afterA = settleCascade(step.slots, "a", 2_000, false, boards({ a: "$2", b: "$9", c: "$6", [TOTAL_BOARD_ID]: "$17" }, ["b"]));
  assert.equal(slot(afterA.slots, "c").startAt, 2_000 + CASCADE_STAGGER_MS);
  assert.equal(slot(afterA.slots, TOTAL_BOARD_ID).startAt, null);
});

test("a price mid-cascade retargets an in-flight board and sends boards that have not started to the newest value", () => {
  const first = priceCascade(
    seedCascade(stack()),
    boards({ a: "$2", b: "$2", c: "$2", [TOTAL_BOARD_ID]: "$6" }),
    1_000,
    false,
  );
  const second = priceCascade(
    first.slots,
    boards({ a: "$4", b: "$5", c: "$6", [TOTAL_BOARD_ID]: "$15" }),
    1_040,
    false,
  );

  assert.equal(slot(second.slots, "a").status, "flipping");
  assert.equal(slot(second.slots, "a").committed, "$4");
  assert.deepEqual(commits(second.effects, "a"), [{ type: "commit", id: "a", value: "$4", animate: true }]);

  const pending = slot(second.slots, "b");
  assert.equal(pending.status, "pending");
  assert.equal(pending.startAt, null);
  assert.equal(pending.live, "$5");
  assert.equal(pending.committed, "$1");
  assert.equal(second.effects.some((effect) => effect.type === "schedule"), false);
  assert.equal(slot(second.slots, "c").startAt, null);
  assert.equal(slot(second.slots, TOTAL_BOARD_ID).startAt, null);
  assert.equal(slot(second.slots, TOTAL_BOARD_ID).live, "$15");
  assert.equal(first.slots[1]?.live, "$2");

  const settled = settleCascade(second.slots, "a", 1_400, false, boards({ a: "$4", b: "$5", c: "$6", [TOTAL_BOARD_ID]: "$15" }));
  assert.equal(slot(settled.slots, "a").status, "idle");
  assert.equal(slot(settled.slots, "a").committed, "$4");
  assert.equal(slot(settled.slots, "b").status, "pending");
  assert.equal(slot(settled.slots, "b").startAt, 1_400 + CASCADE_STAGGER_MS);
  assert.equal(slot(settled.slots, "b").committed, "$1");
  const started = startCascade(settled.slots, "b", 1_400 + CASCADE_STAGGER_MS, true, false);
  assert.equal(slot(started.slots, "b").status, "flipping");
  assert.equal(slot(started.slots, "b").committed, "$5");
  assert.deepEqual(commits(started.effects, "b"), [{ type: "commit", id: "b", value: "$5", animate: true }]);
  assert.equal(slot(started.slots, "c").status, "pending");
  assert.equal(slot(started.slots, "c").startAt, null);
  assert.equal(slot(started.slots, TOTAL_BOARD_ID).startAt, null);
});

test("a board that scrolls off before its turn snaps instead of flipping", () => {
  const next = boards({ a: "$2", b: "$3", c: "$4", [TOTAL_BOARD_ID]: "$9" });
  let step = priceCascade(seedCascade(stack()), next, 0, false);
  step = settleCascade(step.slots, "a", 1_000, false, next);
  step = startCascade(step.slots, "b", 1_000 + CASCADE_STAGGER_MS, true, false);
  step = settleCascade(step.slots, "b", 2_000, false, next);
  assert.equal(slot(step.slots, "c").startAt, 2_000 + CASCADE_STAGGER_MS);
  const started = startCascade(step.slots, "c", 2_000 + CASCADE_STAGGER_MS, false, false);
  assert.equal(slot(started.slots, "c").status, "idle");
  assert.equal(slot(started.slots, "c").committed, "$4");
  assert.equal(slot(started.slots, "c").animate, false);
  assert.deepEqual(commits(started.effects, "c"), [{ type: "commit", id: "c", value: "$4", animate: false }]);
  assert.equal(slot(started.slots, TOTAL_BOARD_ID).status, "flipping");
  assert.equal(slot(started.slots, TOTAL_BOARD_ID).committed, "$9");
  assert.equal(started.effects.some((effect) => effect.type === "schedule"), false);
});

test("an unchanged board is skipped and adds no gap", () => {
  const next = boards({ a: "$2", b: "$1", c: "$4", [TOTAL_BOARD_ID]: "$7" });
  let step = priceCascade(seedCascade(stack()), next, 0, false);
  assert.equal(slot(step.slots, "a").status, "flipping");
  assert.equal(slot(step.slots, "b").status, "idle");
  assert.equal(slot(step.slots, "b").committed, "$1");
  assert.equal(slot(step.slots, "c").status, "pending");
  assert.equal(slot(step.slots, "c").startAt, null);
  step = settleCascade(step.slots, "a", 1_000, false, next);
  assert.equal(slot(step.slots, "b").status, "idle");
  assert.equal(slot(step.slots, "c").startAt, 1_000 + CASCADE_STAGGER_MS);
  assert.equal(slot(step.slots, TOTAL_BOARD_ID).startAt, null);
});

test("reduced motion snaps the whole stack and does not schedule a cascade", () => {
  const step = priceCascade(
    seedCascade(stack()),
    boards({ a: "$2", b: "$3", c: "$4", [TOTAL_BOARD_ID]: "$9" }),
    0,
    true,
  );
  assert.equal(step.effects.some((effect) => effect.type === "schedule"), false);
  assert.equal(step.slots.every((entry) => entry.status === "idle" && entry.committed === entry.live && entry.animate === false), true);
  assert.equal(step.effects.filter((effect) => effect.type === "commit").every((effect) => effect.animate === false), true);
});

test("the TOTAL word stays still while the amount follows the last card", () => {
  const previous = seedCascade(
    boards({
      a: "$1",
      [TOTAL_WORD_ID]: "TOTAL",
      [TOTAL_BOARD_ID]: "       $1.00",
    }),
  );
  const step = priceCascade(
    previous,
    boards({
      a: "$2",
      [TOTAL_WORD_ID]: "TOTAL",
      [TOTAL_BOARD_ID]: "       $2.00",
    }),
    0,
    false,
  );
  assert.equal(slot(step.slots, TOTAL_WORD_ID).status, "idle");
  assert.equal(slot(step.slots, TOTAL_WORD_ID).committed, "TOTAL");
  assert.equal(commits(step.effects, TOTAL_WORD_ID).length, 0);
  assert.equal(slot(step.slots, "a").status, "flipping");
  assert.equal(slot(step.slots, TOTAL_BOARD_ID).status, "pending");
  assert.equal(slot(step.slots, TOTAL_BOARD_ID).startAt, null);
  const landed = settleCascade(step.slots, "a", 4_000, false, boards({
    a: "$2",
    [TOTAL_WORD_ID]: "TOTAL",
    [TOTAL_BOARD_ID]: "       $2.00",
  }));
  assert.equal(slot(landed.slots, TOTAL_WORD_ID).status, "idle");
  assert.equal(slot(landed.slots, TOTAL_BOARD_ID).startAt, 4_000 + CASCADE_STAGGER_MS);
});

test("an empty stack schedules nothing", () => {
  const step = priceCascade([], [], 0, false);
  assert.deepEqual(step.slots, []);
  assert.deepEqual(step.effects, []);
});

test("twenty cards only animate the boards on a short viewport", () => {
  const ids = Array.from({ length: 20 }, (_, index) => `card-${index}`);
  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  for (const id of ids) {
    before[id] = "$1";
    after[id] = "$2";
  }
  before[TOTAL_BOARD_ID] = "$20";
  after[TOTAL_BOARD_ID] = "$40";
  const hidden = ids.slice(2);
  const step = priceCascade(seedCascade(boards(before)), boards(after, hidden), 0, false);

  const moving = step.slots.filter((entry) => entry.status === "flipping" || entry.status === "pending");
  assert.deepEqual(moving.map((entry) => entry.id), ["card-0", "card-1", TOTAL_BOARD_ID]);
  assert.equal(slot(step.slots, "card-0").status, "flipping");
  assert.equal(slot(step.slots, "card-1").status, "pending");
  assert.equal(slot(step.slots, "card-1").startAt, null);
  assert.equal(slot(step.slots, TOTAL_BOARD_ID).status, "pending");
  assert.equal(slot(step.slots, TOTAL_BOARD_ID).startAt, null);
  const snapped = step.slots.filter((entry) => hidden.includes(entry.id));
  assert.equal(snapped.length, 18);
  assert.equal(snapped.every((entry) => entry.status === "idle" && entry.animate === false && entry.committed === "$2"), true);
});

test("a flap counts as on screen only when its own box meets the viewport", () => {
  const view = { width: 320, height: 640 };
  assert.equal(
    rectIntersectsViewport({ top: 10, left: 8, bottom: 40, right: 40, width: 32, height: 30 }, view),
    true,
  );
  assert.equal(
    rectIntersectsViewport({ top: 640, left: 0, bottom: 680, right: 100, width: 100, height: 40 }, view),
    false,
  );
  assert.equal(
    rectIntersectsViewport({ top: -20, left: 0, bottom: 0, right: 40, width: 40, height: 20 }, view),
    false,
  );
  assert.equal(
    rectIntersectsViewport({ top: 10, left: 0, bottom: 20, right: 0, width: 0, height: 10 }, view),
    false,
  );
});

test("the stack wires the cascade and the total board hangs at the bottom", () => {
  assert.match(table, /Let's get stacking!/);
  assert.equal(table.includes("The board is clear."), false);
  assert.match(table, /split-total-word/);
  assert.match(table, /split-total-amount/);
  assert.match(table, /priceCascade\(/);
  assert.match(table, /startCascade\(/);
  assert.match(table, /settleCascade\(/);
  assert.match(table, /totalBoardCopy\(/);
  assert.ok(table.indexOf('className="split-stack-head"') < table.indexOf('className="split-rows"'));
  assert.ok(table.indexOf('className="split-rows"') < table.indexOf("split-total-amount"));
  assert.match(flap, /trackFlippingFlap/);
  assert.match(flap, /is-instant/);
  assert.match(sound, /new IntersectionObserver/);
  assert.match(sound, /trackFlippingFlap/);
  assert.equal(table.includes("watchFlapBoard"), false);
  assert.match(css, /\.split-flap\.is-instant \.flap-leaf \{[^}]*animation:\s*none/);
});
