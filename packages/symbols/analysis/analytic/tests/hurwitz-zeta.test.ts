import { readFileSync } from "node:fs";
import { BigDecimal, ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget, WGSLTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { bernoulliRational } from "../src/bernoulli.ts";
import { bigCx, hurwitzZetaBig } from "../src/bigzeta.ts";
import {
  declareAnalytic,
  hurwitzZeta,
  hurwitzZetaReal,
  setZetaKernel,
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
  sameExact(["Zeta", ["List", -1, -2, -3]], ["List", ["Rational", -1, 12], 0, ["Rational", 1, 120]]);
});

test("Zeta(s,a) = HurwitzZeta(s,a) for Re(a) > 0", () => {
  sameExact(["Zeta", 2, 2], ["HurwitzZeta", 2, 2]); // both π²/6 − 1
  sameExact(["Zeta", "s", 1], ["Zeta", "s"]); // Zeta(s,1) = ζ(s)
  expect(Math.abs(num(["Zeta", ["Rational", 1, 2], 2]) - num(["HurwitzZeta", ["Rational", 1, 2], 2]))).toBeLessThan(
    1e-13,
  );
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

// --- ζ(s, a) against mpmath: complex s, and left of the strip ------------------------

// compute-engine's native Zeta evaluates real s only; complex s is filled from ζ(s, 1).
// Left of Re(s) = 0 the double kernel sums a Taylor series in a over reflected ζ(s + k)
// instead. Oracle values are pinned in zeta.golden.json (scripts/collect-zeta-goldens.ts,
// mpmath), as doubles and to 40 digits.
interface ZetaGolden {
  s: [number, number];
  a: number;
  label: string;
  tol: number;
  mpmath: [number, number];
  mpmath40: [string, string];
}
const zetaGoldens: ZetaGolden[] = JSON.parse(readFileSync(new URL("./zeta.golden.json", import.meta.url), "utf8"));

const offBy = (rows: ZetaGolden[], value: (g: ZetaGolden) => { re: number; im: number }): string[] =>
  rows.flatMap((g) => {
    const r = value(g);
    const ref = g.mpmath;
    const err = Math.max(Math.abs(r.re - ref[0]), Math.abs(r.im - ref[1])) / Math.max(1, Math.hypot(ref[0], ref[1]));
    return err <= g.tol ? [] : [`${g.label}: relerr ${err.toExponential(2)}`];
  });

const complexRiemann = zetaGoldens.filter((g) => g.a === 1 && g.s[1] !== 0);
const viaN = (engine: ComputeEngine, head: Expr[]) => (g: ZetaGolden) =>
  engine.box([head[0], ["Complex", ...g.s], ...head.slice(1)] as never).N();

test("the double ζ(s, a) kernel matches mpmath, complex s and left of the strip", () => {
  expect(offBy(zetaGoldens, (g) => hurwitzZeta(cx(...g.s), cx(g.a)))).toEqual([]);
});

/** Within one unit in the 39th significant digit — each side is rounded to 40. */
const agrees40 = (ours: BigDecimal, ref: string): boolean => {
  const r = new BigDecimal(ref);
  return r.isZero()
    ? ours.isZero()
    : ours
        .sub(r)
        .abs()
        .lte(r.abs().mul(new BigDecimal("1e-38")));
};

test("the bignum ζ(s, a) kernel matches mpmath to 40 digits", () => {
  const off = zetaGoldens.filter((g) => {
    const r = hurwitzZetaBig(bigCx(...g.s), bigCx(g.a), 40);
    return !r || !agrees40(r.re, g.mpmath40[0]) || !agrees40(r.im, g.mpmath40[1]);
  });
  expect(off.map((g) => g.label)).toEqual([]);
});

test("the bignum ζ(s, a) kernel rounds to the nearest double", () => {
  const off = zetaGoldens.filter((g) => {
    const r = hurwitzZetaBig(bigCx(...g.s), bigCx(g.a), 17);
    return r?.re.toNumber() !== g.mpmath[0] || r?.im.toNumber() !== g.mpmath[1];
  });
  expect(off.map((g) => g.label)).toEqual([]);
});

const parts = (x: { re: number; im: number }): [number, number] => [x.re, x.im];

test("Zeta(s) at complex s is mpmath's value correctly rounded, on and off the critical line", () => {
  for (const head of [["Zeta"], ["Zeta", 1], ["HurwitzZeta", 1]])
    expect(complexRiemann.map((g) => parts(viaN(ce, head)(g)))).toEqual(complexRiemann.map((g) => g.mpmath));
});

test("Zeta(s) at complex s is correctly rounded with the engine at 40 digits, and at machine", () => {
  // A compute-engine complex is a pair of doubles, so 40 digits of kernel come back as the
  // nearest pair of doubles.
  for (const precision of [40, "machine"] as const) {
    const engine = new ComputeEngine();
    declareAnalytic(engine);
    engine.precision = precision;
    expect(complexRiemann.map((g) => parts(viaN(engine, ["Zeta"])(g)))).toEqual(complexRiemann.map((g) => g.mpmath));
  }
});

test("setZetaKernel('double') puts N() back on the double kernel", () => {
  const g = complexRiemann[0];
  try {
    setZetaKernel("double");
    expect(parts(viaN(ce, ["Zeta"])(g))).toEqual(parts(hurwitzZeta(cx(...g.s), cx(1))));
  } finally {
    setZetaKernel("bignum");
  }
  expect(parts(viaN(ce, ["Zeta"])(g))).toEqual(g.mpmath);
});

test("compiled Zeta(x, a) and HurwitzZeta(x, a) hold left of the strip", () => {
  // The real-scalar wrappers the plot elements inject for `_.__zg` / `_.__hz`.
  const real = zetaGoldens.filter((g) => g.s[1] === 0);
  expect(offBy(real, (g) => cx(zetaGeneralizedReal(g.s[0], g.a)))).toEqual([]);
  expect(offBy(real, (g) => cx(hurwitzZetaReal(g.s[0], g.a)))).toEqual([]);
});

test("Zeta(s) keeps the native behaviour wherever native evaluates", () => {
  sameExact(["Zeta", 2], ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]]);
  expect(ce.box(["Zeta", 1]).evaluate().json).toBe("ComplexInfinity");
  expect(ce.box(["Zeta", "s"]).N().json).toEqual(["Zeta", "s"]);
  expect(ce.box(["Zeta", ["Rational", 1, 2]]).evaluate().json).toEqual(["Zeta", ["Rational", 1, 2]]);
  // An exact complex stays symbolic under evaluate(), as an exact real does; N() gives a number.
  expect(ce.box(["Zeta", ["Complex", 2, 1]]).evaluate().json).toEqual(["Zeta", ["Complex", 2, 1]]);
  expect(ce.box(["Zeta", ["Complex", 2, 1]]).N().im).toBeCloseTo(-0.4375308659196079, 13);
  // Threads over a list, complex entries included — correctly rounded, so exact.
  expect(ce.box(["Zeta", ["List", 2, ["Complex", 0.5, 14]]]).evaluate().json).toEqual([
    "List",
    ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
    ["Complex", 0.02224114260999359, -0.10325812326645006],
  ]);
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

// --- Found by the oracle Plausible (mpmath and Wolfram agree) ---------------------

test("a negative real base's phase is exact: ζ(1.5, −10⁻¹²) keeps the real part ζ(1.5)", () => {
  // (−10⁻¹²)^(−1.5) is 10¹⁸·i, purely imaginary; a floating cos(−1.5π) leaked ~−184 into Re.
  const z = hurwitzZeta({ re: 1.5, im: 0 }, { re: -1e-12, im: 0 });
  expect(z.re).toBeCloseTo(2.612375348685488, 9);
  // …and a real ζ(5, −½) comes back real, not with a stray −2e−14 i.
  expect(hurwitzZeta({ re: 5, im: 0 }, { re: -0.5, im: 0 }).im).toBe(0);
});

test("LerchPhi continues past |z| = 1 (values from mpmath)", () => {
  const at = (z: Expr, s: Expr, a: Expr) => ce.box(["N", ["LerchPhi", z, s, a]] as Expr).N();
  // On the cut, real z > 1: the side below it, as mpmath and Wolfram take.
  const cut = at(2.809, 2, 2);
  expect(cut.re).toBeCloseTo(-0.0565877019732229, 10);
  expect(cut.im).toBeCloseTo(-0.4112203779716626, 10);
  const off = at(["Complex", 1, 2], ["Complex", 3, -1], ["Complex", 4, 2]);
  expect(off.re).toBeCloseTo(0.002025009957009909, 12);
  expect(off.im).toBeCloseTo(0.003327897536813559, 12);
  // A negative a, shifted up by the recurrence.
  expect(at(-2, 2, -2.5).re).toBeCloseTo(-12.28676272353094, 9);
  // Where the terms cancel below double precision it says nothing rather than guess.
  expect(ce.box(["N", ["LerchPhi", 10, 10, 10]]).evaluate().json).toEqual(["LerchPhi", 10, 10, 10]);
});

test("Φ(0, s, a) = a^(−s)", () => {
  sameExact(["LerchPhi", 0, 2, 3], ["Rational", 1, 9]);
});

test("HurwitzZeta(s,a) is the pole at a nonpositive integer and Re(s) > 0", () => {
  // The (n+a)=0 term is 0^(−s) with Re(s) > 0: a genuine singularity (mpmath and SymPy both
  // raise here), unlike the generalized Zeta(s,a), which drops that term and stays finite.
  expect(ce.box(["N", ["HurwitzZeta", 2, -2]]).evaluate().json).toEqual("ComplexInfinity");
  expect(ce.box(["N", ["HurwitzZeta", 0.158, -1]]).evaluate().json).toEqual("ComplexInfinity");
  expect(ce.box(["N", ["HurwitzZeta", 3, 0]]).evaluate().json).toEqual("ComplexInfinity");
  // Zeta(s,a) at the same a is unaffected: it keeps the generalized-zeta convention.
  expect(num(["Zeta", 2, -2])).toBeCloseTo(2.89493406684822643647, 12);
});

test("HurwitzZeta(s,a) stays finite at a nonpositive integer when Re(s) < 0", () => {
  // 0^(−s) for Re(s) < 0 is 0, not a pole, so no guard is needed there (mpmath agrees).
  const z = hurwitzZeta({ re: -1.5, im: 0 }, { re: -2, im: 0 });
  expect(z.re).toBeCloseTo(-0.025485201889833036, 12);
  expect(z.im).toBeCloseTo(-3.8284271247461903, 12);
});

test("LerchPhi on the |z|=1 rim continues past the series once Re(s) ≤ 1 (mpmath/Wolfram)", () => {
  // z on the unit circle, off the real axis: the direct series never decays there once
  // Re(s) ≤ 1, and used to return noise instead of routing to the continuation.
  const z: Expr = ["Complex", Math.cos(0.5), Math.sin(0.5)];
  const r = ce.box(["N", ["LerchPhi", z, -0.5, 2]] as Expr).N();
  expect(r.re).toBeCloseTo(-0.4674769533712983, 9);
  expect(r.im).toBeCloseTo(3.097452599486018, 9);
});

// The rim's own series converges too slowly to trust at Re(s) > 1 too — a term at
// n = 200,000 is still ~n^(1−Re(s)), only ~1e-8 at Re(s) = 1.5 — so every Re(s) on the
// rim routes through the continuation. Golden grid at e^(iθ), a = 1, against mpmath at
// dps = 30 (`mp.lerchphi(mp.e**(1j*theta), s, 1)`).
const LERCH_RIM_GOLDEN: readonly [number, number, number, number][] = [
  // theta, s, expected re, expected im
  [0.5, 0, 0.5, 1.9581586823229701],
  [0.5, 0.5, 1.0765400158387588, 1.3129382534588525],
  [0.5, 1, 1.250677974553631, 0.8217909021239179],
  [0.5, 1.5, 1.259873771125738, 0.5000020016787661],
  [1.7, 0, 0.5, 0.4392388922760059],
  [1.7, 0.5, 0.6548235477912739, 0.3794314503888457],
  [1.7, 1, 0.7672500762495273, 0.310906374833933],
  [1.7, 1.5, 0.8457350392733506, 0.2454776862409962],
  [2.4, 0, 0.5, 0.19438978468410248],
  [2.4, 0.5, 0.6156643947703363, 0.17322669966779407],
  [2.4, 1, 0.7096834824907786, 0.14723306313134564],
  [2.4, 1.5, 0.7837313313575303, 0.12075792141283168],
];

test("LerchPhi on the |z|=1 rim: golden grid at every Re(s), accurate to ~1e-13 (mpmath dps=30)", () => {
  for (const [theta, s, re, im] of LERCH_RIM_GOLDEN) {
    const z: Expr = ["Complex", Math.cos(theta), Math.sin(theta)];
    const r = ce.box(["N", ["LerchPhi", z, s, 1]] as Expr).N();
    expect(r.re, `theta=${theta} s=${s} re`).toBeCloseTo(re, 12);
    expect(r.im, `theta=${theta} s=${s} im`).toBeCloseTo(im, 12);
  }
});
