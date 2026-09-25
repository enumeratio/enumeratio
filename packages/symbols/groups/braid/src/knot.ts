import { type Braid, braid, torusBraid } from "./braid.ts";
import { add, constant, type Laurent, monomial, normalise } from "./laurent.ts";

// A knot, separate from any braid that happens to present it.
//
// Every knot is the closure of some braid (Alexander's theorem), so a braid is the
// presentation every invariant can fall back on. But a knot that arrives already named
// carries more than that: T(p, q) has closed forms for its Alexander and Jones
// polynomials that owe nothing to a diagram, and a braid for it exists only when
// p ≥ 2 and both winding numbers are small enough to write a word for.
//
// Keeping both means one head, `JonesPolynomial`, can take whichever the caller has and
// answer by the cheapest route it knows — rather than a separate head per presentation.
//
// A knot can be named by more than one closed form now (torus, twist, pretzel), so
// `closed` is a tagged union rather than a field per family — the record does not grow
// one optional slot per name added.

/** The winding numbers of a torus knot, when the knot was named as one. */
export interface TorusParameters {
  p: number;
  q: number;
}

/** The half-twist count of a twist knot, when the knot was named as one. */
export interface TwistParameters {
  n: number;
}

/** The three band twists of a pretzel knot, when the knot was named as one. */
export interface PretzelParameters {
  p: number;
  q: number;
  r: number;
}

/** How a knot was named, when it was named by a closed form rather than only a braid. */
export type ClosedForm =
  | { kind: "torus"; torus: TorusParameters }
  | { kind: "twist"; twist: TwistParameters }
  | { kind: "pretzel"; pretzel: PretzelParameters };

/** A knot, however it was named. At least one of `braid` and `closed` is present. */
export interface Knot {
  /** The braid whose closure this is, when a word for it is available. */
  braid?: Braid;
  /** The closed form it was named by, when it was named by one. */
  closed?: ClosedForm;
}

/**
 * T(p, q) — the knot that winds p times one way and q the other round a torus.
 *
 * The braid is attached when there is one; T(1, q) is the unknot and has no braid word
 * in this presentation, which is why `braid` is optional rather than a failure.
 */
export function torusKnot(p: number, q: number): Knot | undefined {
  if (!Number.isInteger(p) || !Number.isInteger(q)) return undefined;
  return { closed: { kind: "torus", torus: { p, q } }, braid: torusBraid(p, q) };
}

/**
 * The twist knot with n half-twists: a clasp (two crossings) plus n further half-twists
 * in a band, for any nonzero integer n (either sign — the two signs are mirror families,
 * and neither is privileged). n = 1 is the figure-eight knot and n = −1 is the trefoil,
 * which is why `FigureEightKnot` is documented as `TwistKnot(1)` rather than `TwistKnot(2)`:
 * the "2" in "two half-twists" is the clasp's own crossings, already folded into every
 * member of the family, and n counts what is added on top of it.
 *
 * A braid word is attached only where this package already has one on file for the
 * specific knot the closed form describes — there is no known simple braid-word family
 * in n for twist knots in general (they are 2-bridge, not naturally a braid closure), so
 * the general case is the closed form only, same as a torus knot past the braid bound.
 */
export function twistKnot(n: number): Knot | undefined {
  if (!Number.isInteger(n) || n === 0) return undefined;
  const knownBraid =
    n === 1
      ? braid(3, [1, -2, 1, -2]) // the figure-eight: closure of σ₁σ₂⁻¹σ₁σ₂⁻¹
      : n === -1
        ? braid(2, [1, 1, 1]) // the trefoil
        : undefined;
  return { closed: { kind: "twist", twist: { n } }, braid: knownBraid };
}

/**
 * The pretzel knot P(p, q, r), for odd p, q, r (the case where the pretzel link is a
 * single-component knot rather than a link). Closed form only: a pretzel diagram's three
 * side-by-side twisted bands are not a braid word in any general way, unlike a torus
 * knot's winding or a twist knot's few small cases, so no braid is attached here.
 */
export function pretzelKnot(p: number, q: number, r: number): Knot | undefined {
  if (![p, q, r].every(Number.isInteger)) return undefined;
  if (![p, q, r].every((x) => x % 2 !== 0)) return undefined;
  return { closed: { kind: "pretzel", pretzel: { p, q, r } } };
}

/** The knot a braid closes to. */
export function knotOfBraid(braidWord: Braid): Knot {
  return { braid: braidWord };
}

/**
 * The Seifert genus of T(p, q), for coprime p and q: (p−1)(q−1)/2.
 *
 * The braid route (Bennequin on a positive braid) gives the same answer wherever a
 * braid word exists, and the tests check that it does. This covers the cases where
 * one does not — a winding number past what a braid word is written for.
 */
export function torusGenus(p: number, q: number): number | undefined {
  const [a, b] = [Math.abs(p), Math.abs(q)];
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) return undefined;
  // Only coprime winding numbers give a knot; otherwise T(p, q) is a link of gcd(p,q)
  // components and this genus is not the thing being asked for.
  if (gcd(a, b) !== 1) return undefined;
  return ((a - 1) * (b - 1)) / 2;
}

/**
 * The Seifert genus of a twist knot: always 1. Its Seifert surface is two disks joined by
 * two bands (the clasp and the twist region), so χ = 2 − 2 = 0 and g = (1 − χ)/2 = 1 —
 * however many half-twists n adds, the band count and so the genus never changes.
 */
export function twistGenus(n: number): number | undefined {
  return Number.isInteger(n) && n !== 0 ? 1 : undefined;
}

/**
 * The Seifert genus of P(p, q, r) for odd p, q, r: always 1, by the same count as a twist
 * knot — two disks joined by three bands gives χ = 2 − 3 = −1 and g = (1 − χ)/2 = 1.
 */
export function pretzelGenus(p: number, q: number, r: number): number | undefined {
  return [p, q, r].every((x) => Number.isInteger(x) && x % 2 !== 0) ? 1 : undefined;
}

/**
 * The closed-form Alexander polynomial of the twist knot with n half-twists:
 *
 *     Δ(t) = n·t² − (2n + 1)·t + n
 *
 * Checked against T(2, 3) (n = −1), the figure-eight (n = 1) and Wolfram's Stevedore knot
 * 6₁ (n = 2), which is what pins the sign of n against the number of half-twists.
 */
export function twistAlexander(n: number): Laurent | undefined {
  if (!Number.isInteger(n) || n === 0) return undefined;
  const raw = add(add(monomial(n, 2), monomial(-(2 * n + 1), 1)), constant(n));
  return normalise(raw);
}

/**
 * The closed-form Alexander polynomial of the pretzel knot P(p, q, r), for odd p, q, r:
 *
 *     Δ(t) = ¼[(pq + qr + rp)·(t − 2 + t⁻¹) + (t + 2 + t⁻¹)]
 *
 * from the genus-1 Seifert matrix of the standard 3-band pretzel surface. For any odd
 * p, q, r the bracket's coefficients come out through by 4 exactly (checked against the
 * trefoil P(1,1,1), the unknot P(1,1,−1), and P(1,1,n) against `twistAlexander` — a
 * pretzel with two ±1 bands is also a twist knot, and the two closed forms agree).
 */
export function pretzelAlexander(p: number, q: number, r: number): Laurent | undefined {
  if (![p, q, r].every((x) => Number.isInteger(x) && x % 2 !== 0)) return undefined;
  const s = p * q + q * r + r * p;
  if ((s + 1) % 4 !== 0) return undefined; // always true for odd p, q, r; guarded anyway
  const outer = (s + 1) / 4;
  const middle = (1 - s) / 2;
  const raw = add(add(monomial(outer, 1), constant(middle)), monomial(outer, -1));
  return normalise(raw);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
