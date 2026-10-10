// MahonianNumber(n, k): the permutations of n with exactly k inversions (OEIS A008302), the
// coefficient of q^k in the q-factorial [n]_q! = (1)(1+q)…(1+q+…+q^(n−1)).
//
// The Epsil definition is the meaning; the bigint kernel beside it is the fast path
// `tests/mahonian.test.ts` holds to it. Both read the same rows: M(m, c) = Σ_{d<m} M(m − 1, c − d).

import { bigIntegerAt, type Engine, type Expr } from "@enumeratio/engine";

import {
  add,
  cell,
  fold,
  iff,
  lets,
  mul,
  quotient,
  rowTable,
  sub,
  upTo,
} from "../../collections/src/families/tables.ts";

type MathJSON = unknown;

// The table keeps columns 0 … min(k, n(n − 1)/2); past the last column the count is 0.
const width = add(["Min", "_k", quotient(mul("_n", sub("_n", 1)), 2)], 1);
const table = rowTable(
  "mn",
  add("_n", 1),
  width,
  (c) => iff(["Equal", c, 0], 1, 0),
  (prev, s, c) => fold(add("mn_a", prev(sub(s, 1), sub(c, "mn_d"))), "mn_a", "mn_d", 0, upTo(0, ["Min", c, sub(s, 1)])),
);

/** M(_n, _k) for integers _n, _k >= 0 (a negative argument is left unevaluated, as compute-engine's
 *  Eulerian does): row m of the table is the sum of the last `m` cells of the row before it. */
export const MAHONIAN_EPSIL: MathJSON = iff(
  ["GreaterEqual", "_k", width],
  0,
  lets([["mn", table, "list<integer>"]], cell("mn", width)("_n", "_k")),
);

/** The kernel declines past this many cell updates (n times the columns kept) rather than block the
 *  thread: measured 0.2 s at n = 300, k = 9999, and 0.5 s at twice that, since the cells grow with n. */
const MAHONIAN_WORK_LIMIT = 3_000_000n;

/** M(n, k) exactly, or undefined past the work limit. M(n, k) = M(n, n(n−1)/2 − k) keeps the
 *  columns to half the row; a prefix-sum sweep makes each row linear. */
export function mahonianNumber(n: bigint, k: bigint): bigint | undefined {
  if (n < 0n || k < 0n) return undefined;
  const top = (n * (n - 1n)) / 2n;
  if (k > top) return 0n;
  const column = k < top - k ? k : top - k;
  if (n * (column + 1n) > MAHONIAN_WORK_LIMIT) return undefined;
  const width = Number(column) + 1;
  let current: bigint[] = Array.from({ length: width }, (_, c) => (c === 0 ? 1n : 0n));
  for (let m = 1; m <= Number(n); m++) {
    // Prefix sums of the row before, so cell c is a difference of two of them.
    const prefix: bigint[] = [];
    let running = 0n;
    for (const cell of current) prefix.push((running += cell));
    current = current.map((_, c) => prefix[c]! - (c >= m ? prefix[c - m]! : 0n));
  }
  return current[width - 1];
}

export function declareMahonianNumber(ce: Engine): void {
  ce.declare("MahonianNumber", {
    signature: "(integer, integer) -> integer",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const n = bigIntegerAt(ops[0]);
      const k = bigIntegerAt(ops[1]);
      if (n === undefined || k === undefined) return undefined;
      const value = mahonianNumber(n, k);
      return value === undefined ? undefined : ce.number(value);
    },
  });
}
