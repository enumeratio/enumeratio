// Elements of ℤ/m as values: a residue in [0, m) and its modulus.
//
// Two residues with different moduli meet in ℤ/gcd(m, n) — the largest ring both map onto
// — which is Sage's coercion too: Mod(2, 4) + Mod(1, 6) is 1 in ℤ/2. A bare integer (or a
// rational whose denominator is a unit) is read in whatever ring it meets.

import { crtSolve, gcd, invMod, mod, powMod } from "./arith.ts";

export interface IntegerMod {
  readonly residue: bigint;
  readonly modulus: bigint;
}

/** u/v in ℤ/m, or undefined when m < 1 or v is not a unit mod m. */
export function integerMod(num: bigint, den: bigint, modulus: bigint): IntegerMod | undefined {
  if (modulus < 1n) return undefined;
  const inverse = den === 1n ? 1n : invMod(den, modulus);
  return inverse === undefined ? undefined : { residue: mod(num * inverse, modulus), modulus };
}

/** The same class read in ℤ/n, for n dividing its modulus. */
const reduce = (x: IntegerMod, n: bigint): IntegerMod => ({
  residue: mod(x.residue, n),
  modulus: n,
});

const meet = (x: IntegerMod, y: IntegerMod): [IntegerMod, IntegerMod] => {
  const n = gcd(x.modulus, y.modulus);
  return [reduce(x, n), reduce(y, n)];
};

export function add(x: IntegerMod, y: IntegerMod): IntegerMod {
  const [a, b] = meet(x, y);
  return { residue: mod(a.residue + b.residue, a.modulus), modulus: a.modulus };
}

export function multiply(x: IntegerMod, y: IntegerMod): IntegerMod {
  const [a, b] = meet(x, y);
  return { residue: mod(a.residue * b.residue, a.modulus), modulus: a.modulus };
}

export const negate = (x: IntegerMod): IntegerMod => ({
  residue: mod(-x.residue, x.modulus),
  modulus: x.modulus,
});

/** x⁻¹, or undefined when x is not a unit. */
export function inverse(x: IntegerMod): IntegerMod | undefined {
  const residue = invMod(x.residue, x.modulus);
  return residue === undefined ? undefined : { residue, modulus: x.modulus };
}

export function divide(x: IntegerMod, y: IntegerMod): IntegerMod | undefined {
  const [a, b] = meet(x, y);
  const b1 = inverse(b);
  return b1 === undefined ? undefined : multiply(a, b1);
}

/** xᵉ; a negative e inverts first, so needs a unit. */
export function power(x: IntegerMod, e: bigint): IntegerMod | undefined {
  const base = e < 0n ? inverse(x) : x;
  if (base === undefined) return undefined;
  return { residue: powMod(base.residue, e < 0n ? -e : e, x.modulus), modulus: x.modulus };
}

/** The class mod lcm of the moduli that reduces to every one given, if they are consistent. */
export function chineseRemainder(xs: readonly IntegerMod[]): IntegerMod | undefined {
  const solved = crtSolve(xs.map((x) => [x.residue, x.modulus] as const));
  return solved === undefined ? undefined : { residue: solved[0], modulus: solved[1] };
}
