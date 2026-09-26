// The support matrix (design/benchmarking.md §4.1): for each case and system, the native
// source the generator will write, or why the system sits this one out. Built before any
// timing, so "Julia is missing NextPrime" is data, not a silent gap.

import { createHash } from "node:crypto";
import { emit } from "@enumeratio/oracle/src";
import { answerText } from "./agree.ts";
import { loadPins, type Pins } from "./catalogue.ts";
import { PROTOCOL } from "./protocol.ts";
import { tierOf } from "./suites.ts";
import type { BenchSystem, ConcreteCase, Exclusion, Plan, PlanCell, Precision } from "./types.ts";

/** Seconds, when a case names no budget. */
export const DEFAULT_BUDGET = 10;

export const SYSTEMS: readonly BenchSystem[] = ["ts", "wolfram", "sympy", "mpmath", "sage", "oscar", "julia", "rust"];

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

/** What a case computes, as a short hash: the same formula times the same work. */
export const formulaOf = (c: ConcreteCase): string =>
  createHash("sha256")
    .update(JSON.stringify({ inputs: c.inputs, precision: c.case.bench.precision }))
    .digest("hex")
    .slice(0, 12);

/** The answer to gate on: the YAML's, else a pin made for this very formula. */
export function expectedOf(c: ConcreteCase, pins: Pins): string | undefined {
  if (c.case.expected !== undefined) return answerText(c.case.expected);
  const pin = pins[c.name];
  return pin?.formula === formulaOf(c) ? pin.answer : undefined;
}

export function buildPlan(cases: readonly ConcreteCase[], options: { suite?: string; pins?: Pins } = {}): Plan {
  const pins = options.pins ?? loadPins();
  return {
    schema: 1,
    protocol: PROTOCOL.version,
    ...(options.suite === undefined ? {} : { suite: options.suite }),
    cases: cases.map((c) => {
      const expected = expectedOf(c, pins);
      return {
        name: c.name,
        formula: formulaOf(c),
        tier: tierOf(c.case),
        precision: c.case.bench.precision,
        budget: c.case.bench.budget ?? DEFAULT_BUDGET,
        ...(c.case.bench.tags === undefined ? {} : { tags: c.case.bench.tags }),
        expr: c.case.expr,
        ...(c.case.bench.sample === undefined ? {} : { sample: c.case.bench.sample }),
        inputs: c.inputs,
        ...(expected === undefined ? {} : { expected }),
        systems: Object.fromEntries(SYSTEMS.map((s) => [s, planCell(c, s)])),
      };
    }),
  };
}
