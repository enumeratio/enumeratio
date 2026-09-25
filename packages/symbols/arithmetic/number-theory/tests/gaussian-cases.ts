// The Gaussian golden corpus: its shape, and our side of each case in Wolfram's encoding — a
// Gaussian integer is a bare integer when real and `["C", re, im]` otherwise; a call Wolfram
// leaves unevaluated is `null`.

import {
  divisorsGaussian,
  extendedGcd,
  factorGaussian,
  type Gaussian,
  gcd,
  inverseMod,
  isGaussianPrime,
  lcm,
  mod,
  powerMod,
  quotient,
} from "../src/gaussian.ts";

/** A Gaussian integer as [re, im]; an exponent as a number, or as a string past a double. */
export type Value = readonly [number, number] | number | string;

export interface GoldenCase {
  readonly op: string;
  readonly args: readonly Value[];
  readonly wolfram: unknown;
}

const read = (v: Value): Gaussian => (typeof v === "object" ? [BigInt(v[0]), BigInt(v[1])] : [BigInt(v), 0n]);
const big = (v: Value): bigint => (typeof v === "object" ? BigInt(v[0]) : BigInt(v));

export const encode = (z: Gaussian | undefined): unknown =>
  z === undefined ? null : z[1] === 0n ? Number(z[0]) : ["C", Number(z[0]), Number(z[1])];

const factors = (fs: [Gaussian, number][] | undefined): unknown =>
  fs === undefined ? null : fs.map(([p, e]) => [encode(p), e]);

export function ours({ op, args }: Omit<GoldenCase, "wolfram">): unknown {
  const [a, b, c] = args;
  switch (op) {
    case "Mod":
      return encode(mod(read(a!), read(b!)));
    case "Quotient":
      return encode(quotient(read(a!), read(b!)));
    case "GCD":
      return encode(gcd(read(a!), read(b!)));
    case "LCM":
      return encode(lcm(read(a!), read(b!)));
    case "ExtendedGCD": {
      const [g, s, t] = extendedGcd(read(a!), read(b!));
      return [encode(g), [encode(s), encode(t)]];
    }
    case "ModularInverse":
      return encode(inverseMod(read(a!), read(b!)));
    case "PowerMod":
      return encode(powerMod(read(a!), big(b!), read(c!)));
    case "PrimeQ":
    case "PrimeQG":
      return isGaussianPrime(read(a!));
    case "FactorInteger":
    case "FactorIntegerG":
      return factors(factorGaussian(read(a!)));
    case "Divisors":
    case "DivisorsG":
      return divisorsGaussian(read(a!))?.map(encode) ?? null;
    default:
      throw new Error(`unknown op ${op}`);
  }
}
