// The support matrix (design/benchmarking.md §4.1): for each case and system, the native
// source the generator will write, or why the system sits this one out. Built before any
// timing, so "Julia is missing NextPrime" is data, not a silent gap.

import { emit } from "@enumeratio/oracle/src";
import { answerText } from "./agree.ts";
import { PROTOCOL } from "./protocol.ts";
import type { BenchSystem, ConcreteCase, Exclusion, Plan, PlanCell, Precision } from "./types.ts";

/** Seconds, when a case names no budget. */
export const DEFAULT_BUDGET = 10;

export const SYSTEMS: readonly BenchSystem[] = [
  "ts",
  "wolfram",
  "sympy",
  "mpmath",
  "sage",
  "oscar",
  "julia",
  "rust",
];

type PrecisionClass = "exact" | "machine" | "digits";
const classOf = (p: Precision): PrecisionClass => (typeof p === "number" ? "digits" : p);

/**
 * The precisions each system's harness can honour. Coarse on purpose: a mapping that computes
 * at another precision (Rust's `statrs` in f64 for an exact case) shows up as `wrong` at the
 * correctness gate rather than as a fast time.
 */
const PRECISIONS: Record<BenchSystem, readonly PrecisionClass[]> = {
  ts: ["exact", "machine", "digits"],
  wolfram: ["exact", "machine", "digits"],
  sympy: ["exact"],
  mpmath: ["machine", "digits"],
  sage: ["exact", "machine"],
  oscar: ["exact"],
  julia: ["exact", "machine"],
  rust: ["exact", "machine"],
};

export function planCell(c: ConcreteCase, system: BenchSystem): PlanCell {
  const note = c.case.bench.deny?.[system];
  if (note !== undefined) return { reason: "denied", note } satisfies Exclusion;
  if (!PRECISIONS[system].includes(classOf(c.case.bench.precision))) return { reason: "precision" };
  if (system === "ts") return { sources: c.inputs.map((input) => JSON.stringify(input)) };
  const sources: string[] = [];
  const missing = new Set<string>();
  for (const input of c.inputs) {
    const out = emit(input, system);
    if (out.ok) sources.push(out.source);
    else for (const head of out.missing) missing.add(head);
  }
  if (missing.size > 0) return { reason: "unmapped", missing: [...missing].sort() };
  return { sources };
}

export function buildPlan(cases: readonly ConcreteCase[]): Plan {
  return {
    schema: 1,
    protocol: PROTOCOL.version,
    cases: cases.map((c) => ({
      name: c.name,
      precision: c.case.bench.precision,
      budget: c.case.bench.budget ?? DEFAULT_BUDGET,
      ...(c.case.expected === undefined ? {} : { expected: answerText(c.case.expected) }),
      systems: Object.fromEntries(SYSTEMS.map((s) => [s, planCell(c, s)])),
    })),
  };
}
