import { expect, test } from "vite-plus/test";
import { cosPi, sinPi } from "../src/complex.ts";

// sinPi/cosPi reduce x mod 2 before calling Math.sin/cos, so they can lose precision right
// where they're supposed to be exact: near an integer or half-integer, the reduced argument
// itself sits near a zero or extremum of the trig function, and naive reduction (`((x%2)+2)%2`,
// or even a plain `x - 2·⌊x/2⌋`) reintroduces the cancellation the reduction was supposed to
// avoid. These points stress exactly that: just off 0, 1, 2, −3, and 0.5 (both sides), plus a
// large-magnitude case (1e6, 2⁴⁰) to check the reduction itself stays exact far from the origin.
// Reference values from mpmath.sinpi/cospi at 40 digits, rounded to the nearest double.
const cases: readonly [x: number, sinpi: number, cospi: number][] = [
  [1e-6, 3.1415926535846256e-6, 0.9999999999950652],
  [-1e-6, -3.1415926535846256e-6, 0.9999999999950652],
  [1 + 1e-6, -3.141592653326177e-6, -0.9999999999950652],
  [1 - 1e-6, 3.141592653674964e-6, -0.9999999999950652],
  [2 + 1e-6, 3.1415926540237508e-6, 0.9999999999950652],
  [2 - 1e-6, -3.141592653326177e-6, 0.9999999999950652],
  [-3 + 1e-9, -3.141592913526335e-9, -1],
  [-3 - 1e-9, 3.141592913526335e-9, -1],
  [0.5 + 1e-9, 1, -3.141592564739485e-9],
  [0.5 - 1e-9, 1, 3.14159273913291e-9],
  [1e6 + 1e-6, 3.1416165752210576e-6, 0.9999999999950652],
  [2 ** 40 + 0.5, 1, 0],
];

// Relative error in ULPs, good to a factor of 2 across the value range above (all of order
// 1e-9 to 1) — exact enough to tell "correctly rounded" from "off by a cancellation".
const ulps = (got: number, want: number): number =>
  Math.abs(got - want) / (Number.EPSILON * Math.max(Math.abs(want), 1));

test("sinPi and cosPi stay correctly rounded next to an integer or half-integer, not just at one", () => {
  for (const [x, wantSin, wantCos] of cases) {
    expect(ulps(sinPi(x), wantSin), `sinPi(${x})`).toBeLessThanOrEqual(2);
    expect(ulps(cosPi(x), wantCos), `cosPi(${x})`).toBeLessThanOrEqual(2);
  }
});

test("sinPi and cosPi are exact at integers and half-integers", () => {
  for (const n of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) {
    expect(sinPi(n)).toBe(0);
    expect(cosPi(n)).toBe(n % 2 === 0 ? 1 : -1);
  }
  for (const n of [-3.5, -1.5, -0.5, 0.5, 1.5, 3.5]) {
    expect(cosPi(n)).toBe(0);
    expect(Math.abs(sinPi(n))).toBe(1);
  }
});
