// Every r-th root of a residue in ℤ[i]/(m): all x with xʳ ≡ b (mod m), for Gaussian b and m.
//
// Wolfram stops at the rational integers here — its PowerModList rejects a Gaussian argument,
// and its PowerMod looks only for integer roots — so this is new ground, built the same way
// as the integer case. m factors into Gaussian prime powers π^e and CRT glues one root per
// channel. What a channel looks like depends on how π lies over its rational prime p:
//
//   split     p ≡ 1 (mod 4), π ≠ π̄: ℤ[i]/(π^e) ≅ ℤ/p^e by i ↦ t, the square root of −1 mod
//             p^e that π^e divides t − i. The integer solver answers, and its roots come back
//             as rational integers.
//   inert     π = p ≡ 3 (mod 4): the residue field is 𝔽_{p²}, whose units are cyclic of order
//             p² − 1, so the Sylow root finder works there unchanged; Hensel lifts up the
//             powers of p as it does for integers, with p² lifts to try at a singular root.
//   ramified  π = 1 + i: the residue field is 𝔽₂, so each lift has two candidates to test.

import {
  add,
  compare,
  divideExact,
  equal,
  factorGaussian,
  type Gaussian,
  inverseMod,
  isReal,
  isUnit,
  isZero,
  mod,
  mul,
  norm,
  ONE,
  powerModRaw,
  sub,
  ZERO,
} from "./gaussian.ts";
import { type Group, rootsInCyclicGroup } from "./cyclic.ts";
import { MAX_ROOTS, powerModRoots } from "./roots.ts";

/** Gaussian arithmetic with each part reduced into [0, q), q a positive rational integer. */
const reduceParts = (z: Gaussian, q: bigint): Gaussian => [
  ((z[0] % q) + q) % q,
  ((z[1] % q) + q) % q,
];

/** zᵉ with parts reduced mod q, e ≥ 0. */
function powParts(z: Gaussian, e: bigint, q: bigint): Gaussian {
  let result: Gaussian = reduceParts(ONE, q);
  let base = reduceParts(z, q);
  for (let k = e; k > 0n; k >>= 1n) {
    if (k & 1n) result = reduceParts(mul(result, base), q);
    base = reduceParts(mul(base, base), q);
  }
  return result;
}

/** 𝔽_{p²}* as Gaussian residues mod an inert p. */
const inertField = (p: bigint): Group<Gaussian> => ({
  one: ONE,
  mul: (a, b) => reduceParts(mul(a, b), p),
  pow: (a, e) => powParts(a, e, p),
  inverse: (a) => inverseMod(a, [p, 0n]) ?? ZERO,
  equal,
  key: (a) => `${a[0]},${a[1]}`,
});

function* inertElements(p: bigint): Iterable<Gaussian> {
  for (let im = 1n; im < p; im++) for (let re = 0n; re < p; re++) yield [re, im];
}

/** Roots mod p^e for an inert p: 𝔽_{p²} first, then Hensel. */
function inertRoots(b: Gaussian, r: bigint, p: bigint, e: number): Gaussian[] | undefined {
  const target = reduceParts(b, p ** BigInt(e));
  let roots: Gaussian[] | undefined;
  const residue = reduceParts(target, p);
  if (isZero(residue)) roots = [ZERO];
  else
    roots = rootsInCyclicGroup(
      inertField(p),
      p * p - 1n,
      residue,
      r,
      () => inertElements(p),
      MAX_ROOTS,
    );
  if (roots === undefined) return undefined;
  let modulus = p;
  for (let k = 1; k < e && roots.length > 0; k++) {
    const next = modulus * p;
    const lifted: Gaussian[] = [];
    for (const x of roots) {
      const value = reduceParts(sub(powParts(x, r, next), target), next); // ≡ 0 mod p^k
      const slope = reduceParts(mul([r, 0n], powParts(x, r - 1n, p)), p);
      if (!isZero(slope)) {
        const quotient: Gaussian = [value[0] / modulus, value[1] / modulus];
        const t = reduceParts(mul([-1n, 0n], mul(quotient, inverseMod(slope, [p, 0n])!)), p);
        lifted.push(add(x, mul(t, [modulus, 0n])));
      } else if (isZero(value)) {
        if (lifted.length + Number(p * p) > MAX_ROOTS) return undefined;
        for (const t of [ZERO, ...inertElements(p), ...zeroImaginary(p)]) {
          lifted.push(add(x, mul(t, [modulus, 0n])));
        }
      }
    }
    roots = lifted;
    modulus = next;
  }
  return roots;
}

/** The residues re + 0i, 0 < re < p — the part of 𝔽_p² `inertElements` leaves out. */
function* zeroImaginary(p: bigint): Iterable<Gaussian> {
  for (let re = 1n; re < p; re++) yield [re, 0n];
}

/** Roots mod (1 + i)^e, two candidates per lift. */
function ramifiedRoots(b: Gaussian, r: bigint, e: number): Gaussian[] | undefined {
  const pi: Gaussian = [1n, 1n];
  let power = ONE;
  let roots: Gaussian[] = [ZERO];
  for (let k = 0; k < e; k++) {
    const next = mul(power, pi);
    const lifted: Gaussian[] = [];
    for (const x of roots) {
      for (const t of [ZERO, ONE]) {
        const y = add(x, mul(t, power));
        if (isZero(mod(sub(powerModRaw(y, r, next), b), next)!)) lifted.push(y);
      }
    }
    if (lifted.length > MAX_ROOTS) return undefined;
    roots = lifted;
    power = next;
  }
  return roots;
}

/** Roots mod π^e for a split π over p, through ℤ[i]/(π^e) ≅ ℤ/p^e. */
function splitRoots(b: Gaussian, r: bigint, pi: Gaussian, e: number): Gaussian[] | undefined {
  const p = norm(pi);
  const q = p ** BigInt(e);
  let piPower = ONE;
  for (let k = 0; k < e; k++) piPower = mul(piPower, pi);
  const t = powerModRoots(q - 1n, 2n, q)!.find((s) => divideExact([s, -1n], piPower) !== undefined);
  if (t === undefined) return undefined; // unreachable: one of the two roots belongs to π
  const image = (((b[0] + b[1] * t) % q) + q) % q;
  return powerModRoots(image, r, q)?.map((y): Gaussian => [y, 0n]);
}

/**
 * Every x with xʳ ≡ b (mod m) in ℤ[i], each reduced as `mod` reduces, sorted by real part then
 * imaginary. Undefined when m cannot be factored or there would be more than `MAX_ROOTS`.
 */
export function gaussianRoots(b: Gaussian, r: bigint, m: Gaussian): Gaussian[] | undefined {
  if (r < 1n || isZero(m)) return undefined;
  if (isUnit(m)) return [ZERO];
  const factors = factorGaussian(m);
  if (factors === undefined) return undefined;
  const channels: { modulus: Gaussian; roots: Gaussian[] }[] = [];
  let count = 1;
  for (const [pi, e] of factors) {
    if (isUnit(pi)) continue;
    let modulus = ONE;
    for (let k = 0; k < e; k++) modulus = mul(modulus, pi);
    const roots = equal(pi, [1n, 1n])
      ? ramifiedRoots(b, r, e)
      : isReal(pi)
        ? inertRoots(b, r, pi[0], e)
        : splitRoots(b, r, pi, e);
    if (roots === undefined) return undefined;
    if (roots.length === 0) return [];
    count *= roots.length;
    if (count > MAX_ROOTS) return undefined;
    channels.push({ modulus, roots });
  }
  let glued: Gaussian[] = [ZERO];
  let combined = ONE;
  for (const { modulus, roots } of channels) {
    const inverse = inverseMod(combined, modulus) ?? ZERO;
    glued = glued.flatMap((x) =>
      roots.map((c) => add(x, mul(combined, mod(mul(sub(c, x), inverse), modulus)!))),
    );
    combined = mul(combined, modulus);
  }
  return glued.map((x) => mod(x, m)!).sort(compare);
}

/**
 * `PowerModList[a, s/r, m]` over ℤ[i]: every x with xʳ ≡ aˢ (mod m). Empty where aˢ does not
 * exist — a non-unit to a negative power.
 */
export function gaussianPowerModList(
  a: Gaussian,
  s: bigint,
  r: bigint,
  m: Gaussian,
): Gaussian[] | undefined {
  if (r < 1n || isZero(m)) return undefined;
  const base = s < 0n ? inverseMod(a, m) : a;
  if (base === undefined) return [];
  const power = powerModRaw(base, s < 0n ? -s : s, m);
  return gaussianRoots(power, r, m);
}
