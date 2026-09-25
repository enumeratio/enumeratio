import { factorInteger, isPrime } from "@enumeratio/residues";
import { adic } from "@enumeratio/numerals";
import * as P from "./profinite.ts";
import type { Profinite } from "./profinite.ts";
import * as Q from "./rational.ts";
import type { Q as Rational } from "./rational.ts";

type Adic = adic.Adic;

// The finite part of an idèle of Q: an element of the restricted product ∏' Q_p^*. Hertogh
// stores a multiplicative p-adic c·U(n) at finitely many primes and O_p^* everywhere else.
// Over Q every component factors as p^v·u with u a p-adic unit, so here the valuations
// ride in one positive rational `scale` (component at p = p^{v_p(scale)}·u_p) and the
// units are b-adics known modulo p^n — c·U(n) with n ≥ 1 is exactly "the unit part of c
// modulo p^n". A prime with no listed unit has its unit unknown (U(0)). A principal idèle,
// Hertogh's "exact finite part", is the rational itself at every prime.

export type IdeleFinite =
  | { readonly kind: "principal"; readonly value: Rational }
  | { readonly kind: "local"; readonly scale: Rational; readonly units: ReadonlyMap<bigint, Adic> };

/** Units known to nothing are dropped: n ≤ 0, and n ≤ 1 at 2, where every unit is 1 mod 2. */
const informative = (u: Adic): boolean => u.prec === undefined || u.prec > (u.base === 2n ? 1 : 0);

/**
 * A local finite part: p^{v_p(scale)}·c_p at each listed prime, p^{v_p(scale)}·(unknown
 * unit) elsewhere. Only the scale's valuations matter; a listed c_p of non-zero valuation
 * moves its p-power into the scale.
 */
export function local(scale: Rational, components: readonly Adic[]): IdeleFinite | undefined {
  if (Q.isZero(scale)) return undefined;
  let s = Q.abs(scale);
  const units: Adic[] = [];
  for (const c of components) {
    const p = c.base;
    if (!isPrime(p) || units.some((u) => u.base === p) || c.num === 0n) return undefined;
    const v = adic.valuationOf(c);
    if (v !== 0) s = Q.mul(s, v > 0 ? [p ** BigInt(v), 1n] : [1n, p ** BigInt(-v)]);
    const u = adic.unitPart(c);
    if (u === undefined) return undefined;
    units.push(u);
  }
  return withScale(s, units);
}

/** The unit part of a rational at p: q / p^{v_p(q)}, as an exact p-adic. */
const unitOf = (x: Rational, p: bigint): Adic => {
  const v = Q.valuationQ(x, p);
  const u = Q.mul(x, v >= 0 ? [1n, p ** BigInt(v)] : [p ** BigInt(-v), 1n]);
  return { base: p, num: u[0], den: u[1] };
};

export function multiply(x: IdeleFinite, y: IdeleFinite): IdeleFinite | undefined {
  if (x.kind === "principal" && y.kind === "principal") return { kind: "principal", value: Q.mul(x.value, y.value) };
  if (x.kind === "principal") return multiply(y, x);
  if (x.kind !== "local") return undefined;
  const units: Adic[] = [];
  if (y.kind === "principal") {
    for (const [p, u] of x.units) {
      const product = adic.multiply(u, unitOf(y.value, p));
      if (product === undefined) return undefined;
      units.push(product);
    }
    return withScale(Q.mul(x.scale, Q.abs(y.value)), units);
  }
  for (const [p, u] of x.units) {
    const other = y.units.get(p);
    if (other === undefined) continue;
    const product = adic.multiply(u, other);
    if (product === undefined) return undefined;
    units.push(product);
  }
  return withScale(Q.mul(x.scale, y.scale), units);
}

/** Units already carry valuation zero; attach the scale without re-reading valuations. */
function withScale(scale: Rational, units: readonly Adic[]): IdeleFinite {
  const map = new Map<bigint, Adic>();
  for (const u of units) if (informative(u)) map.set(u.base, u);
  return { kind: "local", scale, units: new Map([...map].sort(([a], [b]) => (a < b ? -1 : 1))) };
}

export function invert(x: IdeleFinite): IdeleFinite | undefined {
  if (x.kind === "principal") return { kind: "principal", value: Q.div(Q.ONE, x.value) };
  const units: Adic[] = [];
  for (const [p, u] of x.units) {
    const inverse = adic.divide({ base: p, num: 1n, den: 1n }, u);
    if (inverse === undefined) return undefined;
    units.push(inverse);
  }
  return withScale(Q.div(Q.ONE, x.scale), units);
}

export function power(x: IdeleFinite, n: bigint): IdeleFinite | undefined {
  let base: IdeleFinite | undefined = n < 0n ? invert(x) : x;
  let result: IdeleFinite | undefined = { kind: "principal", value: Q.ONE };
  for (let k = n < 0n ? -n : n; k > 0n && base !== undefined && result !== undefined; k >>= 1n) {
    if (k & 1n) result = multiply(result, base);
    if (k > 1n) base = multiply(base, base);
  }
  return result;
}

/** Two units agree where both are known. */
const unitsMeet = (u: Adic, w: Adic): boolean => {
  const difference = adic.subtract(u, w);
  if (difference === undefined) return false;
  return difference.num === 0n;
};

/** Hertogh's equality: the represented subsets meet. */
export function equal(x: IdeleFinite, y: IdeleFinite): boolean {
  if (x.kind === "principal" && y.kind === "principal") return Q.equal(x.value, y.value);
  if (x.kind === "principal") return equal(y, x);
  if (x.kind !== "local") return false;
  if (y.kind === "principal") {
    if (!Q.equal(x.scale, Q.abs(y.value))) return false;
    return [...x.units].every(([p, u]) => unitsMeet(u, unitOf(y.value, p)));
  }
  if (!Q.equal(x.scale, y.scale)) return false;
  return [...x.units].every(([p, u]) => {
    const w = y.units.get(p);
    return w === undefined || unitsMeet(u, w);
  });
}

/**
 * The finite adèle an idèle determines (Hertogh's `Adeles._from_idele`): at each prime the
 * coset p^v·(u + pⁿℤ_p) = p^v·u + p^{v+n}ℤ_p, glued by CRT — with n = 0 (only the valuation
 * known) at primes of the scale without a listed unit, and n ≥ 1 at 2, where every unit is
 * odd. An exactly known unit has no finite modulus, so it has no image here.
 */
export function toProfinite(x: IdeleFinite): Profinite | undefined {
  if (x.kind === "principal") return P.exact(x.value);
  const [num, den] = [factorInteger(x.scale[0]), factorInteger(x.scale[1])];
  if (num === undefined || den === undefined) return undefined;
  const primes = new Set<bigint>([2n, ...x.units.keys(), ...[...num, ...den].map(([p]) => p)]);
  const components: { p: bigint; value: Rational; prec: number }[] = [];
  for (const p of primes) {
    const v = Q.valuationQ(x.scale, p);
    const power: Rational = v >= 0 ? [p ** BigInt(v), 1n] : [1n, p ** BigInt(-v)];
    const u = x.units.get(p);
    if (u !== undefined && u.prec === undefined) return undefined;
    const unit: Rational = u === undefined ? Q.ONE : Q.q(u.num, u.den);
    const n = Math.max(u?.prec ?? 0, p === 2n ? 1 : 0);
    components.push({ p, value: Q.mul(power, unit), prec: v + n });
  }
  return P.fromPadics(components);
}
