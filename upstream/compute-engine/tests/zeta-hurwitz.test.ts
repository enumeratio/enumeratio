import { readFileSync } from "node:fs";
import { BigDecimal, ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget, WGSLTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import {
  bigCx,
  hurwitzZetaBig,
  cx,
  type Cx,
  lerchPhi,
  lerchPhiReal,
  applyAllPatches,
  hurwitzZeta,
  hurwitzZetaReal,
  zetaGeneralized,
  zetaGeneralizedReal,
} from "../src/index.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);

type Expr = number | string | readonly [string, ...Expr[]];

/** Numeric value of an expression via .N(). */
const num = (input: Expr): number => ce.box(input).N().re;

// --- Numeric evaluation vs known values (Euler–Maclaurin) -----------------------

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

test("Zeta(s,a) = HurwitzZeta(s,a) for Re(a) > 0", () => {
  expect(Math.abs(num(["Zeta", ["Rational", 1, 2], 2]) - num(["HurwitzZeta", ["Rational", 1, 2], 2]))).toBeLessThan(
    1e-13,
  );
});

test("Zeta(s,0) = ζ(s) (dropped pole term, unlike HurwitzZeta)", () => {
  expect(Math.abs(num(["Zeta", 3, 0]) - num(["Zeta", 3]))).toBeLessThan(1e-13);
});

test("Zeta(s,a) for a ≤ 0 uses the generalized convention (differs from HurwitzZeta)", () => {
  // Zeta[3,-1/2] = 16.4143983… = 8 + ζ(3,1/2); HurwitzZeta[3,-1/2] = 0.4143983…
  const r = zetaGeneralized({ re: 3, im: 0 }, { re: -0.5, im: 0 });
  expect(Math.abs(num(["Zeta", 3, ["Rational", -1, 2]]) - r.re)).toBeLessThan(1e-13);
  expect(r.re).toBeCloseTo(16.4143983221172, 9);
});

test("Zeta vs HurwitzZeta divergence at real a < 0: real vs complex", () => {
  const z = zetaGeneralized({ re: 0.5, im: 0 }, { re: -0.5, im: 0 });
  const h = hurwitzZeta({ re: 0.5, im: 0 }, { re: -0.5, im: 0 });
  expect(Math.abs(z.im)).toBeLessThan(1e-12); // Zeta stays real
  expect(Math.abs(h.im + Math.SQRT2)).toBeLessThan(1e-9); // HurwitzZeta is complex (−i√2 term)
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
const zetaGoldens: ZetaGolden[] = JSON.parse(
  readFileSync(new URL("../../../packages/reference/golden/upstream/zeta.golden.json", import.meta.url), "utf8"),
);

const offBy = (rows: ZetaGolden[], value: (g: ZetaGolden) => { re: number; im: number }): string[] =>
  rows.flatMap((g) => {
    const r = value(g);
    const ref = g.mpmath;
    const err = Math.max(Math.abs(r.re - ref[0]), Math.abs(r.im - ref[1])) / Math.max(1, Math.hypot(ref[0], ref[1]));
    return err <= g.tol ? [] : [`${g.label}: relerr ${err.toExponential(2)}`];
  });

test("the double ζ(s, a) kernel matches mpmath, complex s and left of the strip", () => {
  expect(offBy(zetaGoldens, (g) => hurwitzZeta(cx(...g.s), cx(g.a)))).toEqual([]);
});

// mpmath.zeta(s, a) at dps 30. Off the axis the Taylor series in a and Euler–Maclaurin's direct
// terms both cancel left of the strip (the last two lost ten digits); Hermite's integral doesn't.
const complexA: [[number, number], [number, number], [number, number]][] = [
  [
    [-3.1, 0],
    [0.498, -2.645],
    [-13.981649049083694, 2.257375643516622],
  ],
  [
    [-6, 0],
    [0.38, -2.39],
    [-27.255450791559646, -81.31448214002623],
  ],
  [
    [-8.1, 0],
    [0.5, 1.5],
    [2.2938135033482614, -14.482568046811453],
  ],
  [
    [-10, 0],
    [0.2, 3],
    [-23226.23160245248, 14866.048585118255],
  ],
  [
    [-7.5434669321832, -5.842559411490806],
    [1.1482136138878813, 2.436120494561046],
    [0.06980460198689101, 0.08527998037180706],
  ],
  [
    [-9, 6.737365124032138],
    [0.6464518128893662, -1.4763603663938716],
    [-0.0010147884679548146, 0.0013387157186172535],
  ],
];

test("the double ζ(s, a) kernel matches mpmath left of the strip with a off the axis", () => {
  const off = complexA.flatMap(([s, a, ref]) => {
    const z = hurwitzZeta(cx(...s), cx(...a));
    const err = Math.hypot(z.re - ref[0], z.im - ref[1]) / Math.hypot(...ref);
    return err <= 1e-12 ? [] : [`ζ(${s.join()}, ${a.join()}): relerr ${err.toExponential(2)}`];
  });
  expect(off).toEqual([]);
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

test("compiled Zeta(x, a) and HurwitzZeta(x, a) hold left of the strip", () => {
  // The real-scalar wrappers the plot elements inject for `_.__zg` / `_.__hz`.
  const real = zetaGoldens.filter((g) => g.s[1] === 0);
  expect(offBy(real, (g) => cx(zetaGeneralizedReal(g.s[0], g.a)))).toEqual([]);
  expect(offBy(real, (g) => cx(hurwitzZetaReal(g.s[0], g.a)))).toEqual([]);
});

// --- LerchPhi Φ(z, s, a) = Σ zⁿ (n+a)^(−s) -----------------------------------------

test("LerchPhi complex z matches the raw kernel", () => {
  const r = lerchPhi({ re: 0.4, im: 0.3 }, { re: 2, im: 0 }, { re: 1, im: 0 });
  expect(r.re).toBeCloseTo(1.1018365887408, 10);
  expect(r.im).toBeCloseTo(0.1098804540041, 10);
});

test("LerchPhi near the rim with Re(s) < 0 holds where the direct series cancels", () => {
  // [z, s, a, mpmath.lerchphi at dps 30]: the series lost up to ten digits here.
  const cases: [Cx, number, number, Cx][] = [
    [cx(-0.849, 0.298), -3.684, 1.253, cx(-0.1600327672867217, -0.08051436488214103)],
    [
      cx(-0.7997488679035274, 0.5835252764765433),
      -3.8190701635952826,
      1.1640944549156451,
      cx(-0.049388898906573865, -0.21780404730059108),
    ],
    [
      cx(-0.9207151517679546, -0.23405898680655765),
      -3.8949384848132773,
      4.916401407442224,
      cx(155.38665972342602, -27.87666505765287),
    ],
    // Real z < 0 (the Euler transform), and real z > 0, whose terms keep growing past where
    // |z|ⁿ alone says to stop.
    [cx(-0.99), -4.188949130506693, 1.5744982822248883, cx(-0.0715024188767293)],
    [cx(0.99), -5.5295129154307485, 5.412083680968283, cx(3553379253965128.5)],
  ];
  for (const [z, s, a, want] of cases) {
    const got = lerchPhi(z, cx(s), cx(a));
    expect(Math.hypot(got.re - want.re, got.im - want.im) / Math.hypot(want.re, want.im)).toBeLessThan(1e-12);
  }
});

test("LerchPhi near the rim with Re(s) < 0 holds for a off the axis", () => {
  // mpmath.lerchphi at dps 30; the direct series cancels about ten digits here.
  const got = lerchPhi(cx(0.1697971757573408, 0.9844642802584717), cx(-5.666), cx(2, 0.5));
  const want = cx(14.858759379007553, 80.01966924208229);
  expect(Math.hypot(got.re - want.re, got.im - want.im) / Math.hypot(want.re, want.im)).toBeLessThan(1e-12);
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

test("HurwitzZeta(s,a) stays finite at a nonpositive integer when Re(s) < 0", () => {
  // 0^(−s) for Re(s) < 0 is 0, not a pole, so no guard is needed there (mpmath agrees).
  const z = hurwitzZeta({ re: -1.5, im: 0 }, { re: -2, im: 0 });
  expect(z.re).toBeCloseTo(-0.025485201889833036, 12);
  expect(z.im).toBeCloseTo(-3.8284271247461903, 12);
});
