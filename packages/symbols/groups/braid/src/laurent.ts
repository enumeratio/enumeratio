// Laurent polynomials over Z — the coefficient ring the Burau representation needs.
//
// Knot polynomials live in Z[t, t⁻¹] rather than Z[t], because a knot has no preferred
// orientation of its variable: the Alexander polynomial is only defined up to a factor
// ±tᵏ. That ambiguity is not a nuisance to work around, it is the actual object, so
// `normalise` below is what makes comparison meaningful.

/** A Laurent polynomial: `coefficients[i]` is the coefficient of t^(offset + i). */
export interface Laurent {
  readonly offset: number;
  readonly coefficients: readonly number[];
}

export const ZERO: Laurent = { offset: 0, coefficients: [] };

/** Drop leading and trailing zero coefficients, so equality is structural. */
export function trim(p: Laurent): Laurent {
  let low = 0;
  let high = p.coefficients.length;
  while (low < high && p.coefficients[low] === 0) low++;
  while (high > low && p.coefficients[high - 1] === 0) high--;
  return low === high ? ZERO : { offset: p.offset + low, coefficients: p.coefficients.slice(low, high) };
}

/** The monomial c·t^k. */
export const monomial = (coefficient: number, exponent = 0): Laurent =>
  trim({ offset: exponent, coefficients: [coefficient] });

export const constant = (c: number): Laurent => monomial(c, 0);

export function add(p: Laurent, q: Laurent): Laurent {
  const a = trim(p);
  const b = trim(q);
  if (a.coefficients.length === 0) return b;
  if (b.coefficients.length === 0) return a;
  const offset = Math.min(a.offset, b.offset);
  const length = Math.max(a.offset + a.coefficients.length, b.offset + b.coefficients.length) - offset;
  const coefficients = new Array<number>(length).fill(0);
  for (const [source, list] of [
    [a.offset - offset, a.coefficients],
    [b.offset - offset, b.coefficients],
  ] as const) {
    list.forEach((c, i) => {
      coefficients[source + i] = (coefficients[source + i] as number) + c;
    });
  }
  return trim({ offset, coefficients });
}

export const negate = (p: Laurent): Laurent => ({
  offset: p.offset,
  coefficients: p.coefficients.map((c) => -c),
});

export const subtract = (p: Laurent, q: Laurent): Laurent => add(p, negate(q));

export function multiply(p: Laurent, q: Laurent): Laurent {
  const a = trim(p);
  const b = trim(q);
  if (a.coefficients.length === 0 || b.coefficients.length === 0) return ZERO;
  const coefficients = new Array<number>(a.coefficients.length + b.coefficients.length - 1).fill(0);
  a.coefficients.forEach((x, i) => {
    b.coefficients.forEach((y, j) => {
      coefficients[i + j] = (coefficients[i + j] as number) + x * y;
    });
  });
  return trim({ offset: a.offset + b.offset, coefficients });
}

export const isZero = (p: Laurent): boolean => trim(p).coefficients.length === 0;

export const equals = (p: Laurent, q: Laurent): boolean => isZero(subtract(p, q));

/**
 * Exact division, or `undefined` if it does not divide.
 *
 * Both sides are shifted down to start at t⁰ first, and the offset difference is put back
 * at the end. That shift is not cosmetic: ordinary top-down long division stops when the
 * remainder's degree drops below the divisor's, which is the right stopping rule for
 * polynomials but wrong for Laurent ones — a quotient with negative exponents still has
 * work left to do at that point, and the division would be reported as inexact.
 */
export function divide(p: Laurent, q: Laurent): Laurent | undefined {
  const numerator = trim(p);
  const denominator = trim(q);
  if (denominator.coefficients.length === 0) return undefined;
  if (numerator.coefficients.length === 0) return ZERO;
  const lead = denominator.coefficients[denominator.coefficients.length - 1] as number;
  const degree = denominator.coefficients.length - 1;
  let rest: Laurent = { offset: 0, coefficients: numerator.coefficients };
  const divisor: Laurent = { offset: 0, coefficients: denominator.coefficients };
  let quotient: Laurent = ZERO;
  for (let guard = 0; guard < 10_000; guard++) {
    const trimmed = trim(rest);
    if (trimmed.coefficients.length === 0) {
      const result = trim(quotient);
      return result.coefficients.length === 0
        ? ZERO
        : { ...result, offset: result.offset + numerator.offset - denominator.offset };
    }
    const top = trimmed.coefficients[trimmed.coefficients.length - 1] as number;
    const topExponent = trimmed.offset + trimmed.coefficients.length - 1;
    if (topExponent < degree || top % lead !== 0) return undefined;
    const term = monomial(top / lead, topExponent - degree);
    quotient = add(quotient, term);
    rest = subtract(trimmed, multiply(term, divisor));
  }
  return undefined;
}

/**
 * The canonical form up to the ±tᵏ ambiguity: shift so the lowest term sits at t⁰, and
 * flip the sign so that term is positive. Two Alexander polynomials are the same invariant
 * exactly when their normalisations agree.
 */
export function normalise(p: Laurent): Laurent {
  const trimmed = trim(p);
  if (trimmed.coefficients.length === 0) return ZERO;
  const sign = (trimmed.coefficients[0] as number) < 0 ? -1 : 1;
  return { offset: 0, coefficients: trimmed.coefficients.map((c) => sign * c) };
}

/** Evaluate at an integer, for cheap spot-checks (Δ(−1) is the determinant of a knot). */
export function evaluateAt(p: Laurent, t: number): number | undefined {
  const trimmed = trim(p);
  if (trimmed.offset < 0 && t === 0) return undefined;
  let total = 0;
  trimmed.coefficients.forEach((c, i) => {
    total += c * t ** (trimmed.offset + i);
  });
  return total;
}

/** A readable form, lowest power first: `1 - t + t^2`. */
export function format(p: Laurent): string {
  const trimmed = trim(p);
  if (trimmed.coefficients.length === 0) return "0";
  let out = "";
  trimmed.coefficients.forEach((c, i) => {
    if (c === 0) return;
    const exponent = trimmed.offset + i;
    const magnitude = Math.abs(c);
    const body =
      exponent === 0 ? `${magnitude}` : `${magnitude === 1 ? "" : magnitude}t${exponent === 1 ? "" : `^${exponent}`}`;
    out += out === "" ? (c < 0 ? `-${body}` : body) : `${c < 0 ? " - " : " + "}${body}`;
  });
  return out;
}

// ── matrices over the ring ──────────────────────────────────────────────────────

export type LaurentMatrix = readonly (readonly Laurent[])[];

export const identityMatrix = (n: number): LaurentMatrix =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? constant(1) : ZERO)));

export function multiplyMatrices(a: LaurentMatrix, b: LaurentMatrix): LaurentMatrix | undefined {
  const n = a.length;
  if (n === 0 || b.length !== (a[0]?.length ?? 0)) return undefined;
  const width = b[0]?.length ?? 0;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: width }, (_, j) => {
      let total: Laurent = ZERO;
      for (let k = 0; k < b.length; k++) {
        total = add(total, multiply(a[i]![k] as Laurent, b[k]![j] as Laurent));
      }
      return total;
    }),
  );
}

export const subtractMatrices = (a: LaurentMatrix, b: LaurentMatrix): LaurentMatrix =>
  a.map((row, i) => row.map((x, j) => subtract(x, b[i]![j] as Laurent)));

/**
 * The determinant, by fraction-free Bareiss elimination.
 *
 * Ordinary Gaussian elimination needs a field; cofactor expansion needs no division but
 * costs n! multiplications, which is already painful at the ten-strand braids the Lorenz
 * construction produces. Bareiss threads between the two: every intermediate is itself a
 * minor of the original matrix, so the division at each step is EXACT over any integral
 * domain — and Z[t, t⁻¹] is one.
 */
export function determinant(m: LaurentMatrix): Laurent | undefined {
  const n = m.length;
  if (n === 0) return constant(1);
  if (m.some((row) => row.length !== n) || n > 40) return undefined;
  const a = m.map((row) => [...row]);
  let sign = 1;
  let previous = constant(1);
  for (let k = 0; k + 1 < n; k++) {
    if (isZero(a[k]![k] as Laurent)) {
      const pivot = a.findIndex((row, i) => i > k && !isZero(row[k] as Laurent));
      if (pivot < 0) return ZERO;
      [a[k], a[pivot]] = [a[pivot] as Laurent[], a[k] as Laurent[]];
      sign = -sign;
    }
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j < n; j++) {
        const cross = subtract(
          multiply(a[i]![j] as Laurent, a[k]![k] as Laurent),
          multiply(a[i]![k] as Laurent, a[k]![j] as Laurent),
        );
        const exact = divide(cross, previous);
        if (exact === undefined) return undefined;
        (a[i] as Laurent[])[j] = exact;
      }
    }
    previous = a[k]![k] as Laurent;
  }
  const value = a[n - 1]![n - 1] as Laurent;
  return sign === 1 ? value : negate(value);
}
