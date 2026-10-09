import { ComputeEngine } from "@enumeratio/engine/unstable"; // unstable: the same engine the other analytic tests use
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Hypergeometric3F2Regularized at a double's digits: the claim pr118-hypergeometric
// (review-claims.tsv). mpmath: 0.2543049729547402391 (the committed oracle value, from
// hyp3f2-by-series with rgamma per term; the pole of Γ at the lower parameter −1 is in play).

const ce = new ComputeEngine();
declareAnalytic(ce);

const MPMATH = 0.2543049729547402; // 0.2543049729547402391 to a double's digits
const ULP = 2 ** -54; // spacing of doubles in [0.25, 0.5)
const e = ce.box(["Hypergeometric3F2Regularized", 1, 2, 3, 4, -1, ["Rational", 1, 3]]);

test("N() and N(x, d) agree with mpmath to 2 ulp at a lower parameter of −1", () => {
  expect(Math.abs((e.N().re as number) - MPMATH)).toBeLessThanOrEqual(2 * ULP);
  const at17 = ce.box(["N", e.json, 17]).evaluate();
  expect(Math.abs(Number(at17.re) - MPMATH)).toBeLessThanOrEqual(2 * ULP);
  const at20 = ce.box(["N", e.json, 20]).evaluate();
  expect(String((at20.json as { num: string }).num).slice(0, 19)).toBe("0.25430497295474023");
});

test("evaluate() without N leaves the exact expression alone", () => {
  expect(e.evaluate().operator).toBe("Hypergeometric3F2Regularized");
});

test("a series that cannot settle in its term budget declines rather than answering", () => {
  const rim = ce.box(["Hypergeometric3F2Regularized", 1, 2, 3, 4, 5, 0.999]);
  expect(rim.N().operator).toBe("Hypergeometric3F2Regularized");
});
