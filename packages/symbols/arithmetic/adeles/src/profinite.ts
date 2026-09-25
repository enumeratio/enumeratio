import { crt, gcd, invMod, mod } from "@enumeratio/residues";
import * as Q from "./rational.ts";
import type { Q as Rational } from "./rational.ts";

// Profinite numbers Q̂ = Ẑ ⊗ Q, as Hertogh's `ProfiniteNumbers(QQ)` holds them: an element is
// the coset x + mẐ, a rational `value` known modulo a rational `modulus` ≥ 0, with 0 meaning
// exact. Since mẐ ∩ Q = mℤ, the coset is fixed by x mod m, so the normal form keeps the
// value in [0, m) and two equal cosets have one spelling. Ẑ is the integral part: value and
// modulus both integers.
//
// Arithmetic answers with the smallest coset holding every result: the modulus of a sum is
// the gcd of the moduli, of a product the gcd of the cross terms. Equality is Hertogh's:
// the cosets meet, which is not transitive (6 mod 20 = 6 mod 40, 26 mod 40 ≠ 6 mod 40).

export interface Profinite {
  readonly value: Rational;
  readonly modulus: Rational;
}

export function profinite(value: Rational, modulus: Rational = Q.ZERO): Profinite {
  const m = Q.abs(modulus);
  if (Q.isZero(m)) return { value, modulus: m };
  return { value: Q.sub(value, Q.mul(m, [Q.floor(Q.div(value, m)), 1n])), modulus: m };
}

export const exact = (x: Rational): Profinite => ({ value: x, modulus: Q.ZERO });
export const isExact = (x: Profinite): boolean => Q.isZero(x.modulus);

export const add = (x: Profinite, y: Profinite): Profinite =>
  profinite(Q.add(x.value, y.value), Q.gcdQ(x.modulus, y.modulus));

export const negate = (x: Profinite): Profinite => profinite(Q.neg(x.value), x.modulus);

export function multiply(x: Profinite, y: Profinite): Profinite {
  const cross = Q.gcdQ(
    Q.gcdQ(Q.mul(Q.abs(x.value), y.modulus), Q.mul(Q.abs(y.value), x.modulus)),
    Q.mul(x.modulus, y.modulus),
  );
  return profinite(Q.mul(x.value, y.value), cross);
}

/** x / y for an exact, non-zero y; any other divisor has no single coset for a quotient. */
export function divide(x: Profinite, y: Profinite): Profinite | undefined {
  if (!isExact(y) || Q.isZero(y.value)) return undefined;
  return multiply(x, exact(Q.div(Q.ONE, y.value)));
}

/** xⁿ for n ≥ 0; a negative power only of an exact, non-zero x. */
export function power(x: Profinite, n: bigint): Profinite | undefined {
  if (n < 0n) {
    const inverse = divide(exact(Q.ONE), x);
    return inverse === undefined ? undefined : power(inverse, -n);
  }
  let result = exact(Q.ONE);
  let base = x;
  for (let k = n; k > 0n; k >>= 1n) {
    if (k & 1n) result = multiply(result, base);
    if (k > 1n) base = multiply(base, base);
  }
  return result;
}

/** Hertogh's equality: the two cosets meet. */
export function equal(x: Profinite, y: Profinite): boolean {
  const difference = Q.sub(x.value, y.value);
  const common = Q.gcdQ(x.modulus, y.modulus);
  return Q.isZero(common) ? Q.isZero(difference) : Q.isInteger(Q.div(difference, common));
}

/** Does the coset contain the rational `r`? */
export const represents = (x: Profinite, r: Rational): boolean => equal(x, exact(r));

/** The least d ≥ 1 with d·x ⊂ Ẑ. */
export const denominator = (x: Profinite): bigint => Q.lcm(x.value[1], x.modulus[1]);

export const numerator = (x: Profinite): Profinite => {
  const d: Rational = [denominator(x), 1n];
  return profinite(Q.mul(x.value, d), Q.mul(x.modulus, d));
};

export const isIntegral = (x: Profinite): boolean => denominator(x) === 1n;

/**
 * The p-adic image of x as a value known modulo p^prec, or `prec` undefined when x is
 * exact. A modulus with p-adic valuation e pins x down modulo pᵉ in Q_p.
 */
export function toPadic(x: Profinite, p: bigint): { value: Rational; prec?: number } {
  if (isExact(x)) return { value: x.value };
  return { value: x.value, prec: Q.valuationQ(x.modulus, p) };
}

/**
 * The profinite number that is `value` mod p^prec at each listed prime and merely
 * integral everywhere else — the CRT of the p-adic components. Primes must be distinct.
 */
export function fromPadics(components: readonly { p: bigint; value: Rational; prec: number }[]): Profinite | undefined {
  const primes = new Set(components.map((c) => c.p));
  if (primes.size !== components.length) return undefined;
  // Clear every p-power denominator first, so each component is a p-adic integer.
  let scale = 1n;
  for (const { p, value, prec } of components) {
    const low = Math.min(Q.isZero(value) ? prec : Q.valuationQ(value, p), prec);
    if (low < 0) scale *= p ** BigInt(-low);
  }
  const channels: [bigint, bigint][] = [];
  for (const { p, value, prec } of components) {
    const [num, den] = Q.mul(value, [scale, 1n]);
    let shift = 0n;
    for (let s = scale; s % p === 0n; s /= p) shift++;
    const modulus = p ** (BigInt(prec) + shift);
    // den is prime to p once the p-part of the denominator is cleared.
    const inverse = invMod(den, modulus);
    if (inverse === undefined) return undefined;
    channels.push([mod(num * inverse, modulus), modulus]);
  }
  const modulus = channels.reduce((acc, [, m]) => acc * m, 1n);
  return profinite(Q.q(crt(channels), scale), Q.q(modulus, scale));
}

// Fibonacci-type sequences are continuous on Ẑ (Lenstra, "Profinite Fibonacci numbers"):
// uₙ mod M depends only on n mod N once the sequence has period dividing N mod M, i.e. once
// (u_N, u_{N+1}) ≡ (u₀, u₁). So the image of a + Nℤ̂ is u_a known modulo
// gcd(u_N − u₀, u_{N+1} − u₁).

/** Moduli beyond this make u_N itself unreasonably long (u_N has ~0.7·N bits). */
export const MAX_SEQUENCE_MODULUS = 1n << 20n;

/** [Fₙ, Fₙ₊₁] by fast doubling, reduced mod m when m is given. */
export function fibonacciPair(n: bigint, m?: bigint): [bigint, bigint] {
  const r = (x: bigint): bigint => (m === undefined ? x : mod(x, m));
  let [a, b] = [0n, 1n];
  for (const bit of n.toString(2)) {
    const [c, d] = [r(a * (2n * b - a)), r(a * a + b * b)];
    [a, b] = bit === "1" ? [d, r(c + d)] : [c, d];
  }
  return [a, b];
}

type Sequence = (n: bigint, m?: bigint) => [bigint, bigint];

const lucasPair: Sequence = (n, m) => {
  const [f0, f1] = fibonacciPair(n, m);
  // Lₙ = Fₙ₋₁ + Fₙ₊₁ = 2Fₙ₊₁ − Fₙ and Lₙ₊₁ = Fₙ + Fₙ₊₂ = 2Fₙ + Fₙ₊₁.
  const [l0, l1] = [2n * f1 - f0, 2n * f0 + f1];
  return m === undefined ? [l0, l1] : [mod(l0, m), mod(l1, m)];
};

function sequenceAt(pair: Sequence, x: Profinite): Profinite | undefined {
  if (!isIntegral(x)) return undefined;
  const [a, n] = [x.value[0], x.modulus[0]];
  const [u0, u1] = pair(0n);
  if (n === 0n) {
    if (a < 0n) return undefined;
    return exact([pair(a)[0], 1n]);
  }
  if (n > MAX_SEQUENCE_MODULUS) return undefined;
  const [uN, uN1] = pair(n);
  const m = gcd(uN - u0, uN1 - u1);
  return profinite([pair(a, m)[0], 1n], [m, 1n]);
}

export const fibonacci = (x: Profinite): Profinite | undefined => sequenceAt(fibonacciPair, x);
export const lucas = (x: Profinite): Profinite | undefined => sequenceAt(lucasPair, x);
