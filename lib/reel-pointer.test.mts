import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createReelEngine } from "@/components/reel";
import { REEL_SPEED_CAP } from "@/lib/drum";
import { REEL_ITEM_HEIGHT } from "@/lib/metals";
import { beginReelPointer, type ReelPointerEvent } from "@/lib/reel-pointer";

function landCountReel(): {
  engine: ReturnType<typeof createReelEngine>;
  read: () => { position: number; velocity: number };
} {
  const queued: { callback: FrameRequestCallback; id: number }[] = [];
  let nextId = 1;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    queued.push({ callback, id });
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number) => {
    const index = queued.findIndex((entry) => entry.id === id);
    if (index >= 0) queued.splice(index, 1);
  };
  let position = 0;
  let velocity = 0;
  let now = 4_000;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  const engine = createReelEngine({
    initialIndex: 0,
    setKinetics(next, speed) {
      position = next;
      velocity = speed;
    },
    getCount: () => 8,
    onIndex() {},
    onMotion() {},
    isReduced: () => false,
    isEnabled: () => true,
    getStretch: () => null,
    onPieces() {},
    onStretchFrame() {},
    onGuest() {},
    alternatePullStops: () => false,
    speedCap: REEL_SPEED_CAP,
    pullRandom: () => 0,
  });
  engine.lever(2);
  for (let step = 0; step < 800 && queued.length > 0; step += 1) {
    const batch = queued.splice(0, queued.length);
    now += 16;
    for (const entry of batch) entry.callback(now);
    if (velocity === 0 && step > 10) break;
  }
  assert.equal(velocity, 0);
  return { engine, read: () => ({ position, velocity }) };
}

test("pointer events still drag a reel after it lands, even if capture is lost while arming", () => {
  const realFrame = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;
  const realNow = performance.now.bind(performance);
  const listeners = new Map<string, Set<(event: ReelPointerEvent) => void>>();
  const add = (type: string, listener: (event: ReelPointerEvent) => void) => {
    const set = listeners.get(type) ?? new Set();
    set.add(listener);
    listeners.set(type, set);
  };
  const remove = (type: string, listener: (event: ReelPointerEvent) => void) => {
    listeners.get(type)?.delete(listener);
  };
  const fire = (type: string, event: ReelPointerEvent) => {
    for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
  };
  let captured = false;
  const types: string[] = [];
  try {
    const { engine, read } = landCountReel();
    const face = read().position;
    const host = {
      focus() {},
      blur() {},
      getBoundingClientRect: () => ({ top: 100, height: 258 }),
      setPointerCapture() {
        captured = true;
        fire("lostpointercapture", { type: "lostpointercapture", pointerId: 7, clientY: 400, timeStamp: 50_000 });
      },
      releasePointerCapture() {
        captured = false;
      },
      hasPointerCapture: () => captured,
    };
    beginReelPointer({
      event: { type: "pointerdown", button: 0, pointerId: 7, clientY: 400, timeStamp: 50_000, cancelable: true, preventDefault() {} },
      host,
      engine,
      add,
      remove,
      onType: (type) => types.push(type),
    });
    assert.equal(types[0], "pointerdown");
    assert.equal(types.includes("lostpointercapture"), false);
    fire("pointermove", { type: "pointermove", pointerId: 7, clientY: 400 + REEL_ITEM_HEIGHT * 2, timeStamp: 50_040, cancelable: true });
    assert.ok(Math.abs(read().position - face) > 0.5, "drag after landing did not move the reel");
    fire("pointercancel", { type: "pointercancel", pointerId: 7, clientY: 400 + REEL_ITEM_HEIGHT * 2, timeStamp: 50_080 });
    const afterCancel = read().position;
    beginReelPointer({
      event: { type: "pointerdown", button: 0, pointerId: 8, clientY: 420, timeStamp: 51_000, cancelable: true, preventDefault() {} },
      host,
      engine,
      add,
      remove,
    });
    fire("pointermove", { type: "pointermove", pointerId: 8, clientY: 420 + REEL_ITEM_HEIGHT * 2, timeStamp: 51_040, cancelable: true });
    assert.ok(Math.abs(read().position - afterCancel) > 0.5, "a second drag after pointercancel did not move the reel");
  } finally {
    globalThis.requestAnimationFrame = realFrame;
    globalThis.cancelAnimationFrame = realCancel;
    Object.defineProperty(performance, "now", { configurable: true, value: realNow });
  }
});

test("the reel column keeps the finger instead of scrolling the page", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.reel-column \{[\s\S]*?touch-action:\s*none/);
  assert.match(css, /\.reel-viewport \{[\s\S]*?touch-action:\s*none/);
  const snap = readFileSync(new URL("../components/page-snap.tsx", import.meta.url), "utf8");
  assert.match(snap, /reel-column/);
});
