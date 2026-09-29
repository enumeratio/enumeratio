import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/index.ts";
import { ballImage } from "../src/interval-balls.ts";

// Interval images proven over balls (src/interval-balls.ts). What each head answers, and that it
// holds mpmath's true image tightly, are examples on the heads' records (`known` values); here
// is what the kernel declines.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("an end that isn't exact, a kernel that can't reach, or a proof too loose, is left to sampling", () => {
  expect(ballImage("BarnesG", [ce.number(0)], 0, ce.box("Pi"), ce.number(4))).toBeUndefined();
  // |z| ≥ 1 is past the Lerch series.
  const ops = [ce.number(2), ce.number(0)];
  expect(ballImage("PolyLog", ops, 1, ce.number(0.5), ce.number(1.5))).toBeUndefined();
  // Li₋₃ = Σ n³zⁿ over most of the disk: a ball this wide overstates the series by orders of
  // magnitude, and the budget runs out before the image is tight.
  const negative = [ce.number(-3), ce.number(0)];
  expect(ballImage("PolyLog", negative, 1, ce.number(-0.9), ce.number(0.2))).toBeUndefined();
});

test("Zeta right of its pole is decreasing: an exact image, from its shape", () => {
  expect(ce.box(["Zeta", ["Interval", 2, 3]]).evaluate().json).toEqual([
    "Interval",
    ["Zeta", 3],
    ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
  ]);
});
