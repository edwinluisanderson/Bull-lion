import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { hapticClick, resetHapticQueue } from "@/lib/haptics";

type Vibrate = (pattern: number | number[]) => boolean;

const vibrateDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "vibrate");
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

afterEach(() => {
  resetHapticQueue();
  if (vibrateDescriptor) {
    Object.defineProperty(Navigator.prototype, "vibrate", vibrateDescriptor);
  } else {
    delete (Navigator.prototype as { vibrate?: Vibrate }).vibrate;
  }
  if (windowDescriptor) {
    Object.defineProperty(globalThis, "window", windowDescriptor);
  } else {
    delete (globalThis as { window?: unknown }).window;
  }
});

function installVibrate(impl: Vibrate) {
  Object.defineProperty(Navigator.prototype, "vibrate", {
    configurable: true,
    writable: true,
    value: impl,
  });
}

function vibrateDurations(pattern: number | number[]): number[] {
  const steps = Array.isArray(pattern) ? pattern : [pattern];
  return steps.filter((_, index) => index % 2 === 0);
}

test("a reel click asks for a pulse Android motors can produce", () => {
  const calls: Array<number | number[]> = [];
  installVibrate((pattern) => {
    calls.push(pattern);
    return true;
  });

  hapticClick();

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 40);
});

test("rapid stops keep a 40ms pulse instead of restarting the motor", async () => {
  const calls: Array<number | number[]> = [];
  installVibrate((pattern) => {
    calls.push(pattern);
    return true;
  });

  hapticClick();
  hapticClick();
  hapticClick();

  assert.deepEqual(calls, [40]);
  await new Promise((resolve) => setTimeout(resolve, 130));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], [40, 40, 40]);
});

test("prefers-reduced-motion does not suppress the click", () => {
  const calls: Array<number | number[]> = [];
  installVibrate((pattern) => {
    calls.push(pattern);
    return true;
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      matchMedia: (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
      }),
    },
  });

  hapticClick();

  assert.equal(calls.length, 1);
});

test("missing vibrate support is a no-op", () => {
  delete (Navigator.prototype as { vibrate?: Vibrate }).vibrate;
  assert.equal("vibrate" in navigator, false);
  assert.doesNotThrow(() => hapticClick());
});

test("a thrown or rejected vibrate call stays inside the helper", () => {
  installVibrate(() => {
    throw new Error("blocked");
  });
  assert.doesNotThrow(() => hapticClick());
  resetHapticQueue();

  let returned = true;
  installVibrate(() => {
    returned = false;
    return false;
  });
  assert.doesNotThrow(() => hapticClick());
  assert.equal(returned, false);
});
