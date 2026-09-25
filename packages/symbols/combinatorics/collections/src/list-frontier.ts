import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";

// Wolfram-frontier list/array heads compute-engine has no answer for at all: Array's
// n-dimensional index-range construction, Accumulate/FoldList's running folds, Cases's
// pattern-filtered selection, SparseArray's rules-to-dense constructor, RandomInteger's
// (seeded, for reproducible reference examples) uniform draws, and the three small numeric
// predicates/queries MachineNumberQ/NumericQ/Precision. See each section for the Wolfram
// call forms covered and what's left as a documented divergence.

/** Call a (possibly `Function`-headed) expression as an operator over `args` — same
 *  technique as `list-ops-wolfram.ts`'s own `invoke`, duplicated locally rather than
 *  exported to keep that file's surface unchanged. */
const invoke = (ce: ComputeEngine, f: BoxedExpression, args: readonly BoxedExpression[]): BoxedExpression =>
  ce.box([f, ...args] as never).evaluate();

// --- Array ---------------------------------------------------------------------------------

/** `Array[f, n]` / `Array[f, {n1, …, nk}]` / `Array[f, n, r]` / `Array[f, dims, origins]` /
 *  `Array[f, n, r, h]`: `f` applied over every point of an n-dimensional index range,
 *  wrapped in `h` (default `List`) at every level. `origins` pins where each dimension's
 *  index range starts (default 1, Wolfram's own default). */
const dimsOf = (spec: BoxedExpression): number[] | undefined => {
  if (spec.operator === "List") {
    const ns = operandsOf(spec).map(integerAt);
    return ns.some((n) => n === undefined || n < 0) ? undefined : (ns as number[]);
  }
  const n = integerAt(spec);
  return n === undefined || n < 0 ? undefined : [n];
};

const originsOf = (spec: BoxedExpression | undefined, rank: number): number[] | undefined => {
  if (spec === undefined) return Array.from({ length: rank }, () => 1);
  if (spec.operator === "List") {
    const rs = operandsOf(spec).map(integerAt);
    return rs.length !== rank || rs.some((r) => r === undefined) ? undefined : (rs as number[]);
  }
  const r = integerAt(spec);
  return r === undefined ? undefined : Array.from({ length: rank }, () => r);
};

const buildArray = (
  ce: ComputeEngine,
  f: BoxedExpression,
  dims: readonly number[],
  origins: readonly number[],
  headName: string,
): BoxedExpression => {
  const build = (dimIndex: number, indices: readonly number[]): BoxedExpression => {
    if (dimIndex === dims.length)
      return invoke(
        ce,
        f,
        indices.map((i) => ce.number(i)),
      );
    const items: BoxedExpression[] = [];
    for (let k = 0; k < dims[dimIndex]; k++) items.push(build(dimIndex + 1, [...indices, origins[dimIndex] + k]));
    return ce.function(headName, items);
  };
  return build(0, []);
};

// --- Accumulate / FoldList -------------------------------------------------------------

/** `FoldList[f, x0, {a, b, c}]` = `{x0, f(x0,a), f(f(x0,a),b), f(f(f(x0,a),b),c)}`. */
const foldListFrom = (
  ce: ComputeEngine,
  f: BoxedExpression,
  seed: BoxedExpression,
  items: readonly BoxedExpression[],
): BoxedExpression => {
  const acc: BoxedExpression[] = [seed];
  let current = seed;
  for (const item of items) {
    current = invoke(ce, f, [current, item]);
    acc.push(current);
  }
  return ce.function("List", acc);
};

// --- Cases -----------------------------------------------------------------------------

/** `Cases[collection, pattern]`: elements matching `pattern` under compute-engine's own
 *  wildcard matcher (`_`, `__`, `___`, named wildcards, and literal structure built from
 *  them, e.g. `f(_, _)`). Wolfram's typed patterns (`_Integer`) have no counterpart —
 *  compute-engine wildcards carry no type constraint (see `pattern-utils.d.ts`), so
 *  `_Integer` boxes as an ordinary named wildcard (name `"Integer"`) and matches ANY single
 *  element, not just integers. Documented as a divergence in the reference entry, the same
 *  way `Count`'s own `_Integer` example documents its (opposite) mismatch. */
const declareCases = (ce: ComputeEngine): void => {
  ce.declare("Cases", {
    signature: "(collection<any>, any) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const list = ops[0];
      const pattern = ops[1];
      if (list === undefined || pattern === undefined) return undefined;
      const matched = operandsOf(list).filter((item) => item.match(pattern) !== null);
      return ce.function("List", matched);
    },
  });
};

// --- SparseArray -------------------------------------------------------------------------

/** `SparseArray[{pos1 -> val1, …}, dims?, default?]`: rules keyed by a 1-based integer
 *  (vector) or index list (matrix/tensor) build a dense nested `List`, filled with
 *  `default` (Wolfram's own default: `0`) elsewhere. `dims` defaults to the largest index
 *  seen per axis. No distinct sparse storage type is kept — the result densifies
 *  immediately, so `Normal` of it is a no-op (compute-engine's native `Normal` already
 *  passes a plain `List` through unchanged) and a genuinely huge/sparse array is not
 *  practical here; documented as a divergence in the reference entry. */
const ruleParts = (
  rule: BoxedExpression,
): { readonly pos: BoxedExpression; readonly val: BoxedExpression } | undefined =>
  rule.operator === "Rule" ? { pos: operandsOf(rule)[0], val: operandsOf(rule)[1] } : undefined;

const posIndices = (pos: BoxedExpression): number[] | undefined => {
  if (pos.operator === "List") {
    const idx = operandsOf(pos).map(integerAt);
    return idx.some((i) => i === undefined) ? undefined : (idx as number[]);
  }
  const i = integerAt(pos);
  return i === undefined ? undefined : [i];
};

const declareSparseArray = (ce: ComputeEngine): void => {
  ce.declare("SparseArray", {
    signature: "(any, any?, any?) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const rulesExpr = ops[0];
      if (rulesExpr === undefined || rulesExpr.operator !== "List") return undefined;
      const parts = operandsOf(rulesExpr).map(ruleParts);
      if (parts.some((p) => p === undefined)) return undefined;
      const entries = (parts as { pos: BoxedExpression; val: BoxedExpression }[]).map(({ pos, val }) => ({
        idx: posIndices(pos),
        val,
      }));
      if (entries.length === 0 || entries.some((e) => e.idx === undefined)) return undefined;
      const rank = entries[0].idx!.length;
      if (entries.some((e) => e.idx!.length !== rank)) return undefined;

      let dims: number[];
      if (ops[1] !== undefined) {
        const spec = dimsOf(ops[1]);
        if (spec === undefined || spec.length !== rank) return undefined;
        dims = spec;
      } else {
        dims = Array.from({ length: rank }, () => 0);
        for (const e of entries) e.idx!.forEach((i, k) => (dims[k] = Math.max(dims[k], i)));
      }
      const fallback = ops[2] ?? ce.Zero;

      const build = (dimIndex: number, prefix: readonly number[]): BoxedExpression => {
        if (dimIndex === dims.length) {
          const hit = entries.find((e) => e.idx!.every((i, k) => i === prefix[k]));
          return hit !== undefined ? hit.val : fallback;
        }
        const items: BoxedExpression[] = [];
        for (let i = 1; i <= dims[dimIndex]; i++) items.push(build(dimIndex + 1, [...prefix, i]));
        return ce.function("List", items);
      };
      return build(0, []);
    },
  });
};

// --- RandomInteger (seeded) --------------------------------------------------------------

/** A tiny deterministic PRNG (mulberry32) — NOT Wolfram's generator, so the same seed draws
 *  a different sequence; only the shape and range of `RandomInteger`'s answer are
 *  guaranteed to match, documented as a divergence in the reference entry. One generator
 *  per engine instance, reseeded by `SeedRandom` and defaulting to a fixed seed so examples
 *  are reproducible even without an explicit `SeedRandom` call. */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rngState = new WeakMap<ComputeEngine, { next: () => number }>();
const DEFAULT_SEED = 42;

/** Exported so `graphs-2.ts`'s `RandomGraph` draws from the SAME per-engine seeded stream
 *  as `RandomInteger`, rather than duplicating a PRNG. */
export const rngFor = (ce: ComputeEngine): (() => number) => {
  let entry = rngState.get(ce);
  if (entry === undefined) {
    entry = { next: mulberry32(DEFAULT_SEED) };
    rngState.set(ce, entry);
  }
  return entry.next;
};

const nextIntInRange = (ce: ComputeEngine, min: number, max: number): number =>
  min + Math.floor(rngFor(ce)() * (max - min + 1));

/** `RandomInteger[]` (0 or 1) / `RandomInteger[max]` / `RandomInteger[{min, max}]`, each
 *  with an optional `n` (a flat list of `n` draws) or `{n1, …, nk}` (a nested array of
 *  draws) trailing operand. */
const rangeOf = (range: BoxedExpression | undefined): [number, number] | undefined => {
  if (range === undefined) return [0, 1];
  const max = integerAt(range);
  if (max !== undefined) return [0, max];
  if (range.operator === "List") {
    const [a, b] = operandsOf(range).map(integerAt);
    if (a !== undefined && b !== undefined) return [a, b];
  }
  return undefined;
};

const declareRandomInteger = (ce: ComputeEngine): void => {
  ce.declare("SeedRandom", {
    signature: "(integer?) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const seed = ops[0] !== undefined ? (integerAt(ops[0]) ?? DEFAULT_SEED) : DEFAULT_SEED;
      rngState.set(ce, { next: mulberry32(seed) });
      return ce.symbol("Nothing");
    },
  });

  ce.declare("RandomInteger", {
    signature: "(any?, any?) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const range = rangeOf(ops[0]);
      if (range === undefined) return undefined;
      const [min, max] = range;
      if (ops[1] === undefined) return ce.number(nextIntInRange(ce, min, max));
      const n = integerAt(ops[1]);
      if (n !== undefined) {
        return ce.function(
          "List",
          Array.from({ length: n }, () => ce.number(nextIntInRange(ce, min, max))),
        );
      }
      const dims = dimsOf(ops[1]);
      if (dims === undefined) return undefined;
      const build = (dimIndex: number): BoxedExpression =>
        dimIndex === dims.length
          ? ce.number(nextIntInRange(ce, min, max))
          : ce.function(
              "List",
              Array.from({ length: dims[dimIndex] }, () => build(dimIndex + 1)),
            );
      return build(0);
    },
  });
};

// --- MachineNumberQ / NumericQ / Precision ------------------------------------------------

/** How many significant decimal digits a literal carries — the number of digits actually
 *  written (`2.5` → 2, an `N[…, 50]` result → 50), read from the decimal's own `toString`
 *  rather than any private field. Falls back to the engine's configured working precision
 *  when the numeric value carries no decimal breakdown (e.g. a machine float from
 *  elsewhere). */
const digitsOf = (ce: ComputeEngine, x: BoxedExpression): number => {
  // `.numericValue` (and `.isExact` below) live on compute-engine's boxed-number
  // interface, not the general one — same cast other packages use (see e.g.
  // analytic/src/matrix-exp.ts).
  const numericValue = (x as Partial<{ numericValue: { decimal?: { toString(): string } } }>).numericValue;
  const decimal = numericValue?.decimal;
  if (decimal === undefined) return ce.precision;
  const digits = decimal.toString().replace(/^-/, "").replace(".", "").replace(/^0+/, "");
  return digits.length || 1;
};

/** Whether `x` is an exact number — `undefined` (a symbolic constant like `Pi`, with no
 *  `isExact` of its own) counts as exact, Wolfram's own convention (`Precision(Pi)` is
 *  `Infinity`). */
const isExactNumber = (x: BoxedExpression): boolean => (x as Partial<{ isExact: boolean }>).isExact !== false;

/** Wolfram's `MachinePrecision` is about 15.95 decimal digits (IEEE double); a digit count
 *  at or under 15 is treated as machine-precision here. */
const MACHINE_PRECISION_DIGITS = 15;

const declareNumericPredicates = (ce: ComputeEngine): void => {
  // NumericQ(expr): does expr denote a definite numeric quantity — a literal, or built from
  // numeric literals and constants like Pi — without needing to evaluate it. Compute
  // engine's own `isNumber` already answers exactly this question.
  ce.declare("IsNumeric", {
    signature: "(any) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined =>
      ops[0] === undefined ? undefined : ops[0].isNumber === true ? ce.True : ce.False,
  });

  // MachineNumberQ(expr): an ordinary (IEEE double-ish, ≤15 significant digit) inexact
  // number, as opposed to one computed at extended precision. Compute engine has no
  // separate "machine" number representation — every inexact value is a decimal carrying
  // as many digits as it was given — so this is approximated by digit count; documented as
  // a divergence in the reference entry.
  ce.declare("IsMachineNumber", {
    signature: "(any) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const x = ops[0];
      if (x === undefined) return undefined;
      if (x.isNumber !== true || isExactNumber(x)) return ce.False;
      return digitsOf(ce, x) <= MACHINE_PRECISION_DIGITS ? ce.True : ce.False;
    },
  });

  // Precision(expr): the number of significant decimal digits tracked — Infinity for an
  // exact number (Wolfram's own convention: exact values carry infinite precision).
  ce.declare("Precision", {
    signature: "(any) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const x = ops[0];
      if (x === undefined || x.isNumber !== true) return undefined;
      if (isExactNumber(x)) return ce.symbol("PositiveInfinity");
      return ce.number(digitsOf(ce, x));
    },
  });
};

/** Declare the Wolfram-frontier list/array heads: Array, Accumulate, FoldList, Cases,
 *  SparseArray, seeded RandomInteger (+ SeedRandom), and the IsNumeric/IsMachineNumber/
 *  Precision trio. */
export function declareListFrontier(ce: ComputeEngine): void {
  ce.declare("Array", {
    signature: "((integer) any -> any, any, any?, symbol?) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const f = ops[0];
      if (f === undefined || ops[1] === undefined) return undefined;
      const dims = dimsOf(ops[1]);
      if (dims === undefined) return undefined;
      const origins = originsOf(ops[2], dims.length);
      if (origins === undefined) return undefined;
      const headName = ops[3] !== undefined ? symbolNameOf(ops[3]) : "List";
      if (headName === undefined) return undefined;
      return buildArray(ce, f, dims, origins, headName);
    },
  });

  ce.declare("Accumulate", {
    signature: "(collection<any>) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      if (ops[0] === undefined) return undefined;
      const items = operandsOf(ops[0]);
      if (items.length === 0) return ce.function("List", []);
      const [seed, ...rest] = items;
      return foldListFrom(ce, ce.symbol("Add"), seed, rest);
    },
  });

  ce.declare("FoldList", {
    signature: "((any, any) any -> any, any, collection<any>?) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const f = ops[0];
      if (f === undefined) return undefined;
      if (ops.length >= 3 && ops[2] !== undefined) return foldListFrom(ce, f, ops[1], operandsOf(ops[2]));
      if (ops[1] === undefined) return undefined;
      const items = operandsOf(ops[1]);
      if (items.length === 0) return ce.function("List", []);
      const [seed, ...rest] = items;
      return foldListFrom(ce, f, seed, rest);
    },
  });

  declareCases(ce);
  declareSparseArray(ce);
  declareRandomInteger(ce);
  declareNumericPredicates(ce);
}
