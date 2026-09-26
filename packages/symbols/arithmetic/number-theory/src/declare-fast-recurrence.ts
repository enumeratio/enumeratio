// Fast doubling for Fibonacci/LucasL, tracked at
// https://github.com/enumeratio/enumeratio/issues/205 (the first cross-system bench run):
// native Fibonacci/LucasL are each an O(n) bigint-addition loop where fast doubling does the
// same exact job in O(log n) bigint multiplications. Exact, never approximate; declines
// (falls through to the native handler) past a documented size rather than pretend a budget
// it doesn't have.
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, wrapOperator } from "@enumeratio/boxed";
import { fibonacci, lucasL } from "./fast-recurrence.ts";

/** Above this, F(n)/L(n) would run past ~2M decimal digits — plenty past the bench range
 *  (10^5, 10^6), and still small enough that the fast path stays well under a second. */
const FAST_RECURRENCE_LIMIT = 10_000_000n;

export function declareFastRecurrence(ce: ComputeEngine): void {
  const isProfinite = (op: BoxedExpression): boolean => op.operator === "ProfiniteNumber";

  const fitsFastRange = (op: BoxedExpression): bigint | undefined => {
    if (isProfinite(op)) return undefined;
    const n = bigIntegerAt(op);
    if (n === undefined) return undefined;
    const magnitude = n < 0n ? -n : n;
    return magnitude <= FAST_RECURRENCE_LIMIT ? n : undefined;
  };

  wrapOperator(
    ce,
    ["Fibonacci", 100000],
    (ops) => fitsFastRange(ops[0]) !== undefined,
    () => (ops) => ce.number(fibonacci(fitsFastRange(ops[0])!)),
    1,
  );

  wrapOperator(
    ce,
    ["LucasL", 100000],
    (ops) => fitsFastRange(ops[0]) !== undefined,
    () => (ops) => ce.number(lucasL(fitsFastRange(ops[0])!)),
    1,
  );

  // `Mod(Fibonacci(n), p)` gets its speedup for free: Fibonacci/LucasL's own evaluate
  // (above) already answers in O(log n) via fast doubling, so Mod only ever reduces an
  // already-cheap-to-produce value — no separate modular fast path needed. (An earlier
  // version of this tried to intercept `Mod(Fibonacci(n), p)` with a `canonical` hook on
  // `Mod` itself, to skip building the exact value; compute-engine's non-lazy canonical
  // contract makes that unsafe to attach to a native head with no canonical of its own —
  // any call the hook declines comes back marked `canonical: false` and never reaches the
  // engine's default argument processing, breaking every other `Mod` call. Not worth it:
  // fast doubling already gets `Mod(Fibonacci(10^6), p)` from 6.4s to single-digit ms.)
}
