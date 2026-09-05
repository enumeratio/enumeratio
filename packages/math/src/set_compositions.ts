// Set-composition (ordered set partition) rank/unrank. NO numbers-repo precursor is reused here: the
// numbers-repo's setCompositions (combinat.ts) represents a composition as a block-order-first-appearance
// mask enumeration, but packages/data/sqlsrc/set_compositions.sql uses a different carrier AND a different
// floor order — `labels: int[]` (labels[i] = 1-based block index of element i; blocks numbered 1..k by
// construction, not first-appearance) with the floor enumerating k ascending (1..n), then lexicographic on
// the labels array within each k (`ORDER BY k, labels`). This module is written fresh against that floor.
//
// set_compositions has no bare-callable rank/unrank SQL function — unranking is GENERIC-FRAMEWORK dispatched
// (`unrank(set_compositions(n), r)`, set_compositions.sql). Verified in selfcert-math.mts against the labels
// array reconstructed from `notation((unrank(set_compositions(n), r)).value)`.
//
//   SQL name (file)                         →  role here
//   fubini(n) (set_compositions.sql)         →  already ported in combinat.ts as `fubini`; reused (count)
//   set_composition_surjections(n,k)         →  the per-k block (SETOF int[] of surjections [n]↠[k], lex order);
//                                                twinned by countSurjections/rank/unrank below

import { factorial, fubini, stirling_second } from "./combinat.js";

export type SetComposition = number[]; // labels[i] = 1-based block index of element i (1..k, every label used)

/** #surjections [n] ↠ [k] = k! · S(n,k) — the size of one k-level of set_compositions.sql's floor. */
export function countSurjections(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0) return n === 0 ? 1 : 0;
  return factorial(k) * stirling_second(n, k);
}

// N(remaining, missing, k): number of ways to fill `remaining` more label-positions (alphabet 1..k) such that
// exactly `missing` currently-unused labels still need to appear before the word ends. Symmetric in WHICH
// labels are missing (only the count matters): choosing a still-missing label uses one of `missing` choices
// and drops the count by one; choosing an already-used label uses one of (k − missing) choices and doesn't.
const _nMemo = new Map<string, number>();
function countCompletions(remaining: number, missing: number, k: number): number {
  if (remaining === 0) return missing === 0 ? 1 : 0;
  if (missing > remaining) return 0;
  const key = `${remaining},${missing},${k}`;
  let v = _nMemo.get(key);
  if (v === undefined) {
    v = missing * countCompletions(remaining - 1, missing - 1, k) + (k - missing) * countCompletions(remaining - 1, missing, k);
    _nMemo.set(key, v);
  }
  return v;
}

/** No bare SQL fn (generic dispatch) — global rank across the floor's k-ascending, then-lex-on-labels order. */
export function setCompositionRank(labels: SetComposition, n: number): number {
  const k = labels.length === 0 ? 0 : Math.max(...labels);
  let base = 0;
  for (let kp = 1; kp < k; kp++) base += countSurjections(n, kp);

  let local = 0;
  const used = new Set<number>();
  let missing = k;
  for (let i = 0; i < n; i++) {
    const label = labels[i];
    const remainingAfter = n - i - 1;
    for (let c = 1; c < label; c++) {
      const m2 = missing - (used.has(c) ? 0 : 1);
      local += countCompletions(remainingAfter, m2, k);
    }
    if (!used.has(label)) {
      used.add(label);
      missing--;
    }
  }
  return base + local;
}

/** No bare SQL fn (generic dispatch) — the exact inverse of setCompositionRank; total = fubini(n). */
export function setCompositionUnrank(n: number, rank: number): SetComposition {
  if (n === 0) return [];
  const total = fubini(n);
  let r = total ? ((rank % total) + total) % total : 0;

  let k = 1;
  for (;;) {
    const cnt = countSurjections(n, k);
    if (r < cnt) break;
    r -= cnt;
    k++;
  }

  const labels: SetComposition = [];
  const used = new Set<number>();
  let missing = k;
  for (let i = 0; i < n; i++) {
    const remainingAfter = n - i - 1;
    for (let c = 1; c <= k; c++) {
      const m2 = missing - (used.has(c) ? 0 : 1);
      const cnt = countCompletions(remainingAfter, m2, k);
      if (r < cnt) {
        labels.push(c);
        if (!used.has(c)) {
          used.add(c);
          missing--;
        }
        break;
      }
      r -= cnt;
    }
  }
  return labels;
}
