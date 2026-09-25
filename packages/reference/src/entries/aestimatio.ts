import type { ReferenceEntry } from "../types.ts";

// Reference entries for @enumeratio/aestimatio: controlling evaluation — deadlines
// (TimeConstrained), memory bounds (MemoryConstrained, real only in the isolated
// evaluator), and self-checking (VerificationTest). All three are Wolfram's own concepts,
// named identically — see design/aestimatio.md.

const DOMAIN = "Controlling evaluation";

// Two ~15-digit primes, far enough apart in magnitude that a small trial-division sieve
// never finds them, so FactorInteger reaches its own Pollard-rho loop — the same loop a
// TimeConstrained deadline has to interrupt mid-flight for the timeout example below.
const SEMIPRIME = (1_000_000_000_000_037n * 1_001_000_000_000_003n).toString();

export const aestimatio: readonly ReferenceEntry[] = [
  {
    name: "TimeConstrained",
    domain: DOMAIN,
    signature: "TimeConstrained(expr, t, failexpr)",
    summary: "Evaluates expr, but aborts after t seconds and returns failexpr.",
    signatures: [
      {
        call: "TimeConstrained(expr, t)",
        description: "aborts to $Aborted past $t$ seconds.",
        library: "enumeratio-aestimatio",
      },
      {
        call: "TimeConstrained(expr, t, failexpr)",
        description: "aborts to $\\mathit{failexpr}$ instead.",
        library: "enumeratio-aestimatio",
      },
    ],
    details: [
      "A deadline only interrupts code that LOOKS at it: compute-engine's own loops (Sum, Pollard's rho inside FactorInteger, …) cooperate, so a computation built entirely from them can actually be cut off mid-flight.",
      "Held: expr and failexpr are not evaluated until it is known which one is wanted.",
      "There is also an evaluateAsync route, used automatically inside an async evaluation (e.g. a notebook cell): the caller's own AbortSignal and the timeout race each other, and only the timeout converts to failexpr — the caller's own cancellation propagates.",
    ],
    examples: [
      {
        id: "finishes-well-inside-the-deadline-so-the-value",
        expr: ["TimeConstrained", ["Sum", "k", ["Tuple", "k", 1, 10]], 1],
        expected: 55,
        caption: "Finishes well inside the deadline, so the value passes through unchanged",
      },
      {
        id: "factoring-a-30-digit-semiprime-outruns-a-50-ms",
        expr: ["TimeConstrained", ["FactorInteger", SEMIPRIME], 0.05],
        expected: "Aborted",
        caption:
          "Factoring a 30-digit semiprime outruns a 50 ms deadline — compute-engine's own rho loop checks it and gives up",
      },
      {
        id: "a-custom-failexpr-replaces-the-default-aborted",
        expr: ["TimeConstrained", ["FactorInteger", SEMIPRIME], 0.05, -1],
        expected: -1,
        caption: "A custom failexpr replaces the default $Aborted",
      },
      {
        id: "an-infinite-time-limit-imposes-no-constraint",
        expr: ["TimeConstrained", ["Add", 1, 2], "PositiveInfinity"],
        expected: 3,
        caption: "An infinite time limit imposes no constraint",
        category: "Scope",
      },
      {
        id: "failexpr-is-held-it-is-never-evaluated-when-expr",
        expr: ["TimeConstrained", ["Add", 2, 3], 1, ["Divide", 1, 0]],
        expected: 5,
        caption: "failexpr is held: it is never evaluated when expr finishes in time",
        category: "Properties",
      },
    ],
  },
  {
    name: "MemoryConstrained",
    domain: DOMAIN,
    signature: "MemoryConstrained(expr, bytes, failexpr)",
    summary: "Evaluates expr under a memory cap of bytes — real only in the isolated evaluator.",
    signatures: [
      {
        call: "MemoryConstrained(expr, bytes, failexpr)",
        description: "in-process, stays unevaluated; real only inside evaluateIsolated.",
        library: "enumeratio-aestimatio",
      },
    ],
    details: [
      "JavaScript cannot cap the memory a synchronous, in-process computation uses. In-process, MemoryConstrained therefore stays unevaluated rather than pretending to enforce a bound it cannot — silently ignoring the constraint would be worse than saying so plainly.",
      "The bound is real inside @enumeratio/aestimatio/node's evaluateIsolated: the worker's own resourceLimits.maxOldGenerationSizeMb, a heap cap the runtime itself enforces.",
      "Held: expr and failexpr are not evaluated in-process, since there is nothing here to run them under.",
    ],
    examples: [
      {
        id: "in-process-the-call-simply-does-not-reduce-see",
        expr: ["MemoryConstrained", ["Add", 1, 2], 1_000_000],
        expected: ["MemoryConstrained", ["Add", 1, 2], 1_000_000],
        caption:
          "In-process, the call simply does not reduce — see evaluateIsolated for the real cap",
        divergence: { wolfram: "Wolfram enforces the cap in-kernel and evaluates to 3." },
      },
      {
        id: "a-failexpr-does-not-change-that-in-process-there",
        expr: ["MemoryConstrained", ["Add", 1, 2], 1_000_000, -1],
        expected: ["MemoryConstrained", ["Add", 1, 2], 1_000_000, -1],
        caption: "A failexpr does not change that: in-process there is no cap to exceed",
        category: "Scope",
        divergence: {
          wolfram: "Wolfram evaluates to 3, returning failexpr only if the cap is exceeded.",
        },
      },
    ],
  },
  {
    name: "VerificationTest",
    domain: DOMAIN,
    signature: "VerificationTest(input, expected)",
    summary: "Evaluates input and compares it with expected, returning a TestResultObject.",
    signatures: [
      {
        call: "VerificationTest(input)",
        description: "Success whenever input evaluates without erroring or aborting.",
        library: "enumeratio-aestimatio",
      },
      {
        call: "VerificationTest(input, expected)",
        description: "compares against expected by structural sameness (SameTest's default).",
        library: "enumeratio-aestimatio",
      },
      {
        call: 'VerificationTest(input, expected, SameTest -> f, TimeConstraint -> t, MemoryConstraint -> b, TestID -> "…")',
        description: "options as trailing rules, Wolfram's OptionsPattern way.",
        library: "enumeratio-aestimatio",
      },
    ],
    details: [
      "Held: input does not evaluate until the constraints (TimeConstraint, MemoryConstraint) are in place around it.",
      'Outcome is one of "Success", "Failure", "Error" (input raised, or a constraint was requested this process cannot honor) or "Aborted" (TimeConstraint fired).',
      "MemoryConstraint in-process reports Error rather than silently skipping the check — real enforcement needs the isolated evaluator, where it comes from the worker's own resourceLimits.",
      "TestResultObject's operands are rules — Outcome, Input, ExpectedOutput, ActualOutput, AbsoluteTimeUsed (seconds, rounded to the millisecond), and TestID when given — the same rule spelling @enumeratio/boxed's optionsOf/ruleOf read elsewhere in this codebase.",
    ],
    examples: [
      {
        id: "input-matches-expected",
        expr: ["VerificationTest", ["Add", 2, 3], 5],
        expected: [
          "TestResultObject",
          ["Tuple", "'Outcome'", "'Success'"],
          ["Tuple", "'Input'", 5],
          ["Tuple", "'ExpectedOutput'", 5],
          ["Tuple", "'ActualOutput'", 5],
          ["Tuple", "'AbsoluteTimeUsed'", 0],
        ],
        caption: "input matches expected",
        volatile: ["AbsoluteTimeUsed"],
        divergence: {
          wolfram:
            "Wolfram returns a TestObject over an Association with Input held unevaluated; ours is a TestResultObject of rules with Input evaluated. The Outcome is the same.",
        },
      },
      {
        id: "input-evaluates-but-does-not-match-expected",
        expr: ["VerificationTest", ["Add", 2, 3], 6],
        expected: [
          "TestResultObject",
          ["Tuple", "'Outcome'", "'Failure'"],
          ["Tuple", "'Input'", 5],
          ["Tuple", "'ExpectedOutput'", 6],
          ["Tuple", "'ActualOutput'", 5],
          ["Tuple", "'AbsoluteTimeUsed'", 0],
        ],
        caption: "input evaluates but does not match expected",
        volatile: ["AbsoluteTimeUsed"],
        divergence: {
          wolfram:
            "Wolfram returns a TestObject over an Association with Input held unevaluated; ours is a TestResultObject of rules with Input evaluated. The Outcome is the same.",
        },
      },
      {
        id: "memoryconstraint-in-process-is-an-error-not-a",
        expr: [
          "VerificationTest",
          ["Add", 2, 3],
          5,
          ["KeyValuePair", "MemoryConstraint", 1_000_000],
        ],
        expected: [
          "TestResultObject",
          ["Tuple", "'Outcome'", "'Error'"],
          ["Tuple", "'Input'", 5],
          ["Tuple", "'ExpectedOutput'", 5],
          ["Tuple", "'ActualOutput'", "Missing"],
          ["Tuple", "'AbsoluteTimeUsed'", 0],
        ],
        category: "Possible issues",
        caption: "MemoryConstraint in-process is an Error, not a silently-ignored option",
        volatile: ["AbsoluteTimeUsed"],
      },
      {
        id: "one-argument-a-predicate-that-evaluates-to-true",
        expr: ["VerificationTest", ["Greater", 2, 1]],
        expected: [
          "TestResultObject",
          ["Tuple", "'Outcome'", "'Success'"],
          ["Tuple", "'Input'", ["Less", 1, 2]],
          ["Tuple", "'ExpectedOutput'", "Missing"],
          ["Tuple", "'ActualOutput'", "True"],
          ["Tuple", "'AbsoluteTimeUsed'", 0],
        ],
        caption: "one argument: a predicate that evaluates to True",
        volatile: ["AbsoluteTimeUsed"],
      },
      {
        id: "one-argument-succeeds-whenever-input-evaluates",
        expr: ["VerificationTest", ["Add", 1, 1]],
        expected: [
          "TestResultObject",
          ["Tuple", "'Outcome'", "'Success'"],
          ["Tuple", "'Input'", 2],
          ["Tuple", "'ExpectedOutput'", "Missing"],
          ["Tuple", "'ActualOutput'", 2],
          ["Tuple", "'AbsoluteTimeUsed'", 0],
        ],
        caption: "one argument succeeds whenever input evaluates without an error",
        category: "Possible issues",
        volatile: ["AbsoluteTimeUsed"],
        divergence: {
          wolfram:
            "Wolfram's one-argument form tests that input evaluates to True, so VerificationTest[1 + 1] is a Failure there.",
        },
      },
      {
        id: "a-symbolic-computation-checked-against-its",
        expr: [
          "VerificationTest",
          ["Expand", ["Power", ["Add", "x", 1], 2]],
          ["Add", ["Power", "x", 2], ["Multiply", 2, "x"], 1],
        ],
        expected: [
          "TestResultObject",
          ["Tuple", "'Outcome'", "'Success'"],
          ["Tuple", "'Input'", ["Expand", ["Power", ["Add", "x", 1], 2]]],
          ["Tuple", "'ExpectedOutput'", ["Add", ["Power", "x", 2], ["Multiply", 2, "x"], 1]],
          ["Tuple", "'ActualOutput'", ["Add", ["Power", "x", 2], ["Multiply", 2, "x"], 1]],
          ["Tuple", "'AbsoluteTimeUsed'", 0],
        ],
        caption: "a symbolic computation checked against its expected form",
        category: "Scope",
        volatile: ["AbsoluteTimeUsed"],
      },
      {
        id: "a-testid-is-carried-into-the-result",
        expr: [
          "VerificationTest",
          ["Divide", 1, 0],
          "ComplexInfinity",
          ["KeyValuePair", "TestID", "'pole'"],
        ],
        expected: [
          "TestResultObject",
          ["Tuple", "'Outcome'", "'Success'"],
          ["Tuple", "'Input'", "ComplexInfinity"],
          ["Tuple", "'ExpectedOutput'", "ComplexInfinity"],
          ["Tuple", "'ActualOutput'", "ComplexInfinity"],
          ["Tuple", "'AbsoluteTimeUsed'", 0],
          ["Tuple", "'TestID'", "'pole'"],
        ],
        caption: "a TestID is carried into the result",
        category: "Scope",
        volatile: ["AbsoluteTimeUsed"],
      },
      {
        id: "the-default-comparison-is-structural",
        expr: [
          "VerificationTest",
          ["Add", ["Power", "x", 2], ["Multiply", 2, "x"], 1],
          ["Power", ["Add", "x", 1], 2],
        ],
        expected: [
          "TestResultObject",
          ["Tuple", "'Outcome'", "'Failure'"],
          ["Tuple", "'Input'", ["Add", ["Power", "x", 2], ["Multiply", 2, "x"], 1]],
          ["Tuple", "'ExpectedOutput'", ["Power", ["Add", "x", 1], 2]],
          ["Tuple", "'ActualOutput'", ["Add", ["Power", "x", 2], ["Multiply", 2, "x"], 1]],
          ["Tuple", "'AbsoluteTimeUsed'", 0],
        ],
        caption:
          "the default comparison is structural: mathematically equal but differently written is a Failure",
        category: "Possible issues",
        volatile: ["AbsoluteTimeUsed"],
      },
      {
        id: "a-sametest-with-a-tolerance-22-7-3-14-0-01",
        expr: [
          "VerificationTest",
          ["Divide", 22, 7],
          3.14,
          [
            "KeyValuePair",
            "SameTest",
            ["Function", ["Less", ["Abs", ["Subtract", "a", "b"]], 0.01], "a", "b"],
          ],
        ],
        expected: [
          "TestResultObject",
          ["Tuple", "'Outcome'", "'Success'"],
          ["Tuple", "'Input'", ["Rational", 22, 7]],
          ["Tuple", "'ExpectedOutput'", 3.14],
          ["Tuple", "'ActualOutput'", ["Rational", 22, 7]],
          ["Tuple", "'AbsoluteTimeUsed'", 0],
        ],
        caption: "a SameTest with a tolerance: $|22/7 - 3.14| < 0.01$ passes",
        category: "Scope",
        volatile: ["AbsoluteTimeUsed"],
      },
    ],
  },
];
