// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal, ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";
import { hypergeometric3F2RegularizedBig } from "../src/hypergeometric-big.ts";

// 3F2Regularized past a double's digits, at 50 digits against mpmath (mp.dps = 120, the series with
// rgamma per term, so the poles of Γ(b) are covered; hyp3f2/Γ(b₁)Γ(b₂) agrees where it applies).
// 45 digits are compared: the last few carry the guard.

const COMPARED = 45;
const d = (x: string | number) => new BigDecimal(x);
const at = <T>(digits: number, fn: () => T): T => {
  const saved = BigDecimal.precision;
  BigDecimal.precision = digits;
  try {
    return fn();
  } finally {
    BigDecimal.precision = saved;
  }
};
const f3 = (upper: [string, string, string], lower: [string, string], z: string, digits = 50) =>
  at(70, () =>
    hypergeometric3F2RegularizedBig(
      upper.map((x) => d(x)) as [BigDecimal, BigDecimal, BigDecimal],
      lower.map((x) => d(x)) as [BigDecimal, BigDecimal],
      d(z),
      digits,
    ),
  );
const agrees = (ours: BigDecimal | undefined, expected: string): void => {
  expect(ours?.toPrecision(COMPARED).toString()).toBe(d(expected).toPrecision(COMPARED).toString());
};

test("3F2Regularized: inside the unit disc, either sign of z, near the rim", () => {
  agrees(f3(["1", "1", "1"], ["2", "3"], "0.5"), "0.5507754140499156306397768832357133536393972183327634");
  agrees(f3(["0.5", "1", "1.5"], ["2", "2.5"], "-0.4"), "0.7125415161247438409324496105919186165754431507821287");
  agrees(f3(["1", "2", "3"], ["4", "5"], "-0.9"), "0.005547369220272858850575351128028093469733918785560187");
  agrees(f3(["2", "3", "4"], ["-1.5", "0.5"], "0.1"), "31.73589053394100230411661772440063886856585127477485");
});

test("3F2Regularized: a lower parameter at a pole of Γ, and polynomial cases", () => {
  // 1/Γ kills the first terms, so the sum starts later; either lower parameter, both at 0.
  const v = "0.1329350004078757233631696395670801932294994820814527";
  agrees(f3(["1", "1", "1"], ["-1", "2"], "0.3"), v);
  agrees(f3(["1", "1", "1"], ["2", "-1"], "0.3"), v);
  expect(f3(["1", "1", "1"], ["0", "0"], "0.5")?.toPrecision(20).toString()).toBe("6");
  // An upper parameter at a non-positive integer terminates the series.
  expect(f3(["-2", "1", "1"], ["3", "4"], "-0.5")?.toPrecision(20).toString()).toBe("0.090625");
});

test("3F2Regularized: on or past the rim stays undeclared", () => {
  expect(f3(["1", "1", "1"], ["2", "3"], "1")).toBeUndefined();
  expect(f3(["1", "1", "1"], ["2", "3"], "-1")).toBeUndefined();
  expect(f3(["1", "1", "1"], ["2", "3"], "1.2")).toBeUndefined();
});

const ce = new ComputeEngine();
declareAnalytic(ce);
const n = (expr: unknown, digits: number) => ce.box(["N", expr, digits] as never).evaluate();

test("N(3F2Regularized, d) boxes the answer, and declines a complex z or |z| ≥ 1", () => {
  expect(n(["Hypergeometric3F2Regularized", 1, 1, 1, 2, 3, ["Rational", 1, 2]], 30).json).toEqual({
    num: "0.550775414049915630639776883236",
  });
  for (const z of [["Complex", 0.3, 0.2], 1.2, 1]) {
    expect(n(["Hypergeometric3F2Regularized", 1, 1, 1, 2, 3, z], 30).operator).toBe("Hypergeometric3F2Regularized");
  }
});
