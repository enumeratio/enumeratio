// Where every head came from, derived rather than declared.
//
// The reference catalogue documents two quite different things under one roof: heads
// compute-engine already has, and heads we add. Each signature carries a `library` field
// saying which — and until now nothing checked it. That is exactly the sort of claim that
// rots: `StirlingS1` sat documented as ours long after it turned out to be compute-engine's
// own, and only a hand probe caught it.
//
// So compute the answer instead. Given a BARE engine and one with our libraries declared,
// every head falls into one of three cases, decided by what the two engines actually do:
//
//   compute-engine   the bare engine resolves it, and we change nothing about it
//   extension        the bare engine has never heard of it
//   override         the bare engine resolves it AND we change some result
//
// The third is the interesting one. We replace `Zeta`, `PolyLog`, `PolyGamma`,
// `IntegerDigits`, `FromDigits`, `Element` and the whole arithmetic family, each time
// capturing the native handler and falling back to it. That fallback is a promise — vanilla
// behaviour survives — and this file is what holds us to it.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJSON, ReferenceEntry } from "../src/types.ts";

export type Provenance = "compute-engine" | "extension" | "override" | "unknown";

/** One expression where a bare engine and ours disagree. */
export interface Divergence {
  readonly expression: MathJSON;
  readonly bare: MathJSON;
  readonly ours: MathJSON;
}

export interface HeadProvenance {
  readonly name: string;
  readonly provenance: Provenance;
  /** What the entry's signatures claim, normalised; `undefined` means "built-in". */
  readonly declared: string | undefined;
  /** Whether the computed answer agrees with the claim. */
  readonly agrees: boolean;
  readonly divergences: readonly Divergence[];
}

const isCall = (value: MathJSON): value is readonly MathJSON[] => Array.isArray(value) && typeof value[0] === "string";

/** Every operator name appearing anywhere in an expression. */
export function operatorsIn(expr: MathJSON, into = new Set<string>()): Set<string> {
  if (!isCall(expr)) return into;
  into.add(expr[0] as string);
  for (const operand of expr.slice(1)) operatorsIn(operand, into);
  return into;
}

/** The first subexpression whose operator is `name`, if any. */
export function findCall(expr: MathJSON, name: string): MathJSON | undefined {
  if (!isCall(expr)) return undefined;
  if (expr[0] === name) return expr;
  for (const operand of expr.slice(1)) {
    const found = findCall(operand, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Whether an engine has a definition for the operator at the top of this call. */
export function resolves(ce: ComputeEngine, expr: MathJSON): boolean {
  try {
    return ce.box(expr as Parameters<ComputeEngine["box"]>[0]).operatorDefinition !== undefined;
  } catch {
    return false;
  }
}

const evaluated = (ce: ComputeEngine, expr: MathJSON): MathJSON => {
  try {
    return ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json as MathJSON;
  } catch (error) {
    return ["EvaluationThrew", String(error)];
  }
};

/**
 * Whether a bare engine understands every operator in an expression. Only those expressions
 * can be compared across the two engines — one mentioning a head we invented would
 * "diverge" trivially, which says nothing.
 */
export const bareUnderstands = (bare: ComputeEngine, expr: MathJSON): boolean =>
  [...operatorsIn(expr)].every((name) => {
    const call = findCall(expr, name);
    return call !== undefined && resolves(bare, call);
  });

/**
 * Expressions where a bare engine and ours disagree, over a corpus a bare engine fully
 * understands. An empty result is the claim that declaring our libraries changes nothing
 * about vanilla compute-engine.
 */
export function divergences(bare: ComputeEngine, ours: ComputeEngine, corpus: readonly MathJSON[]): Divergence[] {
  const out: Divergence[] = [];
  for (const expression of corpus) {
    if (!bareUnderstands(bare, expression)) continue;
    const before = evaluated(bare, expression);
    const after = evaluated(ours, expression);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      out.push({ expression, bare: before, ours: after });
    }
  }
  return out;
}

/** The `library` an entry claims for its head, normalised across spellings. */
export function declaredLibrary(entry: ReferenceEntry): string | undefined {
  const named = entry.signatures?.find((signature) => signature.call.startsWith(entry.name));
  const library = named?.library ?? entry.signatures?.[0]?.library;
  if (library === undefined || library === "compute-engine") return undefined;
  // `@enumeratio/analytic` and `enumeratio-analytic` are the same library.
  return library.replace(/^@/, "").replace(/\//, "-");
}

/** Classify one entry's head by what the two engines do with its own examples. */
export function classify(bare: ComputeEngine, ours: ComputeEngine, entry: ReferenceEntry): HeadProvenance {
  const calls = entry.examples
    .map((example) => findCall(example.expr, entry.name))
    .filter((call): call is MathJSON => call !== undefined);
  const declared = declaredLibrary(entry);
  if (calls.length === 0) {
    return { name: entry.name, provenance: "unknown", declared, agrees: true, divergences: [] };
  }
  const nativeHere = calls.some((call) => resolves(bare, call));
  if (!nativeHere) {
    return {
      name: entry.name,
      provenance: "extension",
      declared,
      agrees: declared !== undefined,
      divergences: [],
    };
  }
  // Native. Does declaring our libraries change what it answers?
  const changed = divergences(bare, ours, calls);
  const provenance = changed.length > 0 ? "override" : "compute-engine";
  return {
    name: entry.name,
    provenance,
    declared,
    // A head compute-engine already has should not claim to be ours. An override may:
    // it is a head of theirs that we extend, so either label is defensible, and the
    // computed answer is the one to trust.
    agrees: provenance === "override" ? true : declared === undefined,
    divergences: changed,
  };
}

/**
 * The heads a bare engine resolves but whose answers we change, over a corpus. Attribution
 * is by the head at the TOP of each expression — which is why this is computed from the
 * corpus rather than from entries: `Element` is overridden by the algebra seam and has no
 * entry of its own, so an entry-keyed answer would miss it.
 */
export function divergingHeads(bare: ComputeEngine, ours: ComputeEngine, corpus: readonly MathJSON[]): string[] {
  const heads = new Set<string>();
  for (const divergence of divergences(bare, ours, corpus)) {
    // `N(f(…))` diverges because f does; N only asks for the number.
    let e = divergence.expression;
    while (isCall(e) && e[0] === "N" && e.length === 2) e = e[1] as MathJSON;
    if (isCall(e)) heads.add(e[0] as string);
  }
  return [...heads].sort();
}

/** The whole catalogue, classified. */
export const provenanceLedger = (
  bare: ComputeEngine,
  ours: ComputeEngine,
  catalogue: readonly ReferenceEntry[],
): HeadProvenance[] => catalogue.map((entry) => classify(bare, ours, entry));

/** One head's provenance plus its known equivalents — the shape that gets committed. */
export interface HeadRecord {
  readonly name: string;
  readonly provenance: Provenance;
  readonly declared: string | null;
  /**
   * The Wolfram symbol this head is RENAMED to, when the transpiler maps one. Null means
   * the name passes through unchanged — which says nothing about whether Wolfram has it.
   * That question is `elsewhere`, and only a kernel can answer it.
   */
  readonly wolframAlias: string | null;
  /** External systems that have a function of this name. Filled by collect-coverage.ts. */
  readonly elsewhere: readonly string[];
}

/**
 * The committed ledger. The Wolfram column is REFLECTED from the transpiler's own head map
 * rather than written out again: `to-wolfram.ts` has to know what `Stirling` means in
 * Wolfram in order to emit it, so that knowledge already exists and duplicating it would
 * only give it somewhere to drift.
 */
export const collect = (
  bare: ComputeEngine,
  ours: ComputeEngine,
  catalogue: readonly ReferenceEntry[],
  wolframHeads: Readonly<Record<string, string>>,
  /** Coverage from a previous kernel run, carried forward — this pass is offline. */
  previous: readonly HeadRecord[] = [],
): HeadRecord[] =>
  provenanceLedger(bare, ours, catalogue).map((row) => ({
    name: row.name,
    provenance: row.provenance,
    declared: row.declared ?? null,
    wolframAlias: wolframHeads[row.name] ?? null,
    elsewhere: previous.find((record) => record.name === row.name)?.elsewhere ?? [],
  }));

/** `src/provenance-data.ts` as written — both collectors go through this. */
export const renderProvenance = (
  records: readonly HeadRecord[],
): string => `// GENERATED by scripts/collect-provenance.ts — do not edit by hand.
//
// Where each documented head comes from, and whether an external system has a function of
// the same meaning. Regenerate with:
//
//   vp node packages/reference/scripts/collect-provenance.ts
//
// \`provenance\` is:
//   compute-engine  a bare engine resolves it and we change nothing
//   extension       a bare engine has never heard of it
//   override        native, and declaring our libraries changes some result
//   unknown         the entry's examples never call its own head

/** One head's provenance, and its known equivalents elsewhere. */
export interface HeadRecord {
  readonly name: string;
  readonly provenance: "compute-engine" | "extension" | "override" | "unknown";
  /** The library the entry claims, or null for "compute-engine's own". */
  readonly declared: string | null;
  /** The Wolfram symbol this head is RENAMED to, or null when the name passes through. */
  readonly wolframAlias: string | null;
  /** External systems that have a function of this name — "wolfram", "sympy", "mpmath". */
  readonly elsewhere: readonly string[];
}

export const provenance: readonly HeadRecord[] = ${JSON.stringify(records, null, 2)};
`;
