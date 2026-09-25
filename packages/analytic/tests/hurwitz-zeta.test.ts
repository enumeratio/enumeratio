import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget, WGSLTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { bernoulliRational } from "../src/bernoulli.ts";
import {
  declareAnalytic,
  hurwitzZeta,
  hurwitzZetaReal,
  zetaGeneralized,
  zetaGeneralizedReal,
} from "../src/hurwitz-zeta.ts";
import { cx } from "../src/complex.ts";
import { lerchPhi, lerchPhiReal } from "../src/lerch.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];

/** Evaluate two expressions the same way and compare their canonical MathJSON. */
const sameExact = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);

/** Numeric value of an expression via .N(). */
const num = (input: Expr): number => ce.box(input).N().re;

// --- Exact closed forms (symbolic, no tolerance) --------------------------------

test("ζ(2,1) = π²/6 (reduces to ordinary ζ)", () => {
  sameExact(["HurwitzZeta", 2, 1], ["Zeta", 2]);
  sameExact(["HurwitzZeta", 2, 1], ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]]);
});

test("ζ(2,2) = π²/6 − 1", () => {
  sameExact(["HurwitzZeta", 2, 2], ["Subtract", ["Zeta", 2], 1]);
});

test("ζ(4,2) = π⁴/90 − 1", () => {
  sameExact(["HurwitzZeta", 4, 2], ["Subtract", ["Zeta", 4], 1]);
});

test("ζ(s,1) = ζ(s) for symbolic s", () => {
  sameExact(["HurwitzZeta", "s", 1], ["Zeta", "s"]);
});

test("ζ(0,a) = 1/2 − a (symbolic a)", () => {
  sameExact(["HurwitzZeta", 0, "a"], ["Subtract", ["Rational", 1, 2], "a"]);
});

// The symbolic ζ(0,a) form above is CE-canonical; the ζ(−1,a) closed form is not
// (CE keeps −½(a²−a+⅙) unexpanded), so pin the exact rationals at sample a instead.
test("ζ(0,a) = 1/2 − a at exact a", () => {
  sameExact(["HurwitzZeta", 0, 3], ["Rational", -5, 2]); // 1/2 − 3
  sameExact(["HurwitzZeta", 0, ["Rational", 5, 2]], ["Rational", -2, 1]); // 1/2 − 5/2
});

test("ζ(−1,a) = −(6a²−6a+1)/12 at exact a", () => {
  const closed = (a: Expr): Expr => [
    "Divide",
    ["Negate", ["Add", ["Multiply", 6, ["Power", a, 2]], ["Multiply", -6, a], 1]],
    12,
  ];
  const samples: Expr[] = [3, ["Rational", 5, 2], ["Rational", 7, 3]];
  for (const a of samples) {
    sameExact(["HurwitzZeta", -1, a], closed(a));
  }
});

test("ζ(−n,a) = −B_{n+1}(a)/(n+1) for n = 2,3,4 at a = 5/2", () => {
  const a: Expr = ["Rational", 5, 2];
  for (const n of [2, 3, 4]) {
    // -B_{n+1}(a)/(n+1) built independently from exact Bernoulli numbers.
    const m = n + 1;
    const terms: Expr[] = [];
    for (let k = 0; k <= m; k++) {
      const [bn, bd] = bernoulliRational(k);
      if (bn === 0n) continue;
      // C(m,k) * B_k * a^(m-k)
      let c = 1;
      for (let i = 0; i < k; i++) c = (c * (m - i)) / (i + 1);
      terms.push(["Multiply", ["Rational", Number(bn) * c, Number(bd)], ["Power", a, m - k]]);
    }
    sameExact(["HurwitzZeta", -n, a], ["Divide", ["Negate", ["Add", ...terms]], m]);
  }
});

test("ζ(1,a) is the pole (ComplexInfinity)", () => {
  expect(ce.box(["HurwitzZeta", 1, 3]).evaluate().json).toEqual("ComplexInfinity");
  expect(ce.box(["HurwitzZeta", 1, "a"]).evaluate().json).toEqual("ComplexInfinity");
});

// --- Numeric evaluation vs known values (Euler–Maclaurin) -----------------------

test("ζ(2,1/2) = π²/2", () => {
  expect(num(["HurwitzZeta", 2, ["Rational", 1, 2]])).toBeCloseTo(Math.PI ** 2 / 2, 11);
});

test("ζ(3,1) numerically equals the ordinary ζ(3) (Apéry's constant)", () => {
  expect(Math.abs(num(["HurwitzZeta", 3, 1]) - num(["Zeta", 3]))).toBeLessThan(1e-14);
});

test("ζ(s,a) direct series matches definition for Re(s) > 1", () => {
  // ζ(4, 1.3) = Σ_{n≥0} (n+1.3)^{-4}, converges fast — sum enough terms as a check.
  let s = 0;
  for (let n = 0; n < 200000; n++) s += (n + 1.3) ** -4;
  expect(Math.abs(num(["HurwitzZeta", 4, 1.3]) - s)).toBeLessThan(1e-9);
});

test("ζ(1/2, 2) matches the raw kernel", () => {
  const r = hurwitzZeta({ re: 0.5, im: 0 }, { re: 2, im: 0 });
  expect(Math.abs(num(["HurwitzZeta", ["Rational", 1, 2], 2]) - r.re)).toBeLessThan(1e-14);
});

test("complex argument: ζ(2, 1+i) matches an independent tail-corrected sum", () => {
  const r = hurwitzZeta({ re: 2, im: 0 }, { re: 1, im: 1 });
  // Independent reference: partial sum + integral tail ∫(x+a)^{-2} = (N+a)^{-1}
  // + half endpoint. Error ~ (N+a)^{-3}, negligible at N = 5000.
  const N = 5000;
  const ay = 1;
  const inv = (x: number, y: number, p: number) => {
    // (x+iy)^{-p}, p a positive integer, via repeated complex division
    let re = 1;
    let im = 0;
    const d = x * x + y * y;
    for (let i = 0; i < p; i++) {
      const nre = (re * x + im * y) / d;
      const nim = (im * x - re * y) / d;
      re = nre;
      im = nim;
    }
    return [re, im] as const;
  };
  let re = 0;
  let im = 0;
  for (let n = 0; n < N; n++) {
    const [pr, pi] = inv(n + 1, ay, 2);
    re += pr;
    im += pi;
  }
  const [t1r, t1i] = inv(N + 1, ay, 1); // integral tail
  const [t2r, t2i] = inv(N + 1, ay, 2); // half endpoint
  re += t1r + 0.5 * t2r;
  im += t1i + 0.5 * t2i;
  expect(Math.abs(r.re - re)).toBeLessThan(1e-9);
  expect(Math.abs(r.im - im)).toBeLessThan(1e-9);
});

// --- Two-argument Zeta (Wolfram generalized zeta), and native 1-arg preserved ------

test("1-arg Zeta still works after the head is extended", () => {
  sameExact(["Zeta", 2], ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]]);
  sameExact(["Zeta", -1], ["Rational", -1, 12]);
  sameExact(["Zeta", -2], 0);
  expect(ce.box(["Zeta", 1]).evaluate().json).toEqual("ComplexInfinity");
  // native threading over a list of s
  sameExact(
    ["Zeta", ["List", -1, -2, -3]],
    ["List", ["Rational", -1, 12], 0, ["Rational", 1, 120]],
  );
});

test("Zeta(s,a) = HurwitzZeta(s,a) for Re(a) > 0", () => {
  sameExact(["Zeta", 2, 2], ["HurwitzZeta", 2, 2]); // both π²/6 − 1
  sameExact(["Zeta", "s", 1], ["Zeta", "s"]); // Zeta(s,1) = ζ(s)
  expect(
    Math.abs(num(["Zeta", ["Rational", 1, 2], 2]) - num(["HurwitzZeta", ["Rational", 1, 2], 2])),
  ).toBeLessThan(1e-13);
});

test("Zeta(s,0) = ζ(s) (dropped pole term, unlike HurwitzZeta)", () => {
  sameExact(["Zeta", 2, 0], ["Zeta", 2]);
  expect(Math.abs(num(["Zeta", 3, 0]) - num(["Zeta", 3]))).toBeLessThan(1e-13);
});

test("Zeta(s,a) for a ≤ 0 uses the generalized convention (differs from HurwitzZeta)", () => {
  // Zeta[3,-1/2] = 16.4143983… = 8 + ζ(3,1/2); HurwitzZeta[3,-1/2] = 0.4143983…
  const r = zetaGeneralized({ re: 3, im: 0 }, { re: -0.5, im: 0 });
  expect(Math.abs(num(["Zeta", 3, ["Rational", -1, 2]]) - r.re)).toBeLessThan(1e-13);
  expect(r.re).toBeCloseTo(16.4143983221172, 9);
  // Wolfram Zeta[-1,-2] = 35/12
  expect(num(["Zeta", -1, -2])).toBeCloseTo(35 / 12, 11);
});

test("Zeta vs HurwitzZeta divergence at real a < 0: real vs complex", () => {
  const z = zetaGeneralized({ re: 0.5, im: 0 }, { re: -0.5, im: 0 });
  const h = hurwitzZeta({ re: 0.5, im: 0 }, { re: -0.5, im: 0 });
  expect(Math.abs(z.im)).toBeLessThan(1e-12); // Zeta stays real
  expect(Math.abs(h.im + Math.SQRT2)).toBeLessThan(1e-9); // HurwitzZeta is complex (−i√2 term)
});

// --- GPU/JS compile handlers (ce.compile emits a call to our kernel) --------------

test("compile handler emits a real kernel call (JS + WGSL) and runs correctly", () => {
  const js = new JavaScriptTarget().compile(ce.box(["HurwitzZeta", 2, "x"])) as { code?: string };
  expect(js.code).toContain("__hz(2"); // real JS wrapper, taken from the scope object
  const wgsl = new WGSLTarget().compile(ce.box(["Add", ["HurwitzZeta", 2, "x"], "y"])) as {
    code?: string;
  };
  expect(wgsl.code).toContain("hurwitz(vec2f"); // composes as f32 via `.x`
  expect(wgsl.code).toContain(").x");
  // End-to-end: run the compiled JS with the real wrapper injected on the scope.
  // oxlint-disable-next-line no-implied-eval -- running compute-engine-compiled source is the point
  const g = new Function("_", `return (${js.code});`) as (s: Record<string, unknown>) => number;
  const v = g({ x: 1, __hz: hurwitzZetaReal });
  expect(Math.abs(v - hurwitzZetaReal(2, 1))).toBeLessThan(1e-12);
});

test("one-argument Zeta compiles to the generalized kernel at a = 1 (JS + WGSL)", () => {
  const js = new JavaScriptTarget().compile(ce.box(["Zeta", "x"])) as { code?: string };
  expect(js.code).toBe("_.__zg(_.x, 1)");
  const wgsl = new WGSLTarget().compile(ce.box(["Zeta", "x"])) as { code?: string };
  expect(wgsl.code).toBe("zetaGen(vec2f(x, 0.0), vec2f(1.0, 0.0)).x");
  // oxlint-disable-next-line no-implied-eval -- running compute-engine-compiled source is the point
  const g = new Function("_", `return (${js.code});`) as (s: Record<string, unknown>) => number;
  expect(g({ x: 3, __zg: zetaGeneralizedReal })).toBeCloseTo(1.2020569031595942, 13);
});

// --- ζ(s, m) against mpmath: complex s, and real s left of the strip -----------------

// compute-engine's native Zeta evaluates real s only; complex s is filled from ζ(s, 1).
// Left of Re(s) = 0 at a small positive integer a the kernel reflects instead of summing.
// Oracle values are pinned in zeta.golden.json (scripts/collect-zeta-goldens.ts, mpmath).
interface ZetaGolden {
  s: [number, number];
  a: number;
  label: string;
  tol: number;
  mpmath: [number, number];
}
const zetaGoldens: ZetaGolden[] = JSON.parse(
  readFileSync(new URL("./zeta.golden.json", import.meta.url), "utf8"),
);

const offBy = (
  rows: ZetaGolden[],
  value: (g: ZetaGolden) => { re: number; im: number },
): string[] =>
  rows.flatMap((g) => {
    const r = value(g);
    const ref = g.mpmath;
    const err =
      Math.max(Math.abs(r.re - ref[0]), Math.abs(r.im - ref[1])) /
      Math.max(1, Math.hypot(ref[0], ref[1]));
    return err <= g.tol ? [] : [`${g.label}: relerr ${err.toExponential(2)}`];
  });

const complexRiemann = zetaGoldens.filter((g) => g.a === 1 && g.s[1] !== 0);
const viaN = (engine: ComputeEngine, head: Expr[]) => (g: ZetaGolden) =>
  engine.box([head[0], ["Complex", ...g.s], ...head.slice(1)] as never).N();

test("the ζ(s, m) kernel matches mpmath, complex s and real s ≪ 0", () => {
  expect(offBy(zetaGoldens, (g) => hurwitzZeta(cx(...g.s), cx(g.a)))).toEqual([]);
});

test("Zeta(s) at complex s matches mpmath, on and off the critical line", () => {
  expect(offBy(complexRiemann, viaN(ce, ["Zeta"]))).toEqual([]);
  expect(offBy(complexRiemann, viaN(ce, ["Zeta", 1]))).toEqual([]);
  expect(offBy(complexRiemann, viaN(ce, ["HurwitzZeta", 1]))).toEqual([]);
});

test("Zeta(s) at complex s holds with the engine at 40 digits", () => {
  // A compute-engine complex is a pair of doubles, so there is no bignum path to take:
  // the answer is the double kernel's, not an unevaluated Zeta.
  const engine = new ComputeEngine();
  declareAnalytic(engine);
  engine.precision = 40;
  expect(offBy(complexRiemann, viaN(engine, ["Zeta"]))).toEqual([]);
});

test("compiled Zeta(x) and HurwitzZeta(x, m) hold left of the strip", () => {
  // The real-scalar wrappers the plot elements inject for `_.__zg` / `_.__hz`.
  const real = zetaGoldens.filter((g) => g.s[1] === 0);
  expect(offBy(real, (g) => cx(zetaGeneralizedReal(g.s[0], g.a)))).toEqual([]);
  expect(offBy(real, (g) => cx(hurwitzZetaReal(g.s[0], g.a)))).toEqual([]);
});

test("Zeta(s) keeps the native behaviour wherever native evaluates", () => {
  sameExact(["Zeta", 2], ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]]);
  expect(ce.box(["Zeta", 1]).evaluate().json).toBe("ComplexInfinity");
  expect(ce.box(["Zeta", "s"]).N().json).toEqual(["Zeta", "s"]);
  expect(ce.box(["Zeta", ["Rational", 1, 2]]).evaluate().json).toEqual([
    "Zeta",
    ["Rational", 1, 2],
  ]);
  // An exact complex stays symbolic under evaluate(), as an exact real does; N() gives a number.
  expect(ce.box(["Zeta", ["Complex", 2, 1]]).evaluate().json).toEqual(["Zeta", ["Complex", 2, 1]]);
  expect(ce.box(["Zeta", ["Complex", 2, 1]]).N().im).toBeCloseTo(-0.4375308659196079, 13);
  // Threads over a list, complex entries included.
  // Float digits past ~1e-15 differ across platforms' libm, so the complex entry is held
  // to a tolerance rather than exactly.
  const [head, exact, complex] = ce.box(["Zeta", ["List", 2, ["Complex", 0.5, 14]]]).evaluate()
    .json as [string, unknown, [string, number, number]];
  expect([head, exact, complex[0]]).toEqual([
    "List",
    ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
    "Complex",
  ]);
  expect(complex[1]).toBeCloseTo(0.02224114260999359, 13);
  expect(complex[2]).toBeCloseTo(-0.10325812326645006, 13);
});

// --- LerchPhi Φ(z, s, a) = Σ zⁿ (n+a)^(−s) -----------------------------------------

test("LerchPhi reductions: Φ(1,s,a)=ζ(s,a) and Φ(z,0,a)=1/(1−z)", () => {
  sameExact(["LerchPhi", 1, 2, 1], ["Zeta", 2]); // Φ(1,2,1) = ζ(2) = π²/6
  sameExact(["LerchPhi", 1, 2, 2], ["Subtract", ["Zeta", 2], 1]); // Φ(1,2,2) = ζ(2,2)
  sameExact(["LerchPhi", ["Rational", 1, 2], 0, 5], 2); // Φ(1/2,0,a) = 1/(1−1/2) = 2
});

test("LerchPhi numeric matches known values (mpmath/Wolfram)", () => {
  // Φ(1/2, 2, 1) = Li₂(1/2)/(1/2) = 1.16448105293…
  expect(num(["LerchPhi", ["Rational", 1, 2], 2, 1])).toBeCloseTo(1.16448105293, 11);
  // Φ(−1/2, 2, 1) = 0.89682841385…
  expect(num(["LerchPhi", ["Rational", -1, 2], 2, 1])).toBeCloseTo(0.8968284138473, 11);
  // Φ(0.3, 3, 2) = 0.13777975437…
  expect(num(["LerchPhi", 0.3, 3, 2])).toBeCloseTo(0.1377797543655, 10);
});

test("LerchPhi at z = −1 (rim): Euler transform hits the Dirichlet-eta constants", () => {
  // On |z| = 1 the alternating series converges too slowly for direct summation;
  // the Euler transform recovers these to machine precision.
  const ln2 = Math.LN2;
  const pi2_12 = Math.PI ** 2 / 12;
  const catalan = 0.915965594177219015;
  const zeta3 = 1.2020569031595943;
  expect(Math.abs(num(["LerchPhi", -1, 1, 1]) - ln2)).toBeLessThan(1e-14); // η(1) = ln 2
  expect(Math.abs(num(["LerchPhi", -1, 2, 1]) - pi2_12)).toBeLessThan(1e-14); // η(2) = π²/12
  // Φ(−1, 2, ½) = 4G (Catalan)
  expect(Math.abs(num(["LerchPhi", -1, 2, ["Rational", 1, 2]]) - 4 * catalan)).toBeLessThan(1e-13);
  // Φ(−1, 3, 1) = η(3) = ¾ ζ(3)
  expect(Math.abs(num(["LerchPhi", -1, 3, 1]) - 0.75 * zeta3)).toBeLessThan(1e-14);
  // η(½) = (1 − √2) ζ(½)-flavoured constant, mpmath value
  expect(num(["LerchPhi", -1, ["Rational", 1, 2], 1])).toBeCloseTo(0.6048986434216, 11);
});

test("LerchPhi complex z matches the raw kernel", () => {
  const r = lerchPhi({ re: 0.4, im: 0.3 }, { re: 2, im: 0 }, { re: 1, im: 0 });
  expect(r.re).toBeCloseTo(1.1018365887408, 10);
  expect(r.im).toBeCloseTo(0.1098804540041, 10);
});

test("LerchPhi |z|>1 is out of series range (NaN, documented divergence)", () => {
  const r = lerchPhi({ re: 2, im: 0 }, { re: 2, im: 0 }, { re: 1, im: 0 });
  expect(Number.isNaN(r.re)).toBe(true);
});

test("LerchPhi compile handler emits a real kernel call (JS + WGSL) and runs", () => {
  const js = new JavaScriptTarget().compile(ce.box(["LerchPhi", "z", 2, 1])) as { code?: string };
  expect(js.code).toContain("__lp(");
  const wgsl = new WGSLTarget().compile(ce.box(["LerchPhi", "z", 2, 1])) as { code?: string };
  expect(wgsl.code).toContain("lerchPhi(vec2f");
  // oxlint-disable-next-line no-implied-eval -- running compute-engine-compiled source is the point
  const g = new Function("_", `return (${js.code});`) as (s: Record<string, unknown>) => number;
  const v = g({ z: 0.5, __lp: lerchPhiReal });
  expect(Math.abs(v - lerchPhiReal(0.5, 2, 1))).toBeLessThan(1e-12);
});
