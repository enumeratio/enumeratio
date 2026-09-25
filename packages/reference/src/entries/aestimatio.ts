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
        expr: ["TimeConstrained", ["Sum", "k", ["Tuple", "k", 1, 10]], 1],
        expected: 55,
        caption: "Finishes well inside the deadline, so the value passes through unchanged",
      },
      {
        expr: ["TimeConstrained", ["FactorInteger", SEMIPRIME], 0.05],
        expected: "Aborted",
        caption:
          "Factoring a 30-digit semiprime outruns a 50 ms deadline — compute-engine's own rho loop checks it and gives up",
      },
      {
        expr: ["TimeConstrained", ["FactorInteger", SEMIPRIME], 0.05, -1],
        expected: -1,
        caption: "A custom failexpr replaces the default $Aborted",
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
        expr: ["MemoryConstrained", ["Add", 1, 2], 1_000_000],
        expected: ["MemoryConstrained", ["Add", 1, 2], 1_000_000],
        caption:
          "In-process, the call simply does not reduce — see evaluateIsolated for the real cap",
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
      },
      {
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
      },
      {
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
    ],
  },
];
