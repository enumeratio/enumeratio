// The Jones polynomial, by way of the Temperley–Lieb algebra.
//
// The Alexander polynomial came out of a LINEAR representation of the braid group (Burau).
// The Jones polynomial comes out of a DIAGRAM one: send each generator to a combination of
// the identity and a Temperley–Lieb diagram,
//
//     σ_i  ↦  A·1 + A⁻¹·e_i,          σ_i⁻¹  ↦  A⁻¹·1 + A·e_i,
//
// multiply the whole word out in TL_n, and then close the diagrams up. Each closed diagram
// contributes δ^{loops−1} for δ = −A² − A⁻², which is the Kauffman bracket; correcting by
// the writhe makes it an invariant, and substituting A = t^{−1/4} makes it the Jones
// polynomial.
//
// The two generator images ARE the two ways of smoothing a crossing — that is the whole
// content of the Kauffman bracket, and the reason the diagram algebra next door is the
// right place to compute it rather than a coincidence of notation. Everything here is
// exact: the coefficients are Laurent polynomials in A, and δ's powers are multiplied out
// rather than evaluated.

import { composeDiagrams, type Diagram, diagram, diagramKey, identityDiagram } from "@enumeratio/diagram";
import { type Braid, writhe } from "./braid.ts";
import { add, constant, divide, type Laurent, monomial, multiply, trim, ZERO } from "./laurent.ts";

/** An element of TL_n over Z[A, A⁻¹]: a coefficient per diagram. */
export type TemperleyLiebElement = ReadonlyMap<string, { diagram: Diagram; coefficient: Laurent }>;

/** δ = −A² − A⁻², the value of a closed loop. */
export const LOOP_VALUE: Laurent = add(monomial(-1, 2), monomial(-1, -2));

const put = (into: Map<string, { diagram: Diagram; coefficient: Laurent }>, d: Diagram, coefficient: Laurent): void => {
  const key = diagramKey(d);
  const existing = into.get(key);
  const total = existing === undefined ? coefficient : add(existing.coefficient, coefficient);
  if (trim(total).coefficients.length === 0) into.delete(key);
  else into.set(key, { diagram: d, coefficient: total });
};

export const tlElement = (parts: readonly (readonly [Diagram, Laurent])[]): TemperleyLiebElement => {
  const out = new Map<string, { diagram: Diagram; coefficient: Laurent }>();
  for (const [d, coefficient] of parts) put(out, d, coefficient);
  return out;
};

/**
 * The Temperley–Lieb generator e_i: a cup joining i to i+1 on top, a cap joining them
 * below, and through-strands everywhere else. It is the ONLY non-identity diagram the
 * bracket ever needs, because the two smoothings of a crossing are exactly 1 and e_i.
 */
export function temperleyLiebGenerator(n: number, i: number): Diagram | undefined {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(i) || i < 1 || i >= n) return undefined;
  const blocks: number[][] = [
    [i, i + 1],
    [-i, -(i + 1)],
  ];
  for (let j = 1; j <= n; j++) {
    if (j !== i && j !== i + 1) blocks.push([j, -j]);
  }
  return diagram(n, blocks);
}

/** The product in TL_n(δ): compose the diagrams, and pay δ for every closed loop. */
export function tlMultiply(a: TemperleyLiebElement, b: TemperleyLiebElement): TemperleyLiebElement {
  const out = new Map<string, { diagram: Diagram; coefficient: Laurent }>();
  for (const left of a.values()) {
    for (const right of b.values()) {
      const { result, loops } = composeDiagrams(left.diagram, right.diagram);
      let coefficient = multiply(left.coefficient, right.coefficient);
      for (let k = 0; k < loops; k++) coefficient = multiply(coefficient, LOOP_VALUE);
      put(out, result, coefficient);
    }
  }
  return out;
}

/**
 * The braid's image in TL_n: every crossing replaced by its two smoothings, weighted A and
 * A⁻¹ (the other way round for a negative crossing).
 */
export function braidToTemperleyLieb(b: Braid): TemperleyLiebElement | undefined {
  let current: TemperleyLiebElement = tlElement([[identityDiagram(b.strands), constant(1)]]);
  for (const letter of b.word) {
    const generator = temperleyLiebGenerator(b.strands, Math.abs(letter));
    if (generator === undefined) return undefined;
    const step = tlElement(
      letter > 0
        ? [
            [identityDiagram(b.strands), monomial(1, 1)],
            [generator, monomial(1, -1)],
          ]
        : [
            [identityDiagram(b.strands), monomial(1, -1)],
            [generator, monomial(1, 1)],
          ],
    );
    current = tlMultiply(current, step);
  }
  return current;
}

/**
 * How many circles a diagram becomes when its top row is joined to its bottom row. Every
 * point gains exactly one closure edge, so the result is a disjoint union of cycles and
 * counting them is counting connected components.
 */
export function closureLoops(d: Diagram): number {
  const n = d.strands;
  const parent = Array.from({ length: 2 * n }, (_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root] as number;
    return root;
  };
  const union = (x: number, y: number): void => {
    parent[find(x)] = find(y);
  };
  const index = (label: number): number => (label > 0 ? label - 1 : n + (-label - 1));
  for (const block of d.blocks) {
    for (let i = 1; i < block.length; i++) {
      union(index(block[0] as number), index(block[i] as number));
    }
  }
  // The closure arcs: top j round to bottom j.
  for (let j = 1; j <= n; j++) union(index(j), index(-j));
  return new Set(Array.from({ length: 2 * n }, (_, i) => find(i))).size;
}

/**
 * The Kauffman bracket ⟨L⟩ of a braid's closure, as a Laurent polynomial in A. It is
 * normalised so the unknot is 1, which is why the exponent is loops − 1.
 */
export function kauffmanBracket(b: Braid): Laurent | undefined {
  const element = braidToTemperleyLieb(b);
  if (element === undefined) return undefined;
  let total: Laurent = ZERO;
  for (const { diagram: d, coefficient } of element.values()) {
    let term = coefficient;
    for (let k = 1; k < closureLoops(d); k++) term = multiply(term, LOOP_VALUE);
    total = add(total, term);
  }
  return trim(total);
}

/**
 * The writhe-corrected bracket f(L) = (−A³)^{−w}⟨L⟩ — already an invariant of the link,
 * and the Jones polynomial in disguise.
 */
export function bracketInvariant(b: Braid): Laurent | undefined {
  const bracket = kauffmanBracket(b);
  if (bracket === undefined) return undefined;
  const w = writhe(b);
  // (−A³)^{−w} is a single monomial: sign (−1)^w with A-exponent −3w.
  return multiply(bracket, monomial((-1) ** w, -3 * w));
}

/**
 * The Jones polynomial V(t), by substituting A = t^{1/4}.
 *
 * For a knot every surviving power of A is a multiple of four, so the substitution lands
 * back in Z[t, t⁻¹]; for a link with an even number of components it does not, and this
 * declines rather than inventing a square root of t.
 *
 * The exponent's SIGN here is the handedness convention, and it is not free: with the other
 * sign every answer comes out as its own mirror, so the right-handed trefoil would be
 * reported as the left-handed one. It is pinned by the torus-knot closed form.
 */
export function jonesPolynomial(b: Braid): Laurent | undefined {
  const invariant = bracketInvariant(b);
  if (invariant === undefined) return undefined;
  const trimmed = trim(invariant);
  if (trimmed.coefficients.length === 0) return ZERO;
  let out: Laurent = ZERO;
  for (const [i, coefficient] of trimmed.coefficients.entries()) {
    if (coefficient === 0) continue;
    const exponent = trimmed.offset + i;
    if (exponent % 4 !== 0) return undefined; // a half-integer power of t
    out = add(out, monomial(coefficient, exponent / 4));
  }
  return trim(out);
}

/** The Jones polynomial of the mirror image: V_mirror(t) = V(1/t). */
export function mirrorJones(p: Laurent): Laurent {
  const trimmed = trim(p);
  return {
    offset: -(trimmed.offset + trimmed.coefficients.length - 1),
    coefficients: [...trimmed.coefficients].reverse(),
  };
}

/**
 * The closed-form Jones polynomial of the torus knot T(p, q), for coprime p, q ≥ 2.
 *
 * The classical expression is
 *
 *     t^{(p−1)(q−1)/2} · (1 − t^{p+1} − t^{q+1} + t^{p+q}) / (1 − t²),
 *
 * and it is written for the opposite handedness to the one a POSITIVE braid closes to — so
 * it is mirrored here, and what comes back is the polynomial of `torusBraid(p, q)`'s
 * closure. Getting that backwards is invisible on an amphichiral knot and glaring on a
 * trefoil, which is how it was caught.
 *
 * No braid, no bracket, no diagrams — which is exactly what makes it worth having as the
 * check on all three.
 */
export function torusJones(p: number, q: number): Laurent | undefined {
  if (!Number.isSafeInteger(p) || !Number.isSafeInteger(q) || p < 2 || q < 2) return undefined;
  if (p > 20 || q > 20) return undefined;
  const numerator = [constant(1), monomial(-1, p + 1), monomial(-1, q + 1), monomial(1, p + q)].reduce(add, ZERO);
  const denominator = add(constant(1), monomial(-1, 2));
  const quotient = divide(numerator, denominator);
  if (quotient === undefined) return undefined;
  return mirrorJones(trim(multiply(quotient, monomial(1, ((p - 1) * (q - 1)) / 2))));
}

/** Normalised for comparison, since nothing here is defined only up to a unit. */
export const sameJones = (p: Laurent, q: Laurent): boolean => {
  const a = trim(p);
  const b = trim(q);
  return (
    a.offset === b.offset &&
    a.coefficients.length === b.coefficients.length &&
    a.coefficients.every((c, i) => c === b.coefficients[i])
  );
};
