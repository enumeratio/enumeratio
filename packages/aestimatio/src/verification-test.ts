import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { CancellationError } from "@cortex-js/compute-engine";
import { DeadlineExceededError, withDeadline } from "@enumeratio/boxed";

export type Outcome = "Success" | "Failure" | "Error" | "Aborted";

export interface TestResult {
  readonly outcome: Outcome;
  readonly input: BoxedExpression;
  readonly expectedOutput?: BoxedExpression;
  readonly actualOutput?: BoxedExpression;
  readonly absoluteTimeUsed: number;
  readonly testId?: string;
}

export interface VerificationTestOptions {
  readonly input: BoxedExpression;
  readonly expected?: BoxedExpression;
  /** Default: `BoxedExpression.isSame` — structural sameness. */
  readonly sameTest?: (actual: BoxedExpression, expected: BoxedExpression) => boolean;
  readonly timeConstraintSeconds?: number;
  readonly memoryConstraintBytes?: number;
  readonly testId?: string;
  /**
   * True inside the isolated worker evaluator, where a memory cap is real (the worker's
   * own `resourceLimits`) rather than a bound this process cannot enforce.
   */
  readonly isolated?: boolean;
}

const isTimeout = (e: unknown): boolean =>
  (e instanceof CancellationError && e.cause === "timeout") || e instanceof DeadlineExceededError;

/**
 * Runs `input` under the given constraints and compares it with `expected`. In-process,
 * `memoryConstraintBytes` cannot be enforced — see `MemoryConstrained`'s own comment — so a
 * test that asks for one there comes back `"Error"` rather than silently ignoring it.
 */
export function verificationTest(ce: ComputeEngine, opts: VerificationTestOptions): TestResult {
  const { input, expected, timeConstraintSeconds, testId, memoryConstraintBytes, isolated } = opts;
  const sameTest = opts.sameTest ?? ((actual, exp) => actual.isSame(exp));
  const start = performance.now();
  // Millisecond precision: sub-ms noise isn't meaningful to report, and rounding it away
  // is what keeps a trivial evaluation's AbsoluteTimeUsed reliably 0 (deterministic for a
  // reference example) rather than jittering with scheduler noise.
  const elapsed = (): number => Math.round(performance.now() - start) / 1000;

  if (memoryConstraintBytes !== undefined && !isolated) {
    return {
      outcome: "Error",
      input,
      expectedOutput: expected,
      absoluteTimeUsed: elapsed(),
      testId,
    };
  }

  let actual: BoxedExpression;
  try {
    const held = input.canonical;
    actual =
      timeConstraintSeconds === undefined
        ? held.evaluate()
        : withDeadline(Math.max(0, timeConstraintSeconds * 1000), () =>
            ce.withTimeLimit(
              { ms: Math.max(0, timeConstraintSeconds * 1000), label: "VerificationTest" },
              () => held.evaluate(),
            ),
          );
  } catch (e) {
    return {
      outcome: isTimeout(e) ? "Aborted" : "Error",
      input,
      expectedOutput: expected,
      absoluteTimeUsed: elapsed(),
      testId,
    };
  }

  if (expected === undefined) {
    return { outcome: "Success", input, actualOutput: actual, absoluteTimeUsed: elapsed(), testId };
  }
  return {
    outcome: sameTest(actual, expected) ? "Success" : "Failure",
    input,
    expectedOutput: expected,
    actualOutput: actual,
    absoluteTimeUsed: elapsed(),
    testId,
  };
}
