import type { ComputeEngine } from "@cortex-js/compute-engine";

/**
 * Heads whose value is not a function of their operands: they draw random numbers, read the
 * clock, the assumptions or the transcript, mutate state, or run user bodies for effect. Every
 * other head we declare is pure. A name here that nothing declares is harmless.
 */
export const IMPURE_HEADS: ReadonlySet<string> = new Set([
  // Randomness
  "Random",
  "RandomInteger",
  "RandomReal",
  "RandomComplex",
  "RandomChoice",
  "RandomSample",
  "RandomPermutation",
  "RandomGraph",
  "RandomVariate",
  "RandomFunction",
  "SeedRandom",
  // Scoping, control flow and state
  "Module",
  "Do",
  "With",
  "Switch",
  "Sow",
  "Reap",
  "Throw",
  "Catch",
  "While",
  "NestWhile",
  "NestWhileList",
  "FixedPointList",
  "Echo",
  "AppendTo",
  "Attributes",
  "SetAttributes",
  "ClearAttributes",
  // The clock and the budget
  "AbsoluteTiming",
  "TimeConstrained",
  "MemoryConstrained",
  "VerificationTest",
  // Assumptions
  "Refine",
  "Assuming",
  "PiecewiseExpand",
  // The transcript
  "Out",
  "In",
  "InString",
  // The host: resources, documents and rendering
  "Resource",
  "Cell",
  "Notebook",
  "Image",
  "Rasterize",
  "Render",
  "ParseAs",
  "RowSource",
  "DisplayForm",
  "RawBoxes",
]);

/** Keys that make a definition a value's (`ce.declare("x", { type, value })`), not an operator's. */
const VALUE_KEYS = ["type", "value", "constant", "holdUntil", "operator"];
/** Keys that make a plain definition an operator's. */
const OPERATOR_KEYS = ["signature", "evaluate", "canonical", "lazy", "collection", "complexity", "compile"];
/** Purity stated in any of compute-engine's spellings; stating it again would be a registration error. */
const STATED_KEYS = ["pure", "effects", "drawsRandom", "readsRandomFrame"];
/** An effect specifier in a signature's arrow slot: `(any) random -> any`, `(any) pure -> any`. */
const EFFECT_SPECIFIER = /\)\s+[a-z_]+(?:\s*,\s*[a-z_]+)*\s*->/;

const isPlain = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const statesPurity = (def: Record<string, unknown>): boolean =>
  STATED_KEYS.some((key) => key in def) || (typeof def.signature === "string" && EFFECT_SPECIFIER.test(def.signature));

/** `def` with `pure: true`, when it is an operator definition that states no purity and `name` is not in `IMPURE_HEADS`. */
function purified(name: string, def: unknown): unknown {
  if (!isPlain(def) || IMPURE_HEADS.has(name)) return def;
  if (VALUE_KEYS.some((key) => key in def) || !OPERATOR_KEYS.some((key) => key in def)) return def;
  return statesPurity(def) ? def : { ...def, pure: true };
}

const installed = new WeakSet<object>();

/**
 * Make a head declared without stated purity pure, so compute-engine may memoize it: from 0.174
 * it won't memoize an operator that doesn't say. Wraps `ce.declare` (which `extendHead` and every
 * library go through), leaving alone a name in `IMPURE_HEADS` (stating nothing is what keeps 0.174 from
 * memoizing it), a definition that states `pure`/`effects` itself, one that names an effect in its
 * signature, and a patch (`extend: true`).
 * Idempotent per engine; call it before the first library declares.
 */
export function installPurityDefault(ce: ComputeEngine): void {
  if (installed.has(ce)) return;
  installed.add(ce);
  const declare = ce.declare.bind(ce) as (...args: unknown[]) => ComputeEngine;
  (ce as { declare: unknown }).declare = (...args: unknown[]): ComputeEngine => {
    const [first, second, third] = args;
    if (typeof first === "string") {
      if (isPlain(third) && third.extend === true) return declare(...args);
      return declare(first, purified(first, second), ...args.slice(2));
    }
    if (isPlain(first)) {
      const entries = Object.entries(first).map(([name, def]) => [name, purified(name, def)] as const);
      return declare(Object.fromEntries(entries), ...args.slice(1));
    }
    return declare(...args);
  };
}
