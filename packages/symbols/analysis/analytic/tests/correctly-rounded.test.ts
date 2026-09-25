import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/index.ts";
import { refinementOf } from "../src/correctly-rounded.ts";

// `N(x, d)` by Ziv's loop (see correctly-rounded.ts): d digits, the last correctly rounded,
// and the working precision left alone.

const ce = new ComputeEngine();
declareAnalytic(ce);
const n = (x: unknown, d: number) => ce.box(["N", x, d] as never).evaluate();

test("the last digit is correctly rounded where d digits alone round it wrong", () => {
  // At exactly 30 digits compute-engine gives …185059; the true value is 1.175201193643801456882381850595…
  expect(n(["Sinh", 1], 30).json).toEqual({ num: "1.1752011936438014568823818506" });
});

test("the answer carries d digits and the working precision is restored", () => {
  const precision = ce.precision;
  expect(n("Pi", 40).json).toEqual({ num: "3.141592653589793238462643383279502884197" });
  expect(ce.precision).toBe(precision);
  expect(n("Pi", 5).json).toBe(3.1416);
});

test("ties round to even", () => {
  expect(n(["Rational", 1, 8], 2).json).toBe(0.12);
  expect(n(["Rational", 3, 8], 2).json).toBe(0.38);
});

test("a list or a symbolic result is rounded number by number, integers left alone", () => {
  expect(n(["List", "Pi", "ExponentialE"], 3).json).toEqual(["List", 3.14, 2.72]);
  expect(n(["Power", ["Add", "x", "Pi"], 2], 4).json).toEqual(["Power", ["Add", "x", 3.142], 2]);
});

test("the finest reading is kept beside the answer", () => {
  const answer = n(["Sqrt", 2], 10);
  expect(answer.json).toBe(1.414213562);
  const finest = refinementOf(answer);
  // The two readings, at 20 and 30 digits, agreed at once: the finer one is kept.
  expect(finest?.json).toEqual({ num: "1.41421356237309504880168872421" });
});

test("a head that answers in doubles is rounded up to a double's digits, and left alone past them", () => {
  // compute-engine holds a complex number as two doubles, so complex ζ is a double reading.
  expect(n(["Zeta", ["Complex", 2, 1]], 10).json).toEqual(["Complex", 1.150355703, -0.4375308659]);
  const past = n(["Zeta", ["Complex", 2, 1]], 25).json;
  expect(past).toEqual(["Complex", 1.1503557032549028, -0.4375308659196079]);
});
