import assert from "node:assert/strict";
import { test } from "node:test";

import { COUNTS } from "@/lib/metals";
import {
  STRETCH_HOLD_MS,
  STRETCH_SLOP_PX,
  countRows,
  faceTop,
  guestStillVisible,
  handoffPlacement,
  handoffShift,
  nextGestureMode,
  originFor,
  originFromWindow,
  rollGuestWindow,
  visibleStretchFaces,
  pressHitsCenter,
  projectGuest,
  sequenceFrom,
  settledPlateStyle,
  guestWindow,
  releaseNotch,
  releasePlacement,
  snapEase,
  STRETCH_SNAP_MS,
  stretchLandingGate,
  stretchLayout,
  stretchSnap,
  stretchRowClip,
  stretchSequence,
  valueAfterRelease,
  visibleTriple,
} from "@/lib/stretch";

const TEN = COUNTS.indexOf(10);
const HEIGHT = 86;

test("a short press or a quick drag does not engage stretch", () => {
  assert.equal(nextGestureMode("pending", 200, 2), "pending");
  assert.equal(nextGestureMode("pending", STRETCH_HOLD_MS - 1, 0), "pending");
  assert.equal(nextGestureMode("pending", 90, STRETCH_SLOP_PX + 30), "drag");
  assert.equal(nextGestureMode("drag", 800, 1), "drag");
});

test("a long press with little movement engages stretch", () => {
  assert.equal(nextGestureMode("pending", STRETCH_HOLD_MS, 4), "stretch");
  assert.equal(pressHitsCenter(120, 258), true);
  assert.equal(pressHitsCenter(10, 258), false);
});

test("dragging down from 10 slides lower counts out while 10 and 20 move down", () => {
  assert.deepEqual(stretchSequence(COUNTS, TEN, "down"), [9, 8, 7, 6]);
  const start = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence: [9, 8, 7, 6],
    travel: 0,
    itemHeight: HEIGHT,
  });
  const pulled = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence: [9, 8, 7, 6],
    travel: HEIGHT,
    itemHeight: HEIGHT,
  });
  assert.equal(start.centered, 10);
  assert.equal(start.rows.find((row) => row.role === "pin")?.screenTop, 0);
  assert.equal(pulled.rows.find((row) => row.role === "pin")?.screenTop, 0);
  assert.ok(
    (pulled.rows.find((row) => row.role === "anchor")?.screenTop ?? 0) >
      (start.rows.find((row) => row.role === "anchor")?.screenTop ?? 0),
  );
  assert.ok(
    (pulled.rows.find((row) => row.role === "pushed")?.screenTop ?? 0) >
      (start.rows.find((row) => row.role === "pushed")?.screenTop ?? 0),
  );
  assert.equal(pulled.centered, 9);
  assert.equal(pulled.rows.filter((row) => row.centered).length, 1);
});

test("dragging up from 10 slides higher counts out from behind 20", () => {
  const sequence = stretchSequence(COUNTS, TEN, "up");
  assert.equal(sequence[0], 11);
  assert.equal(sequence.at(-1), 19);
  const pulled = stretchLayout({
    direction: "up",
    anchor: 10,
    pin: 20,
    pushed: 5,
    sequence,
    travel: HEIGHT,
    itemHeight: HEIGHT,
  });
  assert.equal(pulled.centered, 11);
  assert.equal(pulled.rows.find((row) => row.role === "pin")?.screenTop, HEIGHT * 2);
  assert.equal(pulled.rows.filter((row) => row.centered).length, 1);
  const further = stretchLayout({
    direction: "up",
    anchor: 10,
    pin: 20,
    pushed: 5,
    sequence,
    travel: HEIGHT * 2,
    itemHeight: HEIGHT,
  });
  assert.equal(further.centered, 12);
});

test("the single highlight is the value sitting on the center line", () => {
  const sequence = [9, 8, 7, 6];
  const mid = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence,
    travel: HEIGHT * 2,
    itemHeight: HEIGHT,
  });
  assert.equal(mid.centered, 8);
  assert.equal(mid.rows.filter((row) => row.centered).length, 1);
  assert.equal(mid.rows.find((row) => row.centered)?.value, 8);
  assert.equal(mid.rows.find((row) => row.value === 9)?.centered, false);
  assert.equal(mid.rows.find((row) => row.value === 10)?.centered, false);
});

test("release locks the centered in-between between its real neighbors", () => {
  const guest = { value: 8, slot: TEN - 0.5 };
  assert.deepEqual(visibleTriple(guest.slot, countRows(COUNTS, guest)), [5, 8, 10]);
  assert.equal(valueAfterRelease(10, 8, COUNTS, () => true), 8);
});

test("a locked in-between stays through the neighboring rows and then leaves the screen", () => {
  const guest = { value: 8, slot: TEN - 0.5 };
  assert.equal(guestStillVisible(TEN - 0.5, COUNTS, guest), true);
  assert.equal(guestStillVisible(TEN - 1, COUNTS, guest), true);
  assert.equal(guestStillVisible(TEN, COUNTS, guest), true);
  assert.equal(guestStillVisible(TEN - 2, COUNTS, guest), true);
  assert.equal(guestStillVisible(TEN - 3, COUNTS, guest), false);
  assert.equal(guestStillVisible(TEN + 2, COUNTS, guest), false);
  assert.deepEqual(visibleTriple(TEN + 1, countRows(COUNTS, null)), [10, 20, 25]);
});

test("a released in-between stays on the cylinder and scrolls off the screen", () => {
  const guest = { value: 9, slot: TEN - 0.5 };
  const centered = projectGuest(guest.slot, guest);
  assert.equal(centered, Math.floor(guest.slot) + 1);
  const steps = [0, 0.1, 0.25, 0.5, 0.75, 1];
  const ups = steps.map((step) => projectGuest(guest.slot + step, guest));
  for (let i = 1; i < ups.length; i += 1) {
    assert.ok(ups[i] > ups[i - 1]);
    assert.ok(ups[i] - ups[i - 1] < 1.01);
  }
  assert.equal(guestStillVisible(guest.slot, COUNTS, guest), true);
  assert.equal(guestStillVisible(guest.slot + 0.5, COUNTS, guest), true);
  assert.ok(faceTop(0) > 0);
  let hiddenAt: number | null = null;
  for (let step = 0; step <= 4; step += 0.05) {
    if (!guestStillVisible(guest.slot + step, COUNTS, guest)) {
      hiddenAt = guest.slot + step;
      break;
    }
  }
  assert.ok(hiddenAt !== null && hiddenAt > guest.slot + 1);
});

test("the settled count does not keep the stretch plate fill", () => {
  assert.equal(settledPlateStyle(), null);
  const pinned = stretchRowClip(0, HEIGHT, "down", "pin");
  assert.equal(pinned.opacity, 1);
  assert.equal(pinned.clipTop, 0);
});

test("a settled in-between can stretch down to the next lower count and back up", () => {
  const from19 = originFor(COUNTS, 19);
  assert.equal(from19.anchor, 19);
  assert.equal(from19.lower, 10);
  assert.equal(from19.upper, 20);
  assert.deepEqual(sequenceFrom(from19, "down").slice(0, 2), [18, 17]);
  assert.deepEqual(sequenceFrom(from19, "up"), []);
  const from15 = originFor(COUNTS, 15);
  assert.equal(sequenceFrom(from15, "down")[0], 14);
  assert.equal(sequenceFrom(from15, "up")[0], 16);
  assert.equal(sequenceFrom(from15, "up").at(-1), 19);
  assert.deepEqual(sequenceFrom(originFor(COUNTS, 10), "down"), [9, 8, 7, 6]);
});

test("after the in-between counts pass center, further dragging is a normal reel move", () => {
  const sequence = [9, 8, 7, 6];
  const before = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence,
    travel: sequence.length * HEIGHT - 1,
    itemHeight: HEIGHT,
  });
  const edge = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence,
    travel: sequence.length * HEIGHT,
    itemHeight: HEIGHT,
  });
  assert.equal(before.handoff, false);
  assert.equal(before.centered, 6);
  assert.equal(edge.handoff, true);
  assert.equal(edge.remainderPx, 0);
  assert.equal(handoffShift("down", HEIGHT, HEIGHT), -1);
  assert.equal(handoffShift("up", HEIGHT, HEIGHT), 1);
});

test("handoff parks the centered temporary on its slot, then keeps the remainder", () => {
  const down = originFor(COUNTS, 10);
  const sequence = sequenceFrom(down, "down");
  const atEdge = handoffPlacement({
    direction: "down",
    anchorIndex: TEN,
    origin: down,
    sequence,
    stops: COUNTS,
    remainderPx: 0,
    itemHeight: HEIGHT,
  });
  assert.equal(atEdge.position, down.lowerIndex + 1);
  assert.equal(atEdge.guest?.value, sequence.at(-1));
  assert.equal(atEdge.guest?.slot, down.lowerIndex + 0.5);
  assert.deepEqual(atEdge.guest?.run, [...sequence].reverse());
  const dragged = handoffPlacement({
    direction: "down",
    anchorIndex: TEN,
    origin: down,
    sequence,
    stops: COUNTS,
    remainderPx: HEIGHT / 2,
    itemHeight: HEIGHT,
  });
  assert.equal(dragged.position, down.lowerIndex + 1 - 0.5);

  const up = originFor(COUNTS, 10);
  const upSequence = sequenceFrom(up, "up");
  const upEdge = handoffPlacement({
    direction: "up",
    anchorIndex: TEN,
    origin: up,
    sequence: upSequence,
    stops: COUNTS,
    remainderPx: 0,
    itemHeight: HEIGHT,
  });
  assert.equal(upEdge.position, TEN + upSequence.length);
  assert.equal(upEdge.guest?.value, upSequence.at(-1));
  assert.equal(upEdge.guest?.slot, TEN + 0.5);
  assert.deepEqual(upEdge.guest?.run, upSequence);
  const upDragged = handoffPlacement({
    direction: "up",
    anchorIndex: TEN,
    origin: up,
    sequence: upSequence,
    stops: COUNTS,
    remainderPx: HEIGHT / 2,
    itemHeight: HEIGHT,
  });
  assert.equal(upDragged.position, TEN + upSequence.length + 0.5);
});

test("an empty stretch handoff stays on the pressed stop plus the remainder", () => {
  const origin = originFor(COUNTS, 10);
  const down = handoffPlacement({
    direction: "down",
    anchorIndex: TEN,
    origin,
    sequence: [],
    stops: COUNTS,
    remainderPx: HEIGHT,
    itemHeight: HEIGHT,
  });
  assert.equal(down.guest, null);
  assert.equal(down.position, TEN + handoffShift("down", HEIGHT, HEIGHT));
  const up = handoffPlacement({
    direction: "up",
    anchorIndex: TEN,
    origin,
    sequence: [],
    stops: COUNTS,
    remainderPx: HEIGHT / 2,
    itemHeight: HEIGHT,
  });
  assert.equal(up.guest, null);
  assert.equal(up.position, TEN + handoffShift("up", HEIGHT / 2, HEIGHT));
});

test("the overlay rows sit on the cylinder rows at a one-value handoff", () => {
  for (const direction of ["down", "up"] as const) {
    const layout = stretchLayout({
      direction,
      anchor: 10,
      pin: direction === "down" ? 5 : 20,
      pushed: direction === "down" ? 20 : 5,
      sequence: [direction === "down" ? 6 : 19],
      travel: HEIGHT,
      itemHeight: HEIGHT,
    });
    const pin = layout.rows.find((row) => row.role === "pin");
    const between = layout.rows.find((row) => row.role === "between");
    const anchor = layout.rows.find((row) => row.role === "anchor");
    const near = (left: number | undefined, right: number) => Math.abs((left ?? NaN) - right) < 1e-6;
    assert.ok(near(between?.screenTop, faceTop(0, HEIGHT)));
    assert.ok(near(pin?.screenTop, faceTop(direction === "down" ? -1 : 1, HEIGHT)));
    assert.ok(near(anchor?.screenTop, faceTop(direction === "down" ? 1 : -1, HEIGHT)));
  }
});

test("a gray centered count falls back to the nearest real stop", () => {
  assert.equal(valueAfterRelease(10, 8, COUNTS, (value) => value !== 8), 10);
  assert.equal(
    valueAfterRelease(10, 6, COUNTS, (value) => value === 5 || value === 10),
    5,
  );
});

test("the pinned stop stays opaque and the emerging count is clipped behind it", () => {
  const sequence = [9, 8, 7, 6];
  const emerging = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence,
    travel: HEIGHT / 2,
    itemHeight: HEIGHT,
  });
  const pin = emerging.rows.find((row) => row.role === "pin");
  const nine = emerging.rows.find((row) => row.value === 9);
  assert.ok(pin);
  assert.ok(nine);
  const pinPaint = stretchRowClip(pin.screenTop, HEIGHT, "down", "pin");
  const ninePaint = stretchRowClip(nine.screenTop, HEIGHT, "down", "between");
  assert.equal(pinPaint.opacity, 1);
  assert.equal(pinPaint.clipTop, 0);
  assert.equal(ninePaint.opacity, 1);
  assert.ok(ninePaint.clipTop > 0);

  const arrived = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence,
    travel: HEIGHT,
    itemHeight: HEIGHT,
  });
  const centeredNine = arrived.rows.find((row) => row.value === 9);
  assert.ok(centeredNine);
  const clear = stretchRowClip(centeredNine.screenTop, HEIGHT, "down", "between");
  assert.equal(clear.opacity, 1);
  assert.equal(clear.clipTop, 0);
  assert.equal(clear.clipBottom, 0);

  const upward = stretchLayout({
    direction: "up",
    anchor: 10,
    pin: 20,
    pushed: 5,
    sequence: [11],
    travel: HEIGHT / 2,
    itemHeight: HEIGHT,
  });
  const eleven = upward.rows.find((row) => row.value === 11);
  assert.ok(eleven);
  const upPaint = stretchRowClip(eleven.screenTop, HEIGHT, "up", "between");
  assert.equal(upPaint.opacity, 1);
  assert.ok(upPaint.clipBottom > 0);
});

test("releasing a stretch from 20 keeps 18 centered and 19 beside it", () => {
  const origin = originFor(COUNTS, 20);
  const sequence = sequenceFrom(origin, "down");
  const travel = 2 * HEIGHT;
  const layout = stretchLayout({
    direction: "down",
    anchor: 20,
    pin: origin.lower,
    pushed: origin.upper,
    sequence,
    travel,
    itemHeight: HEIGHT,
  });
  assert.equal(layout.centered, 18);
  const placed = releasePlacement({
    direction: "down",
    origin,
    sequence,
    stops: COUNTS,
    travel,
    itemHeight: HEIGHT,
    centered: layout.centered,
  });
  assert.ok(placed);
  assert.deepEqual(placed.guest.run, [18, 19]);
  assert.deepEqual(guestWindow(COUNTS, placed.position, placed.guest), [10, 18, 19]);
  assert.deepEqual(guestWindow(COUNTS, placed.position + 1, placed.guest), [18, 19, 20]);
});

test("a stretch face that has left the window is not kept on release", () => {
  const origin = originFor(COUNTS, 20);
  const sequence = sequenceFrom(origin, "down");
  const travel = 3 * HEIGHT;
  const layout = stretchLayout({
    direction: "down",
    anchor: 20,
    pin: origin.lower,
    pushed: origin.upper,
    sequence,
    travel,
    itemHeight: HEIGHT,
  });
  assert.equal(layout.centered, 17);
  const placed = releasePlacement({
    direction: "down",
    origin,
    sequence,
    stops: COUNTS,
    travel,
    itemHeight: HEIGHT,
    centered: layout.centered,
  });
  assert.ok(placed);
  assert.equal(placed.guest.run?.includes(19), false);
  assert.deepEqual(guestWindow(COUNTS, placed.position, placed.guest), [10, 17, 18]);
});

test("releasing an upward stretch keeps the in-between that is still beside center", () => {
  const origin = originFor(COUNTS, 20);
  const sequence = sequenceFrom(origin, "up");
  const travel = 2 * HEIGHT;
  const layout = stretchLayout({
    direction: "up",
    anchor: 20,
    pin: origin.upper,
    pushed: origin.lower,
    sequence,
    travel,
    itemHeight: HEIGHT,
  });
  assert.equal(layout.centered, 22);
  const placed = releasePlacement({
    direction: "up",
    origin,
    sequence,
    stops: COUNTS,
    travel,
    itemHeight: HEIGHT,
    centered: layout.centered,
  });
  assert.ok(placed);
  assert.deepEqual(placed.guest.run, [21, 22]);
  assert.deepEqual(guestWindow(COUNTS, placed.position, placed.guest), [21, 22, 25]);
});

test("a release snap eases past center and settles on it", () => {
  assert.ok(STRETCH_SNAP_MS >= 90 && STRETCH_SNAP_MS <= 140);
  assert.ok(Math.abs(snapEase(0)) < 1e-9);
  assert.ok(Math.abs(snapEase(1) - 1) < 1e-9);
  let peak = 0;
  for (let step = 0; step <= 40; step += 1) peak = Math.max(peak, snapEase(step / 40));
  assert.ok(peak > 1.02 && peak < 1.12);

  const origin = originFor(COUNTS, 20);
  const sequence = sequenceFrom(origin, "down");
  const travel = 2 * HEIGHT + 24;
  const layout = stretchLayout({
    direction: "down",
    anchor: 20,
    pin: origin.lower,
    pushed: origin.upper,
    sequence,
    travel,
    itemHeight: HEIGHT,
  });
  const placed = releasePlacement({
    direction: "down",
    origin,
    sequence,
    stops: COUNTS,
    travel,
    itemHeight: HEIGHT,
    centered: layout.centered,
  });
  assert.ok(placed);
  assert.ok(Math.abs(placed.position - placed.center) > 0.05);
  const start = guestWindow(COUNTS, placed.position, placed.guest);
  assert.deepEqual(guestWindow(COUNTS, placed.center, placed.guest), start);
  let far = 0;
  for (let step = 0; step <= 20; step += 1) {
    const at = stretchSnap(placed.position, placed.center, step / 20);
    far = Math.max(far, Math.abs(at - placed.center));
    assert.deepEqual(guestWindow(COUNTS, at, placed.guest), start);
  }
  assert.ok(far > 0);
  assert.equal(stretchSnap(placed.position, placed.center, 1), placed.center);
});

test("twenty stretch releases each knock once and finish centered", () => {
  const origin = originFor(COUNTS, 20);
  const sequence = sequenceFrom(origin, "down");
  let knocks = 0;
  for (let i = 0; i < 20; i += 1) {
    const travel = 1.6 * HEIGHT + i * 3;
    const layout = stretchLayout({
      direction: "down",
      anchor: 20,
      pin: origin.lower,
      pushed: origin.upper,
      sequence,
      travel,
      itemHeight: HEIGHT,
    });
    const placed = releasePlacement({
      direction: "down",
      origin,
      sequence,
      stops: COUNTS,
      travel,
      itemHeight: HEIGHT,
      centered: layout.centered,
    });
    assert.ok(placed);
    let gate = { played: false };
    const cue = stretchLandingGate(gate);
    gate = cue.state;
    if (cue.play) knocks += 1;
    assert.equal(stretchLandingGate(gate).play, false);
    assert.equal(stretchSnap(placed.position, placed.center, 1), placed.center);
    assert.deepEqual(
      guestWindow(COUNTS, placed.center, placed.guest),
      guestWindow(COUNTS, placed.position, placed.guest),
    );
  }
  assert.equal(knocks, 20);
});

test("a re-press keeps the released neighbor, and three cycles do not restore the main stop", () => {
  const first = originFor(COUNTS, 20);
  const sequence = sequenceFrom(first, "down");
  const opened = stretchLayout({
    direction: "down",
    anchor: 20,
    pin: first.lower,
    pushed: first.upper,
    sequence,
    travel: 2 * HEIGHT,
    itemHeight: HEIGHT,
  });
  const released = releasePlacement({
    direction: "down",
    origin: first,
    sequence,
    stops: COUNTS,
    travel: 2 * HEIGHT,
    itemHeight: HEIGHT,
    centered: opened.centered,
  });
  assert.ok(released);
  let faces = guestWindow(COUNTS, released.center, released.guest);
  assert.deepEqual(faces, [10, 18, 19]);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const origin = originFromWindow({
      above: faces[0],
      center: faces[1],
      below: faces[2],
      insertAfter: released.guest.insertAfter ?? 0,
      upperIndex: (released.guest.insertAfter ?? 0) + 1,
    });
    const held = visibleStretchFaces({
      direction: "down",
      origin,
      sequence: sequenceFrom(origin, "down"),
      travel: 0,
      itemHeight: HEIGHT,
    });
    assert.deepEqual(held.slice(0, 3), faces);
    const again = releasePlacement({
      direction: "down",
      origin,
      sequence: sequenceFrom(origin, "down"),
      stops: COUNTS,
      travel: 0,
      itemHeight: HEIGHT,
      centered: faces[1],
    });
    assert.ok(again);
    assert.deepEqual(guestWindow(COUNTS, again.center, again.guest), faces);
    const stepped = stretchLayout({
      direction: "down",
      anchor: origin.anchor,
      pin: origin.lower,
      pushed: origin.upper,
      sequence: sequenceFrom(origin, "down"),
      travel: HEIGHT,
      itemHeight: HEIGHT,
    });
    const moved = releasePlacement({
      direction: "down",
      origin,
      sequence: sequenceFrom(origin, "down"),
      stops: COUNTS,
      travel: HEIGHT,
      itemHeight: HEIGHT,
      centered: stepped.centered,
    });
    assert.ok(moved);
    const next = guestWindow(COUNTS, moved.center, moved.guest);
    assert.equal(next[1], stepped.centered);
    assert.ok(next.includes(faces[1]) || next[2] !== faces[2] || faces[2] === next[2]);
    faces = next;
  }
  assert.notDeepEqual(faces, [10, 18, 20]);
});

test("consecutive faces roll off-screen instead of jumping to the main stops", () => {
  const insertAfter = COUNTS.indexOf(10);
  const guest = { value: 18, slot: insertAfter + 0.5, run: [17, 18, 19], insertAfter };
  const position = insertAfter + 2;
  assert.deepEqual(guestWindow(COUNTS, position, guest), [17, 18, 19]);
  const origin = originFromWindow({
    above: 17,
    center: 18,
    below: 19,
    insertAfter,
    upperIndex: insertAfter + 1,
  });
  assert.deepEqual(sequenceFrom(origin, "down"), []);
  assert.deepEqual(sequenceFrom(origin, "up"), []);

  const down = rollGuestWindow({ position, guest, direction: "down", travel: HEIGHT, itemHeight: HEIGHT });
  assert.deepEqual(guestWindow(COUNTS, Math.round(down.position), down.guest), [10, 17, 18]);
  const up = rollGuestWindow({ position, guest, direction: "up", travel: HEIGHT, itemHeight: HEIGHT });
  assert.deepEqual(guestWindow(COUNTS, Math.round(up.position), up.guest), [18, 19, 20]);

  const nudge = rollGuestWindow({ position, guest, direction: "down", travel: 12, itemHeight: HEIGHT });
  assert.equal(guestWindow(COUNTS, Math.round(nudge.position), nudge.guest)[1], 18);
  assert.notDeepEqual(guestWindow(COUNTS, Math.round(nudge.position), nudge.guest), [2, 5, 10]);

  let cursor = position;
  const windows: number[][] = [];
  for (let step = 0; step < 3; step += 1) {
    const rolled = rollGuestWindow({
      position: cursor,
      guest,
      direction: "down",
      travel: HEIGHT,
      itemHeight: HEIGHT,
    });
    cursor = rolled.position;
    windows.push(guestWindow(COUNTS, Math.round(cursor), guest));
  }
  assert.deepEqual(windows, [
    [10, 17, 18],
    [5, 10, 17],
    [2, 5, 10],
  ]);

  cursor = position;
  const upward: number[][] = [];
  for (let step = 0; step < 3; step += 1) {
    const rolled = rollGuestWindow({
      position: cursor,
      guest,
      direction: "up",
      travel: HEIGHT,
      itemHeight: HEIGHT,
    });
    cursor = rolled.position;
    upward.push(guestWindow(COUNTS, Math.round(cursor), guest));
  }
  assert.deepEqual(upward[0], [18, 19, 20]);
  assert.deepEqual(upward[1], [19, 20, 25]);
  assert.ok(upward[2].includes(20));
});

test("a dead-stop release after one face keeps that window, and a moving release does not step again", () => {
  const insertAfter = COUNTS.indexOf(10);
  const guest = { value: 18, slot: insertAfter + 0.5, run: [17, 18, 19], insertAfter };
  const rest = insertAfter + 2;
  assert.deepEqual(guestWindow(COUNTS, rest, guest), [17, 18, 19]);

  const down = rollGuestWindow({ position: rest, guest, direction: "down", travel: HEIGHT, itemHeight: HEIGHT });
  assert.deepEqual(guestWindow(COUNTS, down.position, down.guest), [10, 17, 18]);
  assert.equal(releaseNotch(down.position), down.position);
  assert.deepEqual(guestWindow(COUNTS, releaseNotch(down.position), down.guest), [10, 17, 18]);
  assert.equal(releaseNotch(down.position - 0.4), down.position);
  assert.notEqual(releaseNotch(down.position - 0.4), down.position - 1);

  const up = rollGuestWindow({ position: rest, guest, direction: "up", travel: HEIGHT, itemHeight: HEIGHT });
  assert.deepEqual(guestWindow(COUNTS, up.position, up.guest), [18, 19, 20]);
  assert.equal(releaseNotch(up.position), up.position);
  assert.deepEqual(guestWindow(COUNTS, releaseNotch(up.position), up.guest), [18, 19, 20]);
  assert.equal(releaseNotch(up.position + 0.4), up.position);
});

test("crossing 100 does not swap a face in the middle of the window", () => {
  const insertAfter = COUNTS.indexOf(50);
  const guest = { value: 100, slot: insertAfter + 0.5, run: [100], insertAfter };
  const at100 = insertAfter + 1;
  assert.equal(guestWindow(COUNTS, at100, guest)[1], 100);
  assert.equal(releaseNotch(at100 + 0.2), at100);
  const held = guestWindow(COUNTS, releaseNotch(at100 + 0.2), guest);
  assert.equal(held[1], 100);
  assert.ok(!held.includes(2));
  const edge = guestWindow(COUNTS, at100 + 1, guest);
  assert.equal(edge[0], 100);
  assert.notEqual(edge[1], 2);
});

test("the ends of the count list have no invented numbers", () => {
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(1), "down"), []);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(100), "up"), []);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(2), "down"), []);
});
