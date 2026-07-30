import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CELEBRATION_COLORS,
  CELEBRATION_DURATION_SCALE,
  CELEBRATION_FADE_DRIFT_X_VW,
  CELEBRATION_FADE_DRIFT_Y_VH,
  CELEBRATION_ORIGIN_X,
  CELEBRATION_RIBBONS,
  CELEBRATION_WEAK_RIBBON_COUNT,
  getCelebrationPhase,
  getCelebrationRibbonVisualShape,
} from "../lib/celebration";

test("uses a full-screen rainbow ribbon spray", () => {
  assert.equal(CELEBRATION_RIBBONS.length, 42);
  assert.deepEqual(
    new Set(CELEBRATION_RIBBONS.map((ribbon) => ribbon.color)),
    new Set(CELEBRATION_COLORS),
  );
  assert.deepEqual(
    new Set(CELEBRATION_RIBBONS.map((ribbon) => getCelebrationRibbonVisualShape(ribbon.shape))),
    new Set(["straight", "curve"]),
  );
  assert.equal(CELEBRATION_ORIGIN_X, 50);
  assert.ok(
    CELEBRATION_RIBBONS.every((ribbon) => ribbon.originX === CELEBRATION_ORIGIN_X),
    "every ribbon must launch from the bottom center",
  );
  assert.equal(CELEBRATION_DURATION_SCALE, 0.72);
  assert.equal(CELEBRATION_FADE_DRIFT_X_VW, 4);
  assert.equal(CELEBRATION_FADE_DRIFT_Y_VH, 6);
  assert.equal(
    CELEBRATION_RIBBONS.filter((ribbon) => ribbon.strength === "weak").length,
    CELEBRATION_WEAK_RIBBON_COUNT,
  );
  assert.ok(
    CELEBRATION_RIBBONS.filter((ribbon) => ribbon.strength === "weak")
      .every((ribbon) => ribbon.peakY >= -55 && ribbon.peakY <= -36),
    "weak ribbons must peak in the middle or lower-middle viewport",
  );
  for (const ribbon of CELEBRATION_RIBBONS) {
    assert.ok(ribbon.originX >= 0 && ribbon.originX <= 100);
    assert.ok(ribbon.originY >= 100, "ribbons must launch from below the viewport");
    if (ribbon.strength !== "weak") {
      assert.ok(ribbon.peakY <= -66, "full-strength ribbons must reach the upper third");
    }
    assert.ok(ribbon.peakY < ribbon.driftY, "ribbons must rise before drifting down");
    assert.ok(ribbon.duration >= 3.7 && ribbon.duration <= 4.7);
    assert.ok(ribbon.width >= 5 && ribbon.width <= 8);
    assert.ok(ribbon.length >= 23 && ribbon.length <= 37);
  }
});

test("moves ribbons smoothly while they fade", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const heldTransform = "transform: translate(var(--ribbon-peak-x), var(--ribbon-peak-y)) rotate(var(--ribbon-rotation)) scale(1)";
  const animation = css.match(/@keyframes celebration-ribbon-spray \{[^}]+\}(?:\s*\d+% \{[^}]+\})+/)?.[0] ?? "";

  assert.ok(animation.includes("45% { opacity: 1;"));
  assert.ok(animation.includes("67% { opacity: 1;"));
  assert.ok(animation.includes("animation-timing-function: linear;"));
  assert.equal(animation.split(heldTransform).length - 1, 2);
  assert.ok(animation.includes("100% { opacity: 0;"));
  assert.ok(animation.includes("translate(var(--ribbon-fade-x), var(--ribbon-fade-y)) rotate(var(--ribbon-rotation))"));
  assert.ok(!animation.includes("opacity: .72"));
  assert.ok(!animation.includes("opacity: .32"));
});

test("continues through generation and remains active after download is ready", () => {
  assert.equal(getCelebrationPhase({
    jobStatus: "PROCESSING",
    progress: 100,
    ready: false,
    submitting: false,
  }), "generating");
  assert.equal(getCelebrationPhase({
    jobStatus: "SUCCEEDED",
    progress: 100,
    ready: true,
    submitting: false,
  }), "ready");
  assert.equal(getCelebrationPhase({
    jobStatus: null,
    progress: 12,
    ready: false,
    submitting: false,
  }), "none");

  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.ok(!css.includes(".celebration-complete"));
});
