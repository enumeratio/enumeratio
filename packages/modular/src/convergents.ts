// The convergents p_k/q_k of a continued fraction [a_0; a_1, a_2, ...], by the standard
// two-term recurrence — kept apart from `declare.ts` so the arithmetic is testable without
// an engine. `Convergents` and `ContinuedFractionK` both bottom out here or beside it.

/** p_k/q_k for k = 0 .. terms.length-1, as exact `[numerator, denominator]` bigints. */
export function convergentsOf(terms: readonly bigint[]): (readonly [bigint, bigint])[] {
  let [pPrev2, pPrev1] = [0n, 1n]; // p_{-2} = 0, p_{-1} = 1
  let [qPrev2, qPrev1] = [1n, 0n]; // q_{-2} = 1, q_{-1} = 0
  const out: (readonly [bigint, bigint])[] = [];
  for (const a of terms) {
    const p = a * pPrev1 + pPrev2;
    const q = a * qPrev1 + qPrev2;
    out.push([p, q]);
    [pPrev2, pPrev1] = [pPrev1, p];
    [qPrev2, qPrev1] = [qPrev1, q];
  }
  return out;
}

/**
 * f_i/(g_i + f_{i+1}/(g_{i+1} + ...)) over a finite list of (f, g) terms — the general
 * finite `ContinuedFractionK`, built right to left (the last term is `f_n/g_n`, exactly).
 */
export function continuedFractionKOf(
  terms: readonly (readonly [readonly [bigint, bigint], readonly [bigint, bigint]])[],
): readonly [bigint, bigint] | undefined {
  if (terms.length === 0) return undefined;
  let acc: readonly [bigint, bigint] | undefined;
  for (let i = terms.length - 1; i >= 0; i--) {
    const [[fn, fd], [gn, gd]] = terms[i]!;
    if (acc === undefined) {
      // The tail: f_n / g_n.
      acc = [fn * gd, fd * gn];
      continue;
    }
    // f_i / (g_i + acc)
    const [an, ad] = acc;
    const sumN = gn * ad + an * gd;
    const sumD = gd * ad;
    if (sumN === 0n) return undefined;
    acc = [fn * sumD, fd * sumN];
  }
  return acc;
}
