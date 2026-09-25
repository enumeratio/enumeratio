// Batch evaluation of many independent cases through the isolated evaluator (design/
// aestimatio.md roadmap: "running our own test suites under aestimatio"). One case's
// crash or timeout never touches another's — that's the whole point of running each on
// a pooled worker rather than in-process. Node-only, so this lives beside ./node.ts's
// own worker machinery and is re-exported from there, never from ./index.ts.

import { createEvaluatorPool, type EvaluateIsolatedOptions, type EvaluatorPool } from "./node.ts";

export interface Case {
  readonly id: string;
  /** MathJSON. */
  readonly input: unknown;
  /** Overrides `RunCasesOptions.timeMs` for this case alone. */
  readonly timeMs?: number;
  /** Overrides `RunCasesOptions.memoryBytes` for this case alone. */
  readonly memoryBytes?: number;
}

export interface CaseResult {
  readonly id: string;
  readonly outcome: "Evaluated" | "Aborted" | "Error";
  /** MathJSON — present when `outcome` is `"Evaluated"`. */
  readonly value?: unknown;
  readonly ms: number;
  /** Present when `outcome` is `"Error"`. */
  readonly reason?: string;
}

export interface RunCasesOptions {
  /** Module URL whose `configure(ce)` declares the libraries every case's engine has —
   * the same contract as `EvaluateIsolatedOptions.setup`. */
  readonly setup?: string;
  /** Default deadline for a case that doesn't set its own `timeMs`. */
  readonly timeMs?: number;
  /** Default memory cap for a case that doesn't set its own `memoryBytes`. */
  readonly memoryBytes?: number;
  /** Expand finite lazy collections in each result — see `EvaluateIsolatedOptions`. */
  readonly materialize?: boolean;
  /** Max workers alive at once, when this call creates its own pool (ignored when `pool`
   * is given — that pool's own `size` governs). Default: the pool's own default
   * (`os.availableParallelism() - 1`). */
  readonly concurrency?: number;
  /** Run against an existing pool instead of a fresh one scoped to this call. The caller
   * owns that pool's lifetime — `runCases` does not close it. */
  readonly pool?: EvaluatorPool;
}

/**
 * Evaluates every case in `cases`, each under its own time/memory constraints (per-case
 * `timeMs`/`memoryBytes` override the call's defaults), on a worker pool. Comparison
 * against an expected value is left to the caller — this only reports what each case
 * did. Concurrency is bounded by the pool (`options.concurrency`, or `options.pool`'s own
 * size); results come back in the same order as `cases`, regardless of completion order.
 *
 * Two cases can never take each other down: one that exceeds its cap comes back
 * `"Aborted"`, one whose evaluation raises comes back `"Error"` with `reason`, and every
 * other case in the batch is unaffected.
 */
export function runCases(cases: readonly Case[], options: RunCasesOptions = {}): Promise<CaseResult[]> {
  const { setup, timeMs, memoryBytes, materialize, concurrency, pool: givenPool } = options;
  const pool = givenPool ?? createEvaluatorPool({ size: concurrency });
  const ownsPool = givenPool === undefined;

  const runOne = (c: Case): Promise<CaseResult> => {
    const callOptions: EvaluateIsolatedOptions = {
      setup,
      timeMs: c.timeMs ?? timeMs,
      memoryBytes: c.memoryBytes ?? memoryBytes,
      materialize,
    };
    return pool.evaluateDetailed(c.input, callOptions).then((detail) => ({
      id: c.id,
      outcome: detail.outcome,
      value: detail.value,
      ms: detail.ms,
      reason: detail.reason,
    }));
  };

  // Every case is dispatched up front; the pool itself throttles how many actually run
  // at once (queueing the rest), and `Promise.all` preserves `cases`' order in the result
  // regardless of which finishes first.
  const results = Promise.all(cases.map(runOne));
  return ownsPool ? results.finally(() => pool.close()) : results;
}
