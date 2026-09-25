import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// The Wolfram Function* real-analysis property family (function-properties.ts): every
// result here is a closed-form calculus fact about a small, closed set of recognized
// shapes (polynomial, rational, sqrt/log/exp/trig of an affine or quadratic argument),
// so the golden file is exact symbolic MathJSON, cross-checked against `wolframscript`
// by hand (see the reference entries and PR description) rather than a numeric oracle.
// Golden data per repo convention -- never `toMatchSnapshot`.

interface GoldenCase {
  readonly id: string;
  readonly head: string;
  readonly args: readonly unknown[];
  readonly expected: unknown;
}

const ce = new ComputeEngine();
declareAnalytic(ce);
ce.declare("x", { type: "real" });
ce.declare("y", { type: "real" });

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./function-properties.golden.json", import.meta.url), "utf8"),
);

for (const g of goldens) {
  test(`${g.head} example/${g.id}`, () => {
    const result = ce.box([g.head, ...g.args] as never).evaluate();
    expect(result.json).toEqual(g.expected);
  });
}

test("every golden case's id is unique", () => {
  const ids = goldens.map((g) => g.id);
  expect(new Set(ids).size).toBe(ids.length);
});
