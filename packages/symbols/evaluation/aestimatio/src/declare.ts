import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { CancellationError } from "@cortex-js/compute-engine";
import {
  DeadlineExceededError,
  defineMessages,
  emit,
  optionsOf,
  stringAt,
  symbolNameOf,
  withDeadline,
} from "@enumeratio/boxed";
import type { Outcome, TestResult } from "./verification-test.ts";
import { verificationTest } from "./verification-test.ts";

/**
 * Wolfram's `$Aborted` — a marker for a computation a constraint cut off. compute-engine's
 * symbol grammar rejects a `$`-led name (`invalid-first-char`), so this is declared under
 * the bare name and mapped to `$Aborted` in the transpiler's `SYMBOLS`, the same way
 * `MachineEpsilon` reaches Wolfram as `$MachineEpsilon`.
 */
export const ABORTED = "Aborted";

/** True for the timeout `CancellationError` compute-engine's own spans raise, or ours. */
const isTimeout = (e: unknown): boolean =>
  (e instanceof CancellationError && e.cause === "timeout") || e instanceof DeadlineExceededError;

/** Seconds (Wolfram's unit for `TimeConstrained`/`AbsoluteTiming`) as milliseconds. */
const msOf = (seconds: number): number => Math.max(0, seconds * 1000);

export function declareAestimatio(ce: ComputeEngine): void {
  ce.declare(ABORTED, "symbol");

  // TimeConstrained(expr, t, failexpr?) — held: `expr` and `failexpr` only evaluate once
  // we know which of them is wanted. `ops` are raw and possibly non-canonical (the
  // lazy-operator trap — see compute-engine's types-definitions.d.ts): canonicalize each
  // held operand before evaluating it.
  ce.declare("TimeConstrained", {
    description: "Evaluates expr, but aborts after t seconds and returns failexpr (default $Aborted).",
    signature: "(any, number, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [held, secondsExpr, failExpr] = ops;
      if (held === undefined || secondsExpr === undefined) return undefined;
      const seconds = secondsExpr.canonical.evaluate().re;
      if (seconds === undefined || Number.isNaN(seconds)) return undefined;
      const ms = msOf(seconds);
      const fail = (): BoxedExpression => (failExpr === undefined ? ce.symbol(ABORTED) : failExpr.canonical.evaluate());
      try {
        return withDeadline(ms, () =>
          ce.withTimeLimit({ ms, label: "TimeConstrained" }, () => held.canonical.evaluate()),
        );
      } catch (e) {
        if (isTimeout(e)) return fail();
        throw e;
      }
    },
    evaluateAsync: async (ops: readonly BoxedExpression[], options) => {
      const [held, secondsExpr, failExpr] = ops;
      if (held === undefined || secondsExpr === undefined) return undefined;
      const seconds = secondsExpr.canonical.evaluate().re;
      if (seconds === undefined || Number.isNaN(seconds)) return undefined;
      const ms = msOf(seconds);
      const fail = (): BoxedExpression => (failExpr === undefined ? ce.symbol(ABORTED) : failExpr.canonical.evaluate());
      const timeoutSignal = AbortSignal.timeout(ms);
      const signals = options.signal === undefined ? [timeoutSignal] : [timeoutSignal, options.signal];
      const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
      const signal = anyFn !== undefined ? anyFn(signals) : timeoutSignal;
      try {
        return await held.canonical.evaluateAsync({ signal });
      } catch (e) {
        // Only OUR timeout converts to failexpr; a caller's own signal firing propagates.
        const timedOut = timeoutSignal.aborted || isTimeout(e);
        if (timedOut) return fail();
        throw e;
      }
    },
  });

  // MemoryConstrained(expr, bytes, failexpr?) — enforced only in the isolated evaluator
  // (see ./node's evaluateIsolated). In-process there is no way to cap a synchronous
  // computation's heap use, so this stays unevaluated rather than pretending to enforce
  // a bound it cannot: silently ignoring the constraint would be worse than saying so.
  ce.declare("MemoryConstrained", {
    description:
      "Evaluates expr under a memory cap of bytes. Only enforced inside the isolated (worker) evaluator — in-process this stays unevaluated.",
    signature: "(any, number, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      emit(ce, "MemoryConstrained", "isolated", [ops[1] ?? ce.number(0)]);
      return undefined;
    },
  });
  defineMessages(ce, "MemoryConstrained", {
    isolated: "a limit of `1` bytes is enforced only by the isolated evaluator; here the call stays unevaluated.",
  });

  declareVerificationTest(ce);
}

function declareVerificationTest(ce: ComputeEngine): void {
  // TestResultObject is declared inert: it is a value, built by `VerificationTest`, never
  // a computation of its own.
  ce.declare("TestResultObject", { signature: "(any*) -> value" });

  // VerificationTest(input, expected?, SameTest -> f, TimeConstraint -> t,
  // MemoryConstraint -> b, TestID -> "…") — held: `input` must not evaluate until the
  // constraints are in place around it.
  ce.declare("VerificationTest", {
    description:
      "Evaluates input under the given constraints and compares it with expected (default: structural sameness), returning a TestResultObject.",
    signature: "(any*) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [input, expectedRaw, ...rest] = ops;
      if (input === undefined) return undefined;
      const expected = expectedRaw?.canonical;
      const { options } = optionsOf(["VerificationTest", ...rest.map((op) => op.json)] as never);
      const sameTestExpr = options.SameTest !== undefined ? ce.box(options.SameTest as never) : undefined;
      const timeConstraint =
        options.TimeConstraint !== undefined ? ce.box(options.TimeConstraint as never).evaluate().re : undefined;
      const testId = options.TestID !== undefined ? stringAt(ce.box(options.TestID as never).evaluate()) : undefined;
      const memoryConstraint =
        options.MemoryConstraint !== undefined ? ce.box(options.MemoryConstraint as never).evaluate().re : undefined;

      const sameTest =
        sameTestExpr === undefined
          ? undefined
          : (actual: BoxedExpression, expectedValue: BoxedExpression): boolean => {
              // compute-engine's `Apply(f, a, b)` treats each trailing operand as its own
              // positional argument — unlike Wolfram's `f @@ {a, b}` — so the two values go
              // in directly rather than wrapped in a `List` (which `Apply` would instead pass
              // through as a single argument).
              const applied = ce.function("Apply", [sameTestExpr, actual, expectedValue]);
              return symbolNameOf(applied.evaluate()) === "True";
            };

      const result = verificationTest(ce, {
        input,
        expected,
        sameTest,
        timeConstraintSeconds: timeConstraint,
        memoryConstraintBytes: memoryConstraint,
        testId,
      });
      return testResultExpression(ce, result);
    },
  });
}

/**
 * `TestResultObject` operands, as the rules `optionsOf`/`ruleOf` elsewhere read. The key is
 * a STRING, not a symbol: `Input` collides with compute-engine's own console-input function,
 * and a string key sidesteps every such collision (`ruleOf`'s `optionName` accepts either).
 */
function testResultExpression(ce: ComputeEngine, result: TestResult): BoxedExpression {
  const rule = (name: string, value: BoxedExpression): BoxedExpression =>
    ce.function("KeyValuePair", [ce.string(name), value]);
  const rows: BoxedExpression[] = [
    rule("Outcome", ce.string(result.outcome)),
    rule("Input", result.input),
    rule("ExpectedOutput", result.expectedOutput ?? ce.symbol("Missing")),
    rule("ActualOutput", result.actualOutput ?? ce.symbol("Missing")),
    rule("AbsoluteTimeUsed", ce.number(result.absoluteTimeUsed)),
  ];
  if (result.testId !== undefined) rows.push(rule("TestID", ce.string(result.testId)));
  return ce.function("TestResultObject", rows);
}

export type { Outcome };
