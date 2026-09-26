import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// CaputoD — see caputo-derivative.ts for the table and its scope. Expected values are
// each verified against `wolframscript`'s own `CaputoD` AND independently against direct
// numerical fractional integration (`mpmath.quad` on the Caputo definition), so they're
// inlined here (exact structural MathJSON) rather than a numeric golden file.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalOf = (mj: unknown) => ce.box(mj as never).evaluate().json;

test("CaputoD: power function, general case", () => {
  // Gamma(3)/Gamma(2.5) * x^1.5 = 1.5045055561273502 * x^1.5 (matches wolframscript and mpmath.quad)
  expect(evalOf(["CaputoD", ["Power", "x", 2], ["List", "x", 0.5]])).toEqual([
    "Multiply",
    { num: "1.504505556127350098532" },
    ["Power", "x", 1.5],
  ]);
});

test("CaputoD: constants vanish", () => {
  expect(evalOf(["CaputoD", 5, ["List", "x", 0.5]])).toBe(0);
});

test("CaputoD: the integer edge case vanishes (beta a nonnegative integer < n)", () => {
  // beta=1, alpha=1.5, n=ceil(1.5)=2, 1 < 2: f''(t)=0 for f(t)=t, so the Caputo
  // integral is identically 0 (confirmed against mpmath.quad on the definition) —
  // Wolfram's own CaputoD leaves this symbolic rather than reducing it.
  expect(evalOf(["CaputoD", "x", ["List", "x", 1.5]])).toBe(0);
});

test("CaputoD: linearity over a polynomial", () => {
  expect(evalOf(["CaputoD", ["Add", ["Power", "x", 2], ["Multiply", 3, "x"], 1], ["List", "x", 0.5]])).toEqual([
    "Add",
    ["Multiply", { num: "1.504505556127350098532" }, ["Power", "x", 1.5]],
    ["Multiply", { num: "3.3851375012865377217" }, ["Sqrt", "x"]],
  ]);
});

test("CaputoD: declines outside its scope", () => {
  // e^(ax) needs Mittag-Leffler; no MittagLefflerE head exists, so it declines.
  // (CaputoD is declared `lazy`, so a declined call's arguments stay exactly as given —
  // `Exp` isn't canonicalized to `Power(ExponentialE, ...)` the way it would be under
  // ordinary evaluation.)
  expect(evalOf(["CaputoD", ["Exp", ["Multiply", "a", "x"]], ["List", "x", 0.5]])).toEqual([
    "CaputoD",
    ["Exp", ["Multiply", "a", "x"]],
    ["List", "x", 0.5],
  ]);
  // A base-point singularity (x^-1 at 0) declines.
  expect(evalOf(["CaputoD", ["Power", "x", -1], ["List", "x", 0.5]])).toEqual([
    "CaputoD",
    ["Power", "x", -1],
    ["List", "x", 0.5],
  ]);
});
