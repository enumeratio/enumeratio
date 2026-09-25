import { readFileSync } from "node:fs";
import { BigDecimal, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import type { ImageGolden } from "../scripts/collect-image-goldens.ts";
import { declareAnalytic } from "../src/index.ts";
import { ballImage, PROVEN_IMAGE_HEADS } from "../src/interval-balls.ts";

// Interval images proven over balls (src/interval-balls.ts), against mpmath's true images
// (tests/image.golden.json, from scripts/collect-image-goldens.ts): the least and greatest
// values at the ends and at every critical point inside, to 30 digits. The proven image must
// hold mpmath's -- with no slack at all -- and be tight to `TIGHT`, relative; and it must be
// what the head itself answers.

const goldens = JSON.parse(readFileSync(new URL("./image.golden.json", import.meta.url), "utf8")) as ImageGolden[];

const ce = new ComputeEngine();
declareAnalytic(ce);

/** How far inside mpmath's image, relative to its size, the proven one may reach past it. */
const TIGHT = new BigDecimal("1e-9");

/** A MathJSON number's decimal. */
const decimalOf = (json: unknown): BigDecimal =>
  new BigDecimal(typeof json === "number" ? String(json) : (json as { num: string }).num);

for (const { call, interval, least, greatest } of goldens) {
  const [head, ...args] = call as [string, ...(number | null)[]];
  const label = `${head}(${args.map((a) => a ?? `[${interval.join(", ")}]`).join(", ")})`;
  test(`${label}: holds mpmath's image, tightly, and is the head's answer`, () => {
    const argIndex = args.indexOf(null);
    expect(PROVEN_IMAGE_HEADS[head]).toBe(argIndex);
    const ops = args.map((a) => ce.number(a ?? 0));
    const image = ballImage(head, ops, argIndex, ce.number(interval[0]), ce.number(interval[1]));
    expect(image).toBeDefined();
    const [lo, hi] = [new BigDecimal(least), new BigDecimal(greatest)];
    expect(image!.lo.lte(lo) && hi.lte(image!.hi), `${image!.lo.toString()} … ${image!.hi.toString()}`).toBe(true);
    const size = lo.abs().gt(hi.abs()) ? lo.abs() : hi.abs();
    const slack = size.mul(TIGHT);
    expect(lo.sub(image!.lo).lte(slack) && image!.hi.sub(hi).lte(slack), "tight").toBe(true);
    const json = [head, ...args.map((a) => a ?? ["Interval", ...interval])];
    const answer = ce.box(json as never).evaluate();
    expect(answer.operator).toBe("Interval");
    expect(operandsOf(answer).map((end) => decimalOf(end.json).toString())).toEqual([
      image!.lo.toString(),
      image!.hi.toString(),
    ]);
  });
}

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
