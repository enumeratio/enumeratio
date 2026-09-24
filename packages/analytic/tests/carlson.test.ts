import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { carlsonRC, carlsonRD, carlsonRF, carlsonRG, carlsonRJ } from "../src/carlson.ts";
import { cx } from "../src/complex.ts";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// CarlsonRF, CarlsonRC, CarlsonRD, CarlsonRJ, CarlsonRG — the Carlson symmetric elliptic
// integrals (Carlson 1995; DLMF §19.16, §19.36). Numeric evaluation is held to the oracle
// values in carlson.golden.json, which scripts/collect-carlson-goldens.ts gathers from
// mpmath (which has these natively: elliprf/elliprd/elliprj/elliprc/elliprg) and a
// Wolfram kernel (neither is needed to run this file). A handful of elementary identities
// that hold for ANY argument — not just the golden grid — are checked directly below.

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const num = (input: Expr): number => ce.box(input).N().re;
const im = (input: Expr): number => ce.box(input).N().im;

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: [number, number];
  wolfram?: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./carlson.golden.json", import.meta.url), "utf8"),
);

const relErr = (ours: [number, number], ref: [number, number]): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) /
  Math.max(1, Math.hypot(ref[0], ref[1]));

const byHead = new Map<string, GoldenCase[]>();
for (const g of goldens) byHead.set(g.head, [...(byHead.get(g.head) ?? []), g]);

for (const [head, cases] of byHead) {
  test(`${head}: ${cases.length} cases match the oracles`, () => {
    const off: string[] = [];
    for (const g of cases) {
      const r = ce.box([g.head, ...g.args] as never).N();
      const ours: [number, number] = [r.re, r.im];
      expect(g.mpmath ?? g.wolfram, g.label).toBeDefined();
      for (const [name, ref] of [
        ["mpmath", g.mpmath],
        ["wolfram", g.wolfram],
      ] as const) {
        if (!ref) continue;
        const err = relErr(ours, ref);
        if (!(err <= g.tol)) off.push(`${g.label} vs ${name}: relerr ${err.toExponential(2)}`);
      }
    }
    expect(off).toEqual([]);
  });
}

test("the golden file covers every head", () => {
  const heads = new Set(goldens.map((g) => g.head));
  expect([...heads].sort()).toEqual(
    ["CarlsonRC", "CarlsonRD", "CarlsonRF", "CarlsonRG", "CarlsonRJ"].sort(),
  );
});

// --- Elementary identities, checked directly against the kernels (not just the grid) ---

test("RF(t,t,t) = RD(t,t,t)^(2/3 power aside) = 1/√t, and RJ(t,t,t,t) = RD(t,t,t) = t^(-3/2)", () => {
  for (const t of [0.3, 1, 4, 17.5]) {
    expect(carlsonRF(cx(t), cx(t), cx(t)).re).toBeCloseTo(1 / Math.sqrt(t), 12);
    expect(carlsonRD(cx(t), cx(t), cx(t)).re).toBeCloseTo(Math.pow(t, -1.5), 11);
    expect(carlsonRJ(cx(t), cx(t), cx(t), cx(t)).re).toBeCloseTo(Math.pow(t, -1.5), 10);
    expect(carlsonRG(cx(t), cx(t), cx(t)).re).toBeCloseTo(Math.sqrt(t), 11);
  }
});

test("RC(x,x) = 1/√x", () => {
  for (const x of [0.5, 2, 9]) {
    expect(carlsonRC(cx(x), cx(x)).re).toBeCloseTo(1 / Math.sqrt(x), 13);
  }
});

test("RD(x,y,z) = RJ(x,y,z,z) — RD is the p = z degenerate case of RJ", () => {
  const [x, y, z] = [1.3, 2.7, 4.1];
  const rd = carlsonRD(cx(x), cx(y), cx(z));
  const rj = carlsonRJ(cx(x), cx(y), cx(z), cx(z));
  expect(rj.re).toBeCloseTo(rd.re, 10);
  expect(rj.im).toBeCloseTo(rd.im, 10);
});

test("RC(x,y) = RF(x,y,y) for y > 0 — RC is the two-equal-argument case of RF", () => {
  const [x, y] = [2.2, 5.5];
  const rc = carlsonRC(cx(x), cx(y));
  const rf = carlsonRF(cx(x), cx(y), cx(y));
  expect(rc.re).toBeCloseTo(rf.re, 12);
  expect(rc.im).toBeCloseTo(rf.im, 12);
});

test("RF, RD, RG are symmetric under permuting their (first) arguments", () => {
  const a = cx(1.1);
  const y = cx(2.2, 0.4);
  const z = cx(3.3, -0.7);
  const rf1 = carlsonRF(a, y, z);
  const rf2 = carlsonRF(y, z, a);
  const rf3 = carlsonRF(z, a, y);
  expect(rf1.re).toBeCloseTo(rf2.re, 11);
  expect(rf1.im).toBeCloseTo(rf2.im, 11);
  expect(rf1.re).toBeCloseTo(rf3.re, 11);
  expect(rf1.im).toBeCloseTo(rf3.im, 11);

  const rgA = carlsonRG(a, y, z);
  const rgB = carlsonRG(y, a, z);
  const rgC = carlsonRG(z, y, a);
  expect(rgA.re).toBeCloseTo(rgB.re, 10);
  expect(rgA.re).toBeCloseTo(rgC.re, 10);

  const rdA = carlsonRD(a, y, z);
  const rdB = carlsonRD(y, a, z); // RD symmetric in its first two only
  expect(rdA.re).toBeCloseTo(rdB.re, 11);
  expect(rdA.im).toBeCloseTo(rdB.im, 11);
});

test("RF(0, y, z) = π / (2·AGM(√y, √z)) — the classical complete case (DLMF 19.8.2)", () => {
  const agm = (a: number, b: number): number => {
    let x = a;
    let yv = b;
    for (let i = 0; i < 60; i++) {
      const nx = (x + yv) / 2;
      const ny = Math.sqrt(x * yv);
      x = nx;
      yv = ny;
    }
    return x;
  };
  const [y, z] = [2, 3];
  const rf = carlsonRF(cx(0), cx(y), cx(z));
  expect(rf.re).toBeCloseTo(Math.PI / (2 * agm(Math.sqrt(y), Math.sqrt(z))), 10);
});

test("RG(0, y, y) = (π/4)√y, the ellipsoid-of-revolution degenerate case", () => {
  for (const y of [1, 4, 9.5]) {
    expect(carlsonRG(cx(0), cx(y), cx(y)).re).toBeCloseTo((Math.PI / 4) * Math.sqrt(y), 12);
  }
});

test("CarlsonRF/RC/RD/RJ/RG evaluate through compute-engine, complex included", () => {
  expect(num(["CarlsonRF", 1, 2, 3])).toBeCloseTo(0.7269459354689082, 12);
  expect(num(["CarlsonRC", 1, 4])).toBeCloseTo(0.6045997880780726, 12);
  expect(num(["CarlsonRD", 1, 2, 3])).toBeCloseTo(0.29046028102899063, 11);
  expect(num(["CarlsonRJ", 1, 2, 3, 4])).toBeCloseTo(0.2398480997495678, 10);
  expect(num(["CarlsonRG", 1, 2, 3])).toBeCloseTo(1.4018470999908951, 11);
  const c = ce.box(["CarlsonRF", ["Complex", 1, 1], 2, 3]).N();
  expect(c.re).toBeGreaterThan(0);
  expect(im(["CarlsonRF", ["Complex", 1, 1], 2, 3])).not.toBe(0);
});

test("stays symbolic under plain evaluate; a float argument evaluates numerically", () => {
  expect(ce.box(["CarlsonRF", "x", "y", "z"]).evaluate().json).toEqual([
    "CarlsonRF",
    "x",
    "y",
    "z",
  ]);
  expect(ce.box(["CarlsonRF", 1, 2, 3]).evaluate().json).toEqual(["CarlsonRF", 1, 2, 3]);
  expect(num(["CarlsonRF", 1.0, 2, 3])).toBeCloseTo(0.7269459354689082, 12);
});

test("RJ's real p < 0 branch is the Cauchy principal value (Carlson 1995 eq. (33)), pinned against Wolfram's CarlsonRJ", () => {
  const cases: [number, number, number, number, number][] = [
    [1, 2, 3, -1, -0.09324045243867641],
    [0, 2, 3, -1, -0.8732889802533521], // one argument 0
    [1, 2, 3, -2.5, -0.24776810835275714],
  ];
  for (const [x, y, z, p, expected] of cases) {
    const v = carlsonRJ(cx(x), cx(y), cx(z), cx(p));
    expect(v.im).toBeCloseTo(0, 12);
    expect(v.re).toBeCloseTo(expected, 12);
  }
});

test("RJ's CPV real part agrees with mpmath's complex analytic continuation there (Sokhotski–Plemelj)", () => {
  // mpmath's elliprj(x,y,z,-q) for real x,y,z,q>0 returns the analytic continuation off
  // the branch point, not the principal value — but its real part is the same number.
  const v = carlsonRJ(cx(1), cx(2), cx(3), cx(-1));
  expect(v.re).toBeCloseTo(-0.0932404524386764, 13); // mpmath elliprj(1,2,3,-1).real
});

test("RC's real y < 0 branch is the Cauchy principal value (DLMF 19.2.19), not RF(x,y,y) directly", () => {
  // Pinned against mpmath's elliprc(1,-1), which is defined as this principal value.
  const v = carlsonRC(cx(1), cx(-1));
  expect(v.im).toBeCloseTo(0, 12);
  expect(v.re).toBeCloseTo(0.6232252401402307, 12);
  // The substitution RC(x,y) = √(x/(x−y))·RC(x−y,−y) is what makes this real; feeding
  // the same negative y straight into RF(x,y,y) instead does not land on the real axis.
  const naive = carlsonRF(cx(1), cx(-1), cx(-1));
  expect(Math.abs(naive.im)).toBeGreaterThan(1e-6);
});

test("RC's CPV branch requires x > 0 — a non-positive x must not take that shortcut", () => {
  // Regression: the guard used to check only `y < 0`, so RC(x,y) with x ≤ 0 AND y < 0 (a
  // configuration that turns up inside RJ's own duplication, e.g. RC(-25.6,-25.6) at a
  // fixed point of two equal negative reals) wrongly took the x>0 CPV shortcut, dividing by
  // x−y ≈ 0 and blowing up. It must fall through to RF(x,y,y) instead, which is well-defined
  // via the principal branch at equal negative-real arguments.
  const v = carlsonRC(cx(-25.626), cx(-25.626));
  expect(Number.isFinite(v.re)).toBe(true);
  expect(Number.isFinite(v.im)).toBe(true);
  expect(Math.hypot(v.re, v.im)).toBeLessThan(1);
});

test("RG(0, 0, z) = √z/2 — the two-zero-argument degenerate case (DLMF 19.20.3)", () => {
  // Regression: picking the nonzero argument to play RF/RD's "z" left the OTHER two
  // (both zero) as RF/RD's first two arguments — but RF(0,0,c) diverges (two zero
  // arguments is one too many), so the general reduction blew up to ~1e29 instead of
  // returning the elementary answer.
  for (const z of [1, 2.3, 9]) {
    const v = carlsonRG(cx(0), cx(0), cx(z));
    expect(v.im).toBeCloseTo(0, 12);
    expect(v.re).toBeCloseTo(Math.sqrt(z) / 2, 12);
  }
  expect(carlsonRG(cx(0), cx(0), cx(0)).re).toBe(0);
});

test("RJ(-x,-y,-z,-w) = i·RJ(x,y,z,w) for x,y,z,w ≥ 0 — the all-negative reflection", () => {
  // Regression: duplicating four equal (or otherwise coincident) negative reals directly
  // lands every √ on csqrt's branch cut, and the accumulated per-step branch choice in
  // RJ's summation does not reduce to this value — reflecting first avoids the cut.
  // Pinned against mpmath's elliprj, which agrees with this identity at these points.
  const cases: [number, number, number, number][] = [
    [1, 1, 1, 1],
    [0, 1, 1, 1],
    [1, 2, 3, 4],
  ];
  for (const [x, y, z, w] of cases) {
    const reflected = carlsonRJ(cx(-x), cx(-y), cx(-z), cx(-w));
    const direct = carlsonRJ(cx(x), cx(y), cx(z), cx(w));
    // i·direct
    expect(reflected.re).toBeCloseTo(-direct.im, 10);
    expect(reflected.im).toBeCloseTo(direct.re, 10);
  }
});

test("the declared CarlsonRJ declines outside its verified argument regions, and stays symbolic there", () => {
  // Real arguments split across zero in a shape neither the CPV branch (p < 0, x,y,z ≥ 0)
  // nor the all-negative reflection covers -- e.g. y, z < 0 with p ≥ 0 (62b0c4/78131f), or
  // a positive x alongside two negative reals (303827/4c1db8/534335/e04867's replace side).
  for (const args of [
    [0, -1, 1, 1],
    [0, -1, -1, 1],
    [1, -1, -1, -1],
    [1, -1, -1, 1],
  ] as const) {
    expect(ce.box(["CarlsonRJ", ...args]).evaluate().json).toEqual(["CarlsonRJ", ...args]);
  }
  // Two complex arguments both past the cut (Re < 0) -- the region 9ccaef's RJ(a,b,1,1)
  // combo disagreed with mpmath's elliprj in, independent of any real-axis convention.
  const risky = ["CarlsonRJ", ["Complex", -0.3, 0.2], ["Complex", -0.5, 0.1], 1, 1] as const;
  expect(ce.box(risky).evaluate().json).toEqual(risky);
});

test("CarlsonRJ still evaluates numerically right next to a declined region", () => {
  // The nearest covered regions: all four ≥ 0 (no cut at all), and the documented p < 0,
  // x,y,z ≥ 0 Cauchy principal value -- both a hair away from the declined cases above.
  expect(num(["CarlsonRJ", 0, 1, 1, 1])).toBeCloseTo(2.356194490192345, 12); // RD(0,1,1) = 3π/4
  expect(num(["CarlsonRJ", 1, 1, 1, -1])).toBeCloseTo(-0.5651621397896542, 12);
  // One negative-real-part complex argument alone is fine -- only two or more trigger it.
  const c = ce.box(["CarlsonRJ", 1, 1, 1, ["Complex", -0.17, -0.45]]).N();
  expect(c.re).toBeCloseTo(0.9825362099800544, 10);
  expect(c.im).toBeCloseTo(1.5502940430834804, 10);
});
