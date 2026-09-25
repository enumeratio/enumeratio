import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";
import { NOT_RIGOROUS } from "../src/interval.ts";

// A containment property test for every head interval.ts extends: `f(Interval(l, h))`, where
// it doesn't decline, must be a superset of `{f(x) : x ∈ [l, h]}` — never an interval that
// misses part of the true image (the enumeratio/enumeratio#113 §2 coordinator review bug:
// `Cos(Interval(-1, 4))` narrowed to the two endpoints' values instead of the true `[-1, 1]`,
// because a naive derivative-sign check only finds one interior extremum, and this range
// crosses two, π/2 and π). Random sub-intervals, deliberately including wide ones spanning
// several periods for the periodic heads, catch what a handful of hand-picked examples won't.
//
// Containment is EXACT for every head interval.ts claims is rigorous: the true value at each
// sample point -- computed at compute-engine's working precision and rounded to the nearest
// double -- must lie inside the result, with no slack at all. (Sound in doubles: a result's
// upper bound is a double at or above the true value, so it is at or above the nearest double
// too, and likewise below.) Only the heads in `NOT_RIGOROUS`, whose images come from sampling,
// get a small tolerance -- their result can miss an extremum between two samples, and this is
// not the test that would prove otherwise.
//
// A deterministic PRNG (mulberry32), not Math.random(): a flaky property test is worse than no
// property test, and reproducing a failure needs the same seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ce = new ComputeEngine();
declareAnalytic(ce);

const DEFAULT_SUB_INTERVALS = 200;
const POINTS_PER_INTERVAL = 12;

/** One head's containment check: `buildCall(l, h)` is the full expression with the Interval
 * argument at `l..h`; `pointCall(x)` is the same call with a plain point `x` substituted at
 * that position (other arguments identical, so only the target argument varies). `domain`
 * bounds the random `l`/`h` this samples — callers pass a wide-enough range to include several
 * periods for a periodic head, or stay inside a restricted domain (Ln, Arcsin, Sqrt) for
 * others. `subIntervals` defaults to 200; the special-function block below passes a smaller
 * count for the heads whose image rule runs a golden-section search per trial (Gamma's
 * interior extremum, and every numeric-fallback-derivative head, where even the MONOTONIC
 * case costs two function evaluations per sign sample) — still exercising the same property,
 * just within a reasonable test-suite wall-clock budget. */
function checkContainment(
  label: string,
  rng: () => number,
  domain: readonly [number, number],
  buildCall: (l: number, h: number) => unknown,
  pointCall: (x: number) => unknown,
  subIntervals = DEFAULT_SUB_INTERVALS,
): void {
  // The head actually called -- a label can be descriptive ("BetaRegularized (interval in x…").
  const head = (buildCall(domain[0], domain[1]) as readonly unknown[])[0] as string;
  const rigorous = !NOT_RIGOROUS.includes(head);
  const [lo, hi] = domain;
  let checked = 0;
  let declined = 0;
  for (let trial = 0; trial < subIntervals; trial++) {
    const a = lo + rng() * (hi - lo);
    const b = lo + rng() * (hi - lo);
    const l = Math.min(a, b);
    const h = Math.max(a, b);
    if (h - l < 1e-9) continue; // degenerate, not interesting
    const result = ce.box(buildCall(l, h) as never).evaluate();
    // An image is one interval, a Union of disjoint ones (a periodic head across a pole), or a
    // plain scalar (Sign: every point in range shares one sign).
    const pieces: [number, number][] = [];
    const pieceOf = (e: typeof result): [number, number] | undefined => {
      const ends = operandsOf(e);
      return ends.length === 2 ? [ends[0]!.N().re, ends[1]!.N().re] : undefined;
    };
    if (result.operator === "Interval") {
      const piece = pieceOf(result);
      if (piece === undefined) continue;
      pieces.push(piece);
    } else if (result.operator === "Union") {
      for (const part of operandsOf(result)) {
        const piece = part.operator === "Interval" ? pieceOf(part) : undefined;
        if (piece !== undefined) pieces.push(piece);
      }
    } else {
      const scalar = result.N().re;
      if (!Number.isFinite(scalar)) {
        declined++;
        continue; // declined: nothing to check containment against
      }
      pieces.push([scalar, scalar]);
    }
    if (pieces.length === 0 || pieces.some(([a, b]) => Number.isNaN(a) || Number.isNaN(b))) {
      continue;
    }
    const [resultLo, resultHi] = [pieces[0]![0], pieces.at(-1)![1]];
    checked++;
    const eps = rigorous ? 0 : 1e-6 * Math.max(1, Math.abs(resultLo), Math.abs(resultHi));
    const shown = pieces.map(([a, b]) => `[${a}, ${b}]`).join(" ∪ ");
    for (let p = 0; p < POINTS_PER_INTERVAL; p++) {
      // The last point is `h` itself: `l + (h - l)` can round an ulp past it, outside the
      // interval under test.
      const x = p === POINTS_PER_INTERVAL - 1 ? h : l + ((h - l) * p) / (POINTS_PER_INTERVAL - 1);
      const value = ce.box(pointCall(x) as never).N().re;
      if (!Number.isFinite(value)) continue; // a pole the sample happened to land on
      const inside = pieces.some(([a, b]) => value >= a - eps && value <= b + eps);
      expect(inside, `${label}: f(${x}) = ${value} outside ${shown} from Interval(${l}, ${h})`).toBe(true);
    }
  }
  // Every head must actually be exercised — an always-declining rule would pass vacuously.
  expect(checked, `${label}: no trial produced an Interval to check`).toBeGreaterThan(0);
}

test("Interval containment: periodic heads over ranges spanning several periods", () => {
  const rng = mulberry32(1);
  for (const head of ["Sin", "Cos"] as const) {
    checkContainment(
      head,
      rng,
      [-10, 10],
      (l, h) => [head, ["Interval", l, h]],
      (x) => [head, x],
    );
  }
  // Tan/Cot/Sec/Csc: most wide random sub-intervals of [-10, 10] straddle a pole and decline
  // (checked's own assertion still requires at least one trial DIDN'T decline).
  for (const head of ["Tan", "Cot", "Sec", "Csc"] as const) {
    checkContainment(
      head,
      rng,
      [-10, 10],
      (l, h) => [head, ["Interval", l, h]],
      (x) => [head, x],
    );
  }
});

test("Interval containment: inverse-circular, hyperbolic, Exp/Ln, Sqrt", () => {
  const rng = mulberry32(2);
  checkContainment(
    "Arcsin",
    rng,
    [-1, 1],
    (l, h) => ["Arcsin", ["Interval", l, h]],
    (x) => ["Arcsin", x],
  );
  checkContainment(
    "Arccos",
    rng,
    [-1, 1],
    (l, h) => ["Arccos", ["Interval", l, h]],
    (x) => ["Arccos", x],
  );
  checkContainment(
    "Arctan",
    rng,
    [-20, 20],
    (l, h) => ["Arctan", ["Interval", l, h]],
    (x) => ["Arctan", x],
  );
  checkContainment(
    "Sinh",
    rng,
    [-5, 5],
    (l, h) => ["Sinh", ["Interval", l, h]],
    (x) => ["Sinh", x],
  );
  checkContainment(
    "Tanh",
    rng,
    [-5, 5],
    (l, h) => ["Tanh", ["Interval", l, h]],
    (x) => ["Tanh", x],
  );
  checkContainment(
    "Ln",
    rng,
    [0.01, 20],
    (l, h) => ["Ln", ["Interval", l, h]],
    (x) => ["Ln", x],
  );
  checkContainment(
    "Sqrt",
    rng,
    [0, 30],
    (l, h) => ["Sqrt", ["Interval", l, h]],
    (x) => ["Sqrt", x],
  );
  checkContainment(
    "Exp (Power base E)",
    rng,
    [-5, 5],
    (l, h) => ["Power", "ExponentialE", ["Interval", l, h]],
    (x) => ["Power", "ExponentialE", x],
  );
});

test("Interval containment: Abs, Sign, Max, Min", () => {
  const rng = mulberry32(3);
  checkContainment(
    "Abs",
    rng,
    [-10, 10],
    (l, h) => ["Abs", ["Interval", l, h]],
    (x) => ["Abs", x],
  );
  // Sign declines whenever the interval straddles or touches 0 -- restrict to strictly
  // positive/negative domains so most trials produce an answer to check.
  checkContainment(
    "Sign (positive domain)",
    rng,
    [0.1, 10],
    (l, h) => ["Sign", ["Interval", l, h]],
    (x) => ["Sign", x],
  );
  checkContainment(
    "Max (against a fixed Interval)",
    rng,
    [-10, 10],
    (l, h) => ["Max", ["Interval", l, h], ["Interval", -3, 5]],
    (x) => ["Max", x, ["Interval", -3, 5]],
  );
  checkContainment(
    "Min (against a fixed Interval)",
    rng,
    [-10, 10],
    (l, h) => ["Min", ["Interval", l, h], ["Interval", -3, 5]],
    (x) => ["Min", x, ["Interval", -3, 5]],
  );
});

test("Interval containment: the special-function family, including Γ's interior extremum", () => {
  const rng = mulberry32(4);
  // A domain deliberately wide enough to sometimes straddle Γ's minimum at x₀ ≈ 1.4616 --
  // this is the case the coordinator's own bug report is about getting right.
  checkContainment(
    "Gamma",
    rng,
    [0.5, 3],
    (l, h) => ["Gamma", ["Interval", l, h]],
    (x) => ["Gamma", x],
    40,
  );
  checkContainment(
    "GammaLn",
    rng,
    [0.5, 5],
    (l, h) => ["GammaLn", ["Interval", l, h]],
    (x) => ["GammaLn", x],
    40,
  );
  checkContainment(
    "Digamma",
    rng,
    [0.5, 5],
    (l, h) => ["Digamma", ["Interval", l, h]],
    (x) => ["Digamma", x],
    40,
  );
  checkContainment(
    "BarnesG",
    rng,
    [1, 3],
    (l, h) => ["BarnesG", ["Interval", l, h]],
    (x) => ["BarnesG", x],
    40,
  );
  checkContainment(
    "DirichletEta",
    rng,
    [1.1, 5],
    (l, h) => ["DirichletEta", ["Interval", l, h]],
    (x) => ["DirichletEta", x],
    40,
  );
  checkContainment(
    "DirichletBeta",
    rng,
    [0.5, 5],
    (l, h) => ["DirichletBeta", ["Interval", l, h]],
    (x) => ["DirichletBeta", x],
    40,
  );
  checkContainment(
    "Erf",
    rng,
    [-3, 3],
    (l, h) => ["Erf", ["Interval", l, h]],
    (x) => ["Erf", x],
    40,
  );
  checkContainment(
    "Erfc",
    rng,
    [-3, 3],
    (l, h) => ["Erfc", ["Interval", l, h]],
    (x) => ["Erfc", x],
    40,
  );
  checkContainment(
    "ErfInv",
    rng,
    [-0.9, 0.9],
    (l, h) => ["ErfInv", ["Interval", l, h]],
    (x) => ["ErfInv", x],
    40,
  );
  checkContainment(
    "Zeta",
    rng,
    [1.1, 5],
    (l, h) => ["Zeta", ["Interval", l, h]],
    (x) => ["Zeta", x],
    40,
  );
});

test("Interval containment: multi-argument special functions at a fixed argument position", () => {
  const rng = mulberry32(5);
  checkContainment(
    "StieltjesGamma (order 2, interval in a)",
    rng,
    [1, 4],
    (l, h) => ["StieltjesGamma", 2, ["Interval", l, h]],
    (x) => ["StieltjesGamma", 2, x],
    40,
  );
  checkContainment(
    "HarmonicNumber (order 0.2, interval in r)",
    rng,
    [1.5, 4],
    (l, h) => ["HarmonicNumber", 0.2, ["Interval", l, h]],
    (x) => ["HarmonicNumber", 0.2, x],
    40,
  );
  checkContainment(
    "DirichletL (5, 1, interval in s)",
    rng,
    [1.1, 3],
    (l, h) => ["DirichletL", 5, 1, ["Interval", l, h]],
    (x) => ["DirichletL", 5, 1, x],
    40,
  );
  checkContainment(
    "PolyGamma (order 1, interval in z)",
    rng,
    [1, 5],
    (l, h) => ["PolyGamma", 1, ["Interval", l, h]],
    (x) => ["PolyGamma", 1, x],
    40,
  );
  checkContainment(
    "PolyLog (order 2, interval in z)",
    rng,
    [0.1, 0.9],
    (l, h) => ["PolyLog", 2, ["Interval", l, h]],
    (x) => ["PolyLog", 2, x],
    40,
  );
  checkContainment(
    "GammaRegularized (a = 2/5, interval in z)",
    rng,
    [0.05, 2],
    (l, h) => ["GammaRegularized", ["Rational", 2, 5], ["Interval", l, h]],
    (x) => ["GammaRegularized", ["Rational", 2, 5], x],
    40,
  );
  checkContainment(
    "BetaRegularized (interval in x, a=2, b=1)",
    rng,
    [0.05, 0.95],
    (l, h) => ["BetaRegularized", ["Interval", l, h], 2, 1],
    (x) => ["BetaRegularized", x, 2, 1],
    40,
  );
  checkContainment(
    "Binomial (n=1/2, interval in k)",
    rng,
    [0.1, 3],
    (l, h) => ["Binomial", ["Rational", 1, 2], ["Interval", l, h]],
    (x) => ["Binomial", ["Rational", 1, 2], x],
    40,
  );
});

test("Interval containment: Cosh's valley, Log in any base, and ln Γ through the kernel", () => {
  const rng = mulberry32(6);
  checkContainment(
    "Cosh",
    rng,
    [-3, 3],
    (l, h) => ["Cosh", ["Interval", l, h]],
    (x) => ["Cosh", x],
  );
  for (const base of [2, 10, 0.5]) {
    checkContainment(
      "Log",
      rng,
      [0.01, 20],
      (l, h) => ["Log", ["Interval", l, h], base],
      (x) => ["Log", x, base],
      60,
    );
  }
  // Both sides of Γ's minimum at 1.4616…: ln Γ decreases on (0, x₀) and increases after it.
  checkContainment(
    "LogGamma",
    rng,
    [0.05, 6],
    (l, h) => ["LogGamma", ["Interval", l, h]],
    (x) => ["LogGamma", x],
    60,
  );
});

test("Interval containment: periodic heads across their poles come back as unions", () => {
  const rng = mulberry32(7);
  for (const head of ["Tan", "Cot", "Sec", "Csc"] as const) {
    checkContainment(
      head,
      rng,
      [-4, 4],
      (l, h) => [head, ["Interval", l, h]],
      (x) => [head, x],
      80,
    );
  }
});
