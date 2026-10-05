// The part of ℤ/m's arithmetic compute-engine's `ResidueClass` doesn't do: reading a class, and
// the Chinese remainder theorem over classes. Sums, products, inverses and powers are native.

import { crtSolve, invMod, mod } from "./arith.ts";

/** A class `residue + mℤ`, with `0 ≤ residue < modulus`. */
export interface Residue {
  readonly residue: bigint;
  readonly modulus: bigint;
}

/** u/v in ℤ/m, or undefined when m < 1 or v is not a unit mod m. */
export function residue(num: bigint, den: bigint, modulus: bigint): Residue | undefined {
  if (modulus < 1n) return undefined;
  const inverse = den === 1n ? 1n : invMod(den, modulus);
  return inverse === undefined ? undefined : { residue: mod(num * inverse, modulus), modulus };
}

/** The class mod lcm of the moduli that reduces to every one given, if they are consistent. */
export function chineseRemainder(xs: readonly Residue[]): Residue | undefined {
  const solved = crtSolve(xs.map((x) => [x.residue, x.modulus] as const));
  return solved === undefined ? undefined : { residue: solved[0], modulus: solved[1] };
}
