import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PULL_BALL_INK, PULL_BAR_WIDTH_RATIO, PULL_LETTERS, pullBarSpan } from "@/lib/pull-bar";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const lever = readFileSync(new URL("../components/lever.tsx", import.meta.url), "utf8");

test("the bar runs from the ball center to the wheel midline", () => {
  const rest = pullBarSpan(180, 0);
  assert.equal(rest.end, "down");
  assert.equal(rest.length, 180);

  const midline = pullBarSpan(180, 180);
  assert.equal(midline.end, "none");
  assert.equal(midline.length, 0);

  const past = pullBarSpan(180, 240);
  assert.equal(past.end, "up");
  assert.equal(past.length, 60);

  const threeQuarter = pullBarSpan(180, 270);
  assert.equal(threeQuarter.end, "up");
  assert.ok(threeQuarter.length > 0);
});

test("the bar is a round silver shaft behind the ball", () => {
  assert.ok(PULL_BAR_WIDTH_RATIO >= 0.25 && PULL_BAR_WIDTH_RATIO <= 1 / 3);
  assert.equal(PULL_BAR_WIDTH_RATIO, 0.33);
  assert.match(css, /\.pull-bar \{[^}]*width:\s*33%/);
  assert.match(css, /\.pull-bar \{[^}]*z-index:\s*1;/);
  assert.match(css, /\.pull-ball \{[^}]*z-index:\s*2;/);
  assert.match(css, /\.pull-bar \{[^}]*linear-gradient\(90deg/);
  const bar = lever.indexOf('className="pull-bar"');
  const ball = lever.indexOf('className={`pull-ball');
  assert.ok(bar > 0 && ball > bar);
});

test("the pull label uses the plate title ink", () => {
  assert.equal(PULL_BALL_INK, "#3a2710");
  assert.match(css, /\.plate-title \{[^}]*color:\s*#3a2710;/);
  assert.match(css, new RegExp(`\\.pull-ball \\{[^}]*color:\\s*${PULL_BALL_INK};`));
  assert.match(lever, /fill=\{PULL_BALL_INK\}/);
});

test("the pull word sits above center and tightens toward the edges", () => {
  assert.equal(PULL_LETTERS.map((letter) => letter.char).join(""), "PULL");
  for (const letter of PULL_LETTERS) assert.ok(letter.y < 0.5);
  const edges = [PULL_LETTERS[0], PULL_LETTERS[3]];
  const middle = [PULL_LETTERS[1], PULL_LETTERS[2]];
  const edgeY = (edges[0].y + edges[1].y) / 2;
  const middleY = (middle[0].y + middle[1].y) / 2;
  assert.ok(middleY < edgeY);
  for (const letter of edges) {
    assert.ok(letter.scaleX < 1);
    assert.ok(letter.scaleY < 1);
    assert.ok(Math.abs(letter.rotate) > 10);
  }
  for (const letter of middle) {
    assert.equal(letter.scaleX, 1);
    assert.ok(Math.abs(letter.rotate) < 10);
  }
  assert.match(lever, /PULL_LETTERS/);
  assert.match(lever, /className="pull-word"/);
});
