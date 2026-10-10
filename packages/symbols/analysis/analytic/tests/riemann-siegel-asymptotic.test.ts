// unstable: BigDecimal and the engine, the classes compute-engine's boxed numbers are; no /numerics subpath yet
import { BigDecimal, ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";
import { MAX_TERMS, remainderCoefficients, truncationError } from "../src/riemann-siegel-asymptotic.ts";

// RiemannSiegelZ at large |Re t|, for real and complex t, by the Riemann–Siegel formula with
// Gabcke's remainder (src/riemann-siegel-asymptotic.ts). Reference values are mpmath 1.3.0,
// mp.dps = 70, as exp(1j*siegeltheta(t)) * zeta(0.5 + 1j*t) (its zeta runs Euler–Maclaurin to
// t ≈ 10⁵ and its own Riemann–Siegel expansion past that); the imaginary parts of the grid are
// well away from zero, so they carry all their digits.

const ce = new ComputeEngine();
declareAnalytic(ce);

const rel = (got: number, want: string): number => Math.abs(got - Number(want)) / Math.abs(Number(want));
const digits = (json: unknown, n: number): string =>
  new BigDecimal((json as { num: string }).num).toPrecision(n).toString();

/** [Re t, Im t, Re Z, Im Z] */
type Row = readonly [number, number, string, string];

const GRID: readonly Row[] = [
  [20000, -1, "27.9823617104757761990147260131158761737598212", "54.2174505807886297001442033064478742255818621"],
  [20000, -0.1, "1.44405847238296680152413383379788901312046099", "0.98074696374434930426236499595908062283048773"],
  [20000, 0.1, "1.44405847238296680152413383379788901312046099", "-0.98074696374434930426236499595908062283048773"],
  [20000, 1, "27.9823617104757761990147260131158761737598212", "-54.2174505807886297001442033064478742255818621"],
  [100000, -1, "95.3781812075053710321504921447240414988691515", "-147.774984189469009288080443169409822198929493"],
  [100000, -0.1, "6.15365120467390800833361983434567446779359545", "-1.67001641843237843173992359070818557530713828"],
  [100000, 0.1, "6.15365120467390800833361983434567446779359545", "1.67001641843237843173992359070818557530713828"],
  [100000, 1, "95.3781812075053710321504921447240414988691515", "147.774984189469009288080443169409822198929493"],
  [1000000, -1, "-165.310662924954665836143276511149846746598093", "369.8924150805928377954360545286551706449007"],
  [1000000, -0.1, "-3.02713559500379543511372160150145224541927372", "1.27489061198545203884342144195327512441970829"],
  [1000000, 0.1, "-3.02713559500379543511372160150145224541927372", "-1.27489061198545203884342144195327512441970829"],
  [1000000, 1, "-165.310662924954665836143276511149846746598093", "-369.8924150805928377954360545286551706449007"],
];

const ASKED = 30;

const complexAt = (x: number, y: number) => ce.box(["RiemannSiegelZ", ["Complex", x, y]] as never).N();

test("the remainder's coefficients: Gabcke's C_1..C_4, and the constant terms past them", () => {
  const as = (k: number) =>
    remainderCoefficients(k)
      .map(([m, [n, d]]) => `${m}:${n}/${d}`)
      .toSorted();
  expect(as(1)).toEqual(["3:-1/96"]);
  expect(as(2)).toEqual(["2:1/64", "6:1/18432"]);
  expect(as(3)).toEqual(["1:-1/64", "5:-1/3840", "9:-1/5308416"]);
  expect(as(4)).toEqual(["0:1/128", "12:1/2038431744", "4:19/24576", "8:11/5898240"]);
  // the free constants of the recurrence are the Euler numbers': 5/4096 + (1/128)²/2 at k = 8
  expect(remainderCoefficients(8).find(([m]) => m === 0)?.[1]).toEqual([41n, 32768n]);
  expect(remainderCoefficients(MAX_TERMS)).not.toHaveLength(0);
});

test("the truncation estimate shrinks with t and with the terms kept", () => {
  expect(truncationError(1e5, 8)).toBeLessThan(truncationError(1e4, 8));
  expect(truncationError(1e5, 12)).toBeLessThan(truncationError(1e5, 8));
  expect(truncationError(1e6, 12)).toBeLessThan(1e-40);
});

test("a complex t at large |Re t| keeps a double's digits", () => {
  for (const [x, y, re, im] of [GRID[0]!, GRID[5]!, GRID[11]!]) {
    const z = complexAt(x, y);
    expect(rel(z.re, re), `${x} ${y}`).toBeLessThan(5e-16);
    expect(rel(z.im, im), `${x} ${y}`).toBeLessThan(5e-16);
  }
  // from |Re t| ≈ 100, where the log-gamma behind the old complex ϑ overflows from ~450
  const mid: ReadonlyArray<Row> = [
    [300, 2, "-27.5727228565569079467721695402657436", "-45.1628109462481030621142432594717653"],
    [1000, 3, "581.170923781818978128541204198660450", "1870.55358625754185270402659565048762"],
    [5000, 20, "-5.3262745968434990589896232865392e28", "8.6799729275830108220403597961949e28"],
  ];
  for (const [x, y, re, im] of mid) {
    const z = complexAt(x, y);
    expect(rel(z.re, re), `${x} ${y}`).toBeLessThan(5e-16);
    expect(rel(z.im, im), `${x} ${y}`).toBeLessThan(5e-16);
  }
});

test("a real t from 2000 on keeps a double's digits too", () => {
  for (const [x, want] of [
    [3000.5, "4.068326911935348981572705623576208792"],
    [100000.5, "4.634042594998132402058704410429586534"],
    [1000000.5, "-0.9355806515679346730841526431411039616"],
  ] as const) {
    expect(rel(ce.box(["RiemannSiegelZ", x]).N().re, want), `${x}`).toBeLessThan(5e-16);
  }
});

test("Z is even, for complex t as for real", () => {
  const [a, b] = [complexAt(20000, 1), complexAt(-20000, -1)];
  expect(b.re).toBe(a.re);
  expect(b.im).toBe(a.im);
});

test("N(…, d) takes it as far as its terms reach: the imaginary part of Z(10⁵ − 10⁻⁵⁰ i)", () => {
  // Im Z(x + iy) = y Z′(x) = −10⁻⁵⁰ · 16.2303586733695867443080288746… (mpmath's siegelz(x, derivative=1));
  // the Ziv loop behind N(…, 20) asks for 40 and 60 digits of the argument's Z, so this is a 60-digit
  // Riemann–Siegel sum, about 20 remainder terms.
  const t = ["Add", 100000, ["Multiply", ["Complex", 0, -1], ["Power", 10, -50]]];
  expect(ce.box(["N", ["Imaginary", ["RiemannSiegelZ", t]], 20] as never).evaluate().json).toEqual({
    num: "-1.6230358673369586744e-49",
  });
});

test("it declines rather than answer past its reach", () => {
  // |Im t| past ½√|Re t| is outside the series (and the old complex ϑ overflows from |Re t| ≈ 450)
  expect(ce.box(["RiemannSiegelZ", ["Complex", 1000, 40]]).N().operator).toBe("RiemannSiegelZ");
  // more digits than the terms hold at t = 10⁴, and no Euler–Maclaurin sum for a complex t that large
  expect(ce.box(["N", ["RiemannSiegelZ", ["Complex", 30000, 1]], 90] as never).evaluate().operator).toBe(
    "RiemannSiegelZ",
  );
  // past the main sum's √t terms
  expect(ce.box(["RiemannSiegelZ", 1e12]).N().operator).toBe("RiemannSiegelZ");
});

test.skipIf(process.env["DEEP_TESTS"] !== "1")(
  "the grid Re t ∈ {2·10⁴, 10⁵, 10⁶} × Im t ∈ {±1, ±0.1}: a double's digits, and 30 digits asked for",
  () => {
    let worst = 0;
    for (const [x, y, re, im] of GRID) {
      const z = complexAt(x, y);
      worst = Math.max(worst, rel(z.re, re), rel(z.im, im));
      const n = ce.box(["N", ["RiemannSiegelZ", ["Complex", x, y]], ASKED] as never).evaluate()
        .json as unknown as unknown[];
      expect(digits(n[1], ASKED), `${x} ${y}`).toBe(new BigDecimal(re).toPrecision(ASKED).toString());
      expect(digits(n[2], ASKED), `${x} ${y}`).toBe(new BigDecimal(im).toPrecision(ASKED).toString());
    }
    expect(worst).toBeLessThan(2e-16);
  },
);
