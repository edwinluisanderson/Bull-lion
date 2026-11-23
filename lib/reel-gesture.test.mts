import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { createReelEngine } from "@/components/reel";
import { REEL_SPEED_CAP } from "@/lib/drum";
import { COUNTS } from "@/lib/metals";
import { STRETCH_HOLD_MS } from "@/lib/stretch";

const queued: FrameRequestCallback[] = [];

function installFrame() {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    queued.push(callback);
    return queued.length;
  };
  globalThis.cancelAnimationFrame = () => {};
}

function flushFrames() {
  const batch = queued.splice(0, queued.length);
  const time = performance.now() + 400;
  for (const callback of batch) callback(time);
}

function harness() {
  let position = COUNTS.indexOf(20);
  let velocity = 0;
  const engine = createReelEngine({
    initialIndex: position,
    setKinetics(next, speed) {
      position = next;
      velocity = speed;
    },
    getCount: () => COUNTS.length,
    onIndex() {},
    onMotion() {},
    isReduced: () => false,
    isEnabled: () => true,
    getStretch: () => ({ stops: COUNTS, isValueEnabled: () => true }),
    onPieces() {},
    onStretchFrame() {},
    onGuest() {},
    alternatePullStops: () => false,
    speedCap: REEL_SPEED_CAP,
  });
  return {
    engine,
    read: () => ({ position, velocity }),
  };
}

function stretchCycle(engine: ReturnType<typeof createReelEngine>, time: number) {
  const y = 400;
  engine.pointerDown(y, time, 120, 258);
  mock.timers.tick(STRETCH_HOLD_MS);
  engine.pointerMove(y + 180, time + STRETCH_HOLD_MS + 40);
  engine.pointerUp();
  flushFrames();
}

test("after stretch releases, a drag moves the reel and a fling spins it", () => {
  installFrame();
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    for (const cycles of [1, 2, 3]) {
      const { engine, read } = harness();
      let time = 1_000;
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        stretchCycle(engine, time);
        time += 1_000;
      }
      const rested = read().position;
      const y = 400;
      engine.pointerDown(y, time, 120, 258);
      engine.pointerMove(y + 70, time + 40);
      const dragged = read().position;
      assert.ok(Math.abs(dragged - rested) > 0.4, `drag after ${cycles} stretches did not move`);

      engine.pointerMove(y + 70, time + 80);
      engine.pointerMove(y + 160, time + 100);
      engine.pointerMove(y + 280, time + 120);
      const atRelease = read().position;
      engine.pointerUp();
      let spun = false;
      let now = performance.now();
      for (let frame = 0; frame < 6 && queued.length > 0; frame += 1) {
        const batch = queued.splice(0, queued.length);
        now += 16;
        for (const callback of batch) callback(now);
        if (Math.abs(read().position - atRelease) > 0.5) spun = true;
      }
      assert.equal(spun, true, `fling after ${cycles} stretches settled in place`);
      engine.destroy();
    }
  } finally {
    mock.timers.reset();
  }
});
