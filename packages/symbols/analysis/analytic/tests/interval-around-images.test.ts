import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// enumeratio/enumeratio#113 §2: images of an Interval, and first-order Around propagation,
// across the circular/inverse-circular/hyperbolic/Exp/log heads, Abs/Sign/Sqrt/Max/Min, and
// the special functions with aspirational examples in packages/reference/src/entries. Every
// case here is one of those reference entries' pinned examples — direct toEqual against exact
// MathJSON (golden values), never a snapshot. See tagged-calculus.ts for the shared
// derivative-sign-and-bisection rule both directions of this file share.

const ce = new ComputeEngine();
declareAnalytic(ce);

const json = (expr: unknown) => ce.box(expr as never).evaluate().json;

/** A plain double for one numeric leaf of an N()'d expression -- `.N()` on an out-of-range
 * or high-precision value serializes as `{num: "…"}`, not a bare JS number. */
const numAt = (expr: unknown, path: readonly number[]): number => {
  let node: unknown = ce.box(expr as never).N().json;
  for (const i of path) node = (node as readonly unknown[])[i];
  if (typeof node === "number") return node;
  if (
    typeof node === "object" &&
    node !== null &&
    typeof (node as { num?: unknown }).num === "string"
  ) {
    return Number((node as { num: string }).num);
  }
  throw new Error(`not a numeric leaf: ${JSON.stringify(node)}`);
};

/** Two floats agree up to the last-digit platform noise `settled()` also tolerates in the
 * reference test suite (packages/reference/tests/entries.test.ts). */
const closeTo = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));

test("Interval: monotonic images across the circular and inverse-circular heads", () => {
  expect(json(["Sin", ["Interval", ["Negate", ["Divide", "Pi", 6]], ["Divide", "Pi", 6]]])).toEqual(
    ["Interval", ["Rational", -1, 2], ["Rational", 1, 2]],
  );
  expect(json(["Cos", ["Interval", ["Divide", "Pi", 3], ["Divide", "Pi", 2]]])).toEqual([
    "Interval",
    0,
    ["Rational", 1, 2],
  ]);
  expect(json(["Tan", ["Interval", 0, ["Divide", "Pi", 3]]])).toEqual(["Interval", 0, ["Sqrt", 3]]);
  expect(json(["Arcsin", ["Interval", ["Rational", -1, 3], ["Rational", 1, 2]]])).toEqual([
    "Interval",
    ["Arcsin", ["Rational", -1, 3]],
    ["Multiply", ["Rational", 1, 6], "Pi"],
  ]);
  expect(json(["Arccos", ["Interval", ["Rational", 1, 3], ["Rational", 1, 2]]])).toEqual([
    "Interval",
    ["Multiply", ["Rational", 1, 3], "Pi"],
    ["Arccos", ["Rational", 1, 3]],
  ]);
  expect(json(["Arctan", ["Interval", -1, 3]])).toEqual([
    "Interval",
    ["Multiply", ["Rational", -1, 4], "Pi"],
    ["Arctan", 3],
  ]);
});

test("Interval: hyperbolic, Exp, Ln and Sqrt images", () => {
  expect(json(["Tanh", ["Interval", 0, ["Ln", 2]]])).toEqual(["Interval", 0, ["Rational", 3, 5]]);
  expect(json(["Exp", ["Interval", -1, ["Ln", 2]]])).toEqual([
    "Interval",
    ["Divide", 1, "ExponentialE"],
    2,
  ]);
  expect(json(["Sqrt", ["Interval", 1, 8]])).toEqual(["Interval", 1, ["Multiply", 2, ["Sqrt", 2]]]);
});

test("Interval: Sin/Cos over an unbounded interval is the oscillation range [-1, 1]", () => {
  expect(json(["Sin", ["Interval", "NegativeInfinity", "PositiveInfinity"]])).toEqual([
    "Interval",
    -1,
    1,
  ]);
});

test("Interval: a trig head declines rather than guess across a pole it straddles", () => {
  // Cot has a pole at 0, inside [-π/4, π/4] — Wolfram's own answer is a Union of two
  // unbounded intervals, out of scope for a rule that returns one Interval (see interval.ts's
  // `hasPoleBetween`). The point of this test is only that it is NOT a wrong bounded
  // Interval answer -- whatever compute-engine's own native Cot does with a set argument
  // otherwise (declines to a plain unevaluated call, or its own type error) is out of scope
  // here.
  const result = ce
    .box(["Cot", ["Interval", ["Negate", ["Divide", "Pi", 4]], ["Divide", "Pi", 4]]])
    .evaluate();
  expect(result.operator).not.toBe("Interval");
});

test("Interval: Abs/Sign/Max/Min, and Γ's interior extremum", () => {
  expect(json(["Sign", ["Interval", 1, 3]])).toEqual(1);
  expect(json(["Max", ["Interval", 1, 3], ["Interval", -3, 5]])).toEqual(["Interval", 1, 5]);
  expect(json(["Min", ["Interval", 1, 3], ["Interval", -3, 5]])).toEqual(["Interval", -3, 3]);
  // Γ's minimum at x₀ ≈ 1.4616 sits inside [1.4, 1.5]: the lower endpoint is Γ(x₀), not
  // min(Γ(1.4), Γ(1.5)) — this is `imageOverArg`'s bisected-extremum path, not just a sorted
  // pair of endpoint evaluations.
  const gamma = ["Gamma", ["Interval", 1.4, 1.5]];
  expect(ce.box(gamma as never).evaluate().operator).toBe("Interval");
  closeTo(numAt(gamma, [1]), 0.8856031944108887);
  closeTo(numAt(gamma, [2]), 0.8872638175030753);
});

test("Interval: multi-argument special functions image over one fixed argument position", () => {
  const stieltjes = ["StieltjesGamma", 2, ["Interval", 2.34, 2.35]];
  closeTo(numAt(stieltjes, [1]), -0.06724128035508715);
  closeTo(numAt(stieltjes, [2]), -0.06514040366307242);

  const dirichletL = ["DirichletL", 5, 1, ["Interval", 1.23, 1.24]];
  closeTo(numAt(dirichletL, [1]), 4.113958567039058);
  closeTo(numAt(dirichletL, [2]), 4.25898895010849);

  const binomial = ["Binomial", ["Rational", 1, 2], ["Interval", 0.5, 0.6]];
  closeTo(numAt(binomial, [1]), 0.9281455538507054);
  closeTo(numAt(binomial, [2]), 1);
});

test("Around: propagation across trig, inverse-trig, hyperbolic and log heads", () => {
  expect(json(["Sin", ["Around", 2, 0.01]])).toEqual([
    "Around",
    0.9092974268256817,
    0.004161468365471424,
  ]);
  expect(json(["Cot", ["Around", 3, 0.01]])).toEqual([
    "Around",
    -7.015252551434534,
    0.5021376836040873,
  ]);
  const arcsin = json(["Arcsin", ["Around", 0.9, 0.1]]) as [string, number, number];
  expect(arcsin[0]).toBe("Around");
  closeTo(arcsin[1], 1.1197695149986342);
  closeTo(arcsin[2], 0.2294157338705618);
  expect(json(["Ln", ["Around", 2, 0.01]])).toEqual(["Around", 0.6931471805599453, 0.005]);
});

test("Around: propagation across Γ, Erf/Erfc/ErfInv, and multi-argument heads at a fixed position", () => {
  const gammaAround = json(["Gamma", ["Around", 2.5, 0.01]]) as [string, number, number];
  expect(gammaAround[0]).toBe("Around");
  closeTo(gammaAround[1], 1.329340388179137);
  closeTo(gammaAround[2], 0.009347345216260856);
  expect(json(["Erfc", ["Around", 2, 0.01]])).toEqual([
    "Around",
    0.004677734981047266,
    0.00020666985354092054,
  ]);
  // HarmonicNumber's derivative in the order falls back to a central difference (compute-
  // engine's own D doesn't resolve it — see tagged-calculus.ts), so its delta only agrees to
  // that method's precision, looser than the 1e-9 relative tolerance `closeTo` uses elsewhere.
  const harmonic = json(["HarmonicNumber", ["Rational", 3, 2], ["Around", 2.1, 0.01]]) as [
    string,
    number,
    number,
  ];
  expect(harmonic[0]).toBe("Around");
  expect(harmonic[1]).toBeCloseTo(1.1455164340491326, 9);
  expect(harmonic[2]).toBeCloseTo(0.0008799826466981091, 6);
  expect(json(["HurwitzZeta", 2, ["Around", 0.5, 0.01]])).toEqual([
    "Around",
    4.934802200544679,
    0.1682879664423432,
  ]);
});

test("N(): the E-base Power rule still fires once N() has decimalized the base (issue #113 fix)", () => {
  // Before the fix, N() turned ExponentialE into a double BEFORE the Power resolver's
  // `isSame(ce.E)` check ever ran, so N(Exp(Around(0, 0.1))) stayed unevaluated even though
  // plain evaluate() already gave Around(1, 0.1). tagged-arithmetic.ts's Resolver now also
  // gets the pre-numericization operand (`raw`) to check against.
  expect(json(["Exp", ["Around", 0, 0.1]])).toEqual(["Around", 1, 0.1]);
  expect(ce.box(["N", ["Exp", ["Around", 0, 0.1]]] as never).evaluate().json).toEqual([
    "Around",
    1,
    0.1,
  ]);
});
