// Checking a Fungrim identity numerically: the part the worker and the test both need.
//
// A compiled rule is a rewrite, `match -> replace`, over `_`-prefixed wildcards with guards
// saying what each wildcard may be. So the identity is testable: put numbers in the
// wildcards that satisfy the guards, evaluate both sides, and see whether they agree. That
// is a real check of a claim the crosswalk otherwise only points at -- and it exercises our
// own engine against Fungrim's corpus at the same time, which is where a disagreement would
// most likely be ours.

import type { ComputeEngine } from "@cortex-js/compute-engine";

export type Json = unknown;

/** One compiled rule, as the engine's artifact carries it. */
export interface FungrimRule {
  readonly id: string;
  readonly match: Json;
  readonly replace: Json;
  readonly guards: readonly Guard[];
  readonly heads: readonly string[];
}

export interface Guard {
  readonly k: string;
  readonly wc?: string;
  readonly t?: string;
  readonly op?: string;
  readonly bound?: Json;
}

/** What a check came to. `skipped` is a guard we cannot honour, not a failure of the rule. */
export type Outcome =
  | { readonly verdict: "agree"; readonly samples: number }
  | { readonly verdict: "disagree"; readonly detail: string }
  | { readonly verdict: "inconclusive" }
  | { readonly verdict: "skipped"; readonly guard: string };

/** Guards we know how to sample against; the rest make a rule `skipped`. */
const SUPPORTED = new Set(["type", "cmp", "ne"]);

/** Every `_`-prefixed wildcard in an expression. */
export function wildcards(expr: Json, into = new Set<string>()): Set<string> {
  if (typeof expr === "string") {
    if (expr.startsWith("_")) into.add(expr);
  } else if (Array.isArray(expr)) {
    for (const operand of expr) wildcards(operand, into);
  }
  return into;
}

const substitute = (expr: Json, bindings: Record<string, Json>): Json =>
  typeof expr === "string"
    ? (bindings[expr] ?? expr)
    : Array.isArray(expr)
      ? expr.map((operand) => substitute(operand, bindings))
      : expr;

/** The numeric value of an expression, when it has one. */
function value(ce: ComputeEngine, expr: Json): { re: number; im: number } | undefined {
  try {
    const boxed = ce.box(expr as Parameters<ComputeEngine["box"]>[0]).N();
    const { re, im } = boxed;
    if (typeof re !== "number" || !Number.isFinite(re)) return undefined;
    const imaginary = typeof im === "number" ? im : 0;
    return Number.isFinite(imaginary) ? { re, im: imaginary } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A value for each wildcard on the k-th sample: the guards say what type it has and what it
 * is bounded below by, and the offsets are deliberately unround so an identity cannot pass
 * by landing on a special point.
 */
function sample(wilds: readonly string[], guards: readonly Guard[], k: number): Record<string, Json> {
  const types: Record<string, string> = {};
  const lower: Record<string, number> = {};
  for (const guard of guards) {
    if (!guard.wc) continue;
    if (guard.k === "type" && guard.t) types[guard.wc] = guard.t;
    if (guard.k === "cmp" && typeof guard.bound === "number") {
      if (guard.op === "gt") lower[guard.wc] = guard.bound + 1;
      if (guard.op === "ge") lower[guard.wc] = guard.bound;
    }
  }
  const one = (wild: string): Json => {
    const type = types[wild] ?? "complex";
    const base = lower[wild];
    if (type === "integer") return (base ?? 1) + k;
    if (type === "rational") return ["Rational", 1 + k, 3];
    const re = (base ?? 0.4) + 0.3 * k + 0.17;
    return type === "complex" ? ["Complex", re, 0.23 + 0.11 * k] : re;
  };
  return Object.fromEntries(wilds.map((wild) => [wild, one(wild)]));
}

/** Agreement to a relative tolerance -- these are floating-point evaluations of both sides. */
const close = (a: { re: number; im: number }, b: { re: number; im: number }): boolean => {
  const scale = Math.max(1, Math.abs(a.re), Math.abs(b.re), Math.abs(a.im), Math.abs(b.im));
  return Math.abs(a.re - b.re) < 1e-7 * scale && Math.abs(a.im - b.im) < 1e-7 * scale;
};

/** How many samples a rule with wildcards has to survive to count as checked. */
const SAMPLES = 3;
const NEEDED = 2;

/** Check one rule: both sides, over samples that satisfy its guards. */
export function checkRule(ce: ComputeEngine, rule: FungrimRule): Outcome {
  const unsupported = rule.guards.find((guard) => !SUPPORTED.has(guard.k));
  if (unsupported) return { verdict: "skipped", guard: unsupported.k };

  const wilds = [...wildcards(rule.match)];
  // A `__`-prefixed wildcard matches a SEQUENCE of operands, so putting one number in it is
  // not an instance of the rule -- it is a different expression. Those rules (the solve
  // targets, mostly) need a matcher, not a sample.
  if (wilds.some((wild) => wild.startsWith("__"))) return { verdict: "skipped", guard: "sequence" };
  // A rule whose replacement introduces a wildcard the match does not bind is a solve-style
  // rule, not an identity we can instantiate.
  if ([...wildcards(rule.replace)].some((wild) => !wilds.includes(wild))) {
    return { verdict: "skipped", guard: "unbound" };
  }

  if (!wilds.length) {
    const left = value(ce, rule.match);
    const right = value(ce, rule.replace);
    if (!left || !right) return { verdict: "inconclusive" };
    return close(left, right)
      ? { verdict: "agree", samples: 1 }
      : { verdict: "disagree", detail: `${left.re} vs ${right.re}` };
  }

  let agreed = 0;
  for (let k = 0; k < SAMPLES; k++) {
    const bindings = sample(wilds, rule.guards, k);
    const left = value(ce, substitute(rule.match, bindings));
    const right = value(ce, substitute(rule.replace, bindings));
    if (!left || !right) continue;
    if (close(left, right)) {
      agreed++;
      continue;
    }
    const at = wilds.map((wild) => `${wild} = ${JSON.stringify(bindings[wild])}`).join(", ");
    // The relative gap separates a near-miss -- our evaluation of one side is imprecise --
    // from two different numbers, and the two want different follow-up.
    const scale = Math.max(1, Math.abs(left.re), Math.abs(right.re));
    const gap = Math.hypot(left.re - right.re, left.im - right.im) / scale;
    return {
      verdict: "disagree",
      detail: `at ${at}: ${left.re} vs ${right.re} (relative gap ${gap.toExponential(1)})`,
    };
  }
  return agreed >= NEEDED ? { verdict: "agree", samples: agreed } : { verdict: "inconclusive" };
}
