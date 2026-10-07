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
import { NATIVE_MAX_ORDER } from "@enumeratio/ce-patches";
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
  /** The first divergence found, for an override; empty otherwise. */
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

/** Every symbol NAME appearing anywhere in an expression, head or leaf alike — the
 * candidates `isolateFreeSymbols` (below) has to consider. Walks EVERY array element, not
 * just a string head's operands: `Through`'s own examples call `[[Add, f, g], x]` — an
 * expression APPLIED to `x` whose own "head" (`[Add, f, g]`) is itself a compound, not a
 * plain operator name, so `isCall`/`operatorsIn`'s stricter walk (which stops at a non-string
 * position 0) never reaches the `f`/`g` inside it. Missing that is exactly how `Through`
 * left `f` typed `number` for every later example that mentions it. */
function symbolsIn(expr: MathJSON, into = new Set<string>()): Set<string> {
  if (typeof expr === "string") {
    into.add(expr);
    return into;
  }
  if (!Array.isArray(expr)) return into;
  for (const item of expr) symbolsIn(item as MathJSON, into);
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

/**
 * Run `body()` in a scope where touching `expr` — boxing it, evaluating it, either one —
 * can't leave a FREE symbol's inferred type behind for the next expression to see. Boxing
 * alone (no `evaluate()` needed) already types a bare `x` in `Sqrt(x^2)` as `number`; a
 * value like `f` used as `Unique([3, 3, 3], f)`'s comparator gets typed `function` the same
 * way. A later, unrelated expression that also mentions `x` or `f` (a different catalogue
 * entry's example, say) then answers differently depending on what touched this engine
 * before it — `Or(x, True, z)` short-circuits to `True` while `x` is untyped, but THROWS an
 * incompatible-type error once something else has typed it first.
 *
 * `pushScope()`/`popScope()` undoes a `:=`/`Module`-style BINDING, but not this: a symbol's
 * inferred TYPE survives popping the scope it was inferred in (measured, not assumed — see
 * the reference test this guards). `ce.forget()` doesn't touch it either. The only thing
 * that resets it is `ce.declare(name, "unknown")`, so: snapshot which of `expr`'s symbols
 * are still untyped ("unknown") BEFORE running, and re-declare any of THOSE back to
 * "unknown" afterward — never a symbol that came in already meaning something (a real head
 * like `Sqrt`, a constant like `Pi`), since forcing one of those to "unknown" would corrupt
 * the engine for every example after it, not fix anything.
 */
function isolateFreeSymbols<T>(ce: ComputeEngine, expr: MathJSON, body: () => T): T {
  const isUnknown = (name: string): boolean => {
    try {
      return ce.box(name as Parameters<ComputeEngine["box"]>[0]).type.toString() === "unknown";
    } catch {
      return false;
    }
  };
  const free = [...symbolsIn(expr)].filter(isUnknown);
  ce.pushScope();
  try {
    return body();
  } finally {
    ce.popScope();
    for (const name of free) {
      if (!isUnknown(name)) {
        try {
          ce.declare(name, "unknown");
        } catch {
          // Not every string is declarable (a pattern variable like `_a`, say) — best effort.
        }
      }
    }
  }
}

/** Whether an engine has a definition for the operator at the top of this call. Boxing
 * `expr` to find out can itself type a free symbol in it (see `isolateFreeSymbols`), so
 * this checks under the same protection rather than leaving that to every caller. */
export function resolves(ce: ComputeEngine, expr: MathJSON): boolean {
  try {
    return isolateFreeSymbols(
      ce,
      expr,
      () => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).operatorDefinition !== undefined,
    );
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

/** A bare compute-engine never returns from `N(PolyLog(s, z))` at |z| > 1 and a huge order
 * (O(s²) bignum work, and no time limit interrupts it), so the comparison does not ask it. */
const bareHangs = (expr: MathJSON): boolean => {
  const call = findCall(expr, "PolyLog");
  if (call === undefined || !isCall(call)) return false;
  const [order, z] = [call[1], call[2]];
  return typeof order === "number" && typeof z === "number" && order > NATIVE_MAX_ORDER && Math.abs(z) > 1;
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
 *
 * Every corpus here is evaluated on ONE shared `bare`/`ours` pair (cheap — a fresh
 * `declaredEngine()` per example, or even per catalogue entry, costs real time over a
 * catalogue this size). `isolateFreeSymbols` is what makes that safe: each expression's own
 * free symbols are reset the instant it's done, so nothing about one expression's free
 * variables can survive to change how the NEXT one, or a different corpus reusing the same
 * engines, gets evaluated.
 */
export function divergences(
  bare: ComputeEngine,
  ours: ComputeEngine,
  corpus: readonly MathJSON[],
  /** Stop at the first divergence: enough to know THAT a corpus diverges, and far cheaper. */
  { first = false }: { first?: boolean } = {},
): Divergence[] {
  const out: Divergence[] = [];
  for (const expression of corpus) {
    if (!bareUnderstands(bare, expression)) continue;
    const before = bareHangs(expression)
      ? ["NativeNeverReturns"]
      : isolateFreeSymbols(bare, expression, () => evaluated(bare, expression));
    const after = isolateFreeSymbols(ours, expression, () => evaluated(ours, expression));
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      out.push({ expression, bare: before, ours: after });
      if (first) break;
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
  // A row in triage holds an unsettled answer: it says nothing yet about whose head this is.
  const calls = entry.examples
    .filter((example) => example.role !== "triage")
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
  // One diverging example makes it an override; only a head that never diverges pays for them all.
  const changed = divergences(bare, ours, calls, { first: true });
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
    const head = headOf(divergence.expression);
    if (head !== undefined) heads.add(head);
  }
  return [...heads].toSorted();
}

/** The head an expression is attributed to: the one at its top, through `N(f(…))`, which diverges
 * because f does (N only asks for the number). Undefined for an atom. */
export function headOf(expression: MathJSON): string | undefined {
  let e = expression;
  while (isCall(e) && e[0] === "N" && e.length === 2) e = e[1] as MathJSON;
  return isCall(e) ? (e[0] as string) : undefined;
}

/**
 * The whole catalogue, classified, on ONE shared `bare`/`ours` pair — see `divergences`'
 * comment for why that's safe: every example's own free symbols are isolated as it runs, so
 * one entry's examples (`Unique([3, 3, 3], f)`, typing `f` as a function) can't change how a
 * LATER entry's examples (a `Shape` call that also mentions `f`, say) get classified.
 */
export const provenanceLedger = (
  bare: ComputeEngine,
  ours: ComputeEngine,
  catalogue: readonly ReferenceEntry[],
): HeadProvenance[] => catalogue.map((entry) => classify(bare, ours, entry));

/** One head's provenance plus its known equivalents — the shape that gets built. */
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
  /** External systems that have a function of this name, from the committed `coverage-data.ts`. */
  readonly elsewhere: readonly string[];
}

/**
 * The built ledger. The Wolfram column is REFLECTED from the transpiler's own head map
 * rather than written out again: `to-wolfram.ts` has to know what `Stirling` means in
 * Wolfram in order to emit it, so that knowledge already exists and duplicating it would
 * only give it somewhere to drift.
 */
export const collect = (
  bare: ComputeEngine,
  ours: ComputeEngine,
  catalogue: readonly ReferenceEntry[],
  wolframHeads: Readonly<Record<string, string>>,
  /** The committed kernel snapshot (`coverage-data.ts`): head → systems that have it. */
  coverage: Readonly<Record<string, readonly string[]>> = {},
): HeadRecord[] =>
  provenanceLedger(bare, ours, catalogue).map((row) => ({
    name: row.name,
    provenance: row.provenance,
    declared: row.declared ?? null,
    wolframAlias: wolframHeads[row.name] ?? null,
    elsewhere: coverage[row.name] ?? [],
  }));

/** `src/provenance-data.ts` as written. */
export const renderProvenance = (
  records: readonly HeadRecord[],
): string => `// GENERATED by scripts/collect-provenance.ts — do not edit by hand.
//
// Where each documented head comes from, and whether an external system has a function of
// the same meaning. Written by the package's build, never committed; the \`elsewhere\` column
// is folded in from the committed coverage-data.ts. Rebuild with:
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
