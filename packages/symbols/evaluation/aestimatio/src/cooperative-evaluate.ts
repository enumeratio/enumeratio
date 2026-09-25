// Shared by every worker script (Node and browser, one-shot and session): evaluates `json`
// under the deadline the host asked for, using the same cooperative machinery
// `TimeConstrained` does (./declare.ts) -- `ce.withTimeLimit` plus `@enumeratio/boxed`'s
// `withDeadline`/`checkpoint()`, so compute-engine's own loops AND our bigint kernels'
// checkpoints (`@enumeratio/residues`'s Pollard-rho, baby-step giant-step, ...) both see
// it. When a call's own code cooperates, this returns `Aborted` as an ordinary value: the
// worker survives, and a session loses no state. Only a tight, uncooperative loop still
// needs the host's hard kill -- see node.ts/browser.ts's own grace margin around this.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { CancellationError } from "@cortex-js/compute-engine";
import { DeadlineExceededError, withDeadline } from "@enumeratio/boxed";

/** MathJSON for `declareAestimatio`'s `Aborted` symbol -- see ./declare.ts's own comment. */
const ABORTED = "Aborted";

/** Most elements a materialized result is expanded to in full. */
const MATERIALIZE_LIMIT = 10_000;

/** True for the timeout `CancellationError` compute-engine's own spans raise, or ours. */
const isTimeout = (e: unknown): boolean =>
  (e instanceof CancellationError && e.cause === "timeout") || e instanceof DeadlineExceededError;

export interface CooperativeResult {
  readonly ok: boolean;
  readonly json?: unknown;
  readonly error?: string;
}

/**
 * Evaluates `json` against `ce`, under a `timeMs` deadline when one is given. A deadline
 * that fires from INSIDE this call (compute-engine's own loop, or a kernel's
 * `checkpoint()`) comes back as `{ ok: true, json: "Aborted" }` -- a normal answer, not a
 * failure -- so the caller treats it exactly like any other successful evaluation.
 */
export function evaluateCooperatively(
  ce: ComputeEngine,
  json: unknown,
  timeMs: number | undefined,
  materialize = false,
): CooperativeResult {
  const boxed: BoxedExpression = ce.box(json as never);
  // A lazy collection (`Range`, `Tabulate`, …) stays lazy unless asked: its `.json` is
  // then still the call, not the elements. Only the RESULT is materialized: compute-engine
  // applies `materialization` to every argument on the way down too, and there `true` means
  // the elided display form (five elements, a placeholder, five more), so
  // `Length(Range(1, 20))` counted the eleven items of the display and gave 11. On the
  // result, too, `true` elides past ten elements (`Range(1, 20)` comes back as five, a
  // `ContinuationPlaceholder`, five), so a known count is passed as the element budget --
  // up to MATERIALIZE_LIMIT; past that the elided form stands.
  const run = (): BoxedExpression => {
    const result = boxed.evaluate();
    if (!materialize || !result.isLazyCollection) return result;
    const count = result.count;
    const budget =
      count !== undefined && Number.isFinite(count) && count <= MATERIALIZE_LIMIT
        ? Math.max(count, 1)
        : true;
    return result.evaluate({ materialization: budget });
  };
  // compute-engine's `N(x, d)` leaves `ce.precision` at `d` once it returns, so every later
  // evaluation on the same engine -- the next case in a pooled worker, the next notebook
  // cell -- would silently run at `d` digits. Wolfram's `N[x, d]` never changes the working
  // precision; restoring it here keeps each evaluation to its own. (Restored only after
  // `.json`, which reads the precision to print a decimal.)
  const precision = ce.precision;
  try {
    const result =
      timeMs === undefined
        ? run()
        : withDeadline(timeMs, () =>
            ce.withTimeLimit({ ms: timeMs, label: "evaluateIsolated" }, run),
          );
    return { ok: true, json: result.json };
  } catch (e) {
    if (timeMs !== undefined && isTimeout(e)) return { ok: true, json: ABORTED };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    ce.precision = precision;
  }
}
