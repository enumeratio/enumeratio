import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf, widenSignature, wrapOperator } from "@enumeratio/boxed";

// Level-aware and structural list operations compute-engine doesn't answer yet: Partition's
// multi-dimensional block form and its wraparound/padded overhangs, Flatten's infinite
// depth, dimension-permuting level lists and any-head nesting, Count/All/Any's level
// arguments, Part(At) of a non-collection expression, and a new FirstPosition head for
// nested search (compute-engine's own IndexOf/Position only look at the top level).

/** `fn(x)` via compute-engine's own `Apply` — see `list-functional.ts`'s `applyFn` for why
 *  the argument goes in directly rather than wrapped in a `List`. */
const applyFn = (ce: ComputeEngine, fn: BoxedExpression, arg: BoxedExpression): BoxedExpression =>
  ce.function("Apply", [fn, arg]).evaluate();

/** A 1-based, possibly-negative index resolved against `length` — the same convention `At`
 *  uses elsewhere; kept local rather than exported to avoid widening list-heads.ts's surface. */
const resolveIndex1Based = (index: number, length: number): number | undefined => {
  if (index > 0) return index <= length ? index - 1 : undefined;
  if (index < 0) return -index <= length ? length + index : undefined;
  return undefined;
};

/** The elements of `expr` at exactly Wolfram level `level` (level 0 is `expr` itself, level
 *  1 its direct operands, level 2 their operands, and so on) — descending only through
 *  `List` nodes, since anything else has no further "parts" to speak of at this level. */
const elementsAtExactLevel = (expr: BoxedExpression, level: number): readonly BoxedExpression[] => {
  if (level === 0) return [expr];
  if (expr.operator !== "List") return [];
  const items = operandsOf(expr);
  return level === 1 ? items : items.flatMap((item) => elementsAtExactLevel(item, level - 1));
};

/** The elements of `expr` at every level from 1 through `maxLevel` — Wolfram's shorthand
 *  for a bare integer level spec, as opposed to `{n}` (level `n` only). */
const elementsUpToLevel = (expr: BoxedExpression, maxLevel: number): readonly BoxedExpression[] => {
  const acc: BoxedExpression[] = [];
  for (let level = 1; level <= maxLevel; level++) acc.push(...elementsAtExactLevel(expr, level));
  return acc;
};

/** How many of `elements` match `test` — a plain value (exact equality, [[Count]]'s default)
 *  or a `Function` predicate, same two forms `Count` already accepts at the top level. */
const countMatches = (ce: ComputeEngine, elements: readonly BoxedExpression[], test: BoxedExpression): number => {
  if (test.operator === "Function") {
    return elements.filter((e) => symbolNameOf(applyFn(ce, test, e)) === "True").length;
  }
  return elements.filter((e) => e.isEqual(test) === true).length;
};

/** A bare integer level spec (levels 1..n) or a single-element `List` (level n only), or
 *  `undefined` if `spec` is neither. */
type LevelSpec = { readonly kind: "upTo" | "exact"; readonly n: number };
const levelSpecOf = (spec: BoxedExpression): LevelSpec | undefined => {
  const n = integerAt(spec);
  if (n !== undefined) return { kind: "upTo", n };
  if (spec.operator === "List" && operandsOf(spec).length === 1) {
    const exact = integerAt(operandsOf(spec)[0]);
    return exact === undefined ? undefined : { kind: "exact", n: exact };
  }
  return undefined;
};
const elementsAtLevelSpec = (expr: BoxedExpression, spec: LevelSpec): readonly BoxedExpression[] =>
  spec.kind === "upTo" ? elementsUpToLevel(expr, spec.n) : elementsAtExactLevel(expr, spec.n);

/** The rectangular shape of a nested `List` — the length at each level, stopping at the
 *  first level that isn't itself a uniform `List` of `List`s. Only as many dimensions as
 *  the caller asks for are ever read (`Partition`'s block form truncates to its `sizes`
 *  length), so a ragged deeper level never matters. */
const shapeOf = (list: BoxedExpression): number[] => {
  const dims: number[] = [];
  let cur: BoxedExpression = list;
  for (;;) {
    if (cur.operator !== "List") break;
    const items = operandsOf(cur);
    dims.push(items.length);
    if (items.length === 0 || items[0].operator !== "List") break;
    cur = items[0];
  }
  return dims;
};

/** The element of a nested `List` at a full multi-dimensional (0-based) index. */
const elementAt = (list: BoxedExpression, indices: readonly number[]): BoxedExpression => {
  let cur = list;
  for (const index of indices) cur = operandsOf(cur)[index];
  return cur;
};

// --- Flatten -----------------------------------------------------------------------------

/** `Flatten(f(a, f(b, f(c))))`: splice in the operands of any nested call to the SAME head,
 *  not just `List` — compute-engine's Flatten is List-only. */
const flattenSameHead = (ce: ComputeEngine, expr: BoxedExpression): BoxedExpression => {
  const head = expr.operator;
  const flat: BoxedExpression[] = [];
  const visit = (e: BoxedExpression): void => {
    if (e.operator === head) operandsOf(e).forEach(visit);
    else flat.push(e);
  };
  operandsOf(expr).forEach(visit);
  return ce.function(head, flat);
};

/** `Flatten(list, {{p1}, {p2}, …})`: a list-of-levels spec that's a permutation of
 *  `1..rank` regroups the array's dimensions — e.g. `{{2}, {1}}` transposes a matrix.
 *  Output dimension `k` reads from input dimension `perm[k]`, so index `k` of the output
 *  maps back to slot `perm[k] - 1` of the input's index vector. */
const permutationOf = (levels: BoxedExpression, rank: number): number[] | undefined => {
  if (levels.operator !== "List") return undefined;
  const specs = operandsOf(levels);
  if (specs.length !== rank) return undefined;
  const perm = specs.map((spec) =>
    spec.operator === "List" && operandsOf(spec).length === 1 ? integerAt(operandsOf(spec)[0]) : undefined,
  );
  if (perm.some((p) => p === undefined || p < 1 || p > rank)) return undefined;
  const asNumbers = perm as number[];
  return new Set(asNumbers).size === rank ? asNumbers : undefined;
};

const permuteDimensions = (ce: ComputeEngine, list: BoxedExpression, perm: readonly number[]): BoxedExpression => {
  const dims = shapeOf(list);
  const outDims = perm.map((p) => dims[p - 1]);
  const build = (dimIndex: number, outIndex: readonly number[]): BoxedExpression => {
    if (dimIndex === perm.length) {
      const inIndex: number[] = new Array(perm.length);
      perm.forEach((p, k) => {
        inIndex[p - 1] = outIndex[k];
      });
      return elementAt(list, inIndex);
    }
    const items: BoxedExpression[] = [];
    for (let i = 0; i < outDims[dimIndex]; i++) items.push(build(dimIndex + 1, [...outIndex, i]));
    return ce.function("List", items);
  };
  return build(0, []);
};

// --- Partition -----------------------------------------------------------------------------

/** `Partition(list, {n1, n2, …}, d)`: cuts a rank-`sizes.length` array into (possibly
 *  overlapping, when `d < n`) rectangular blocks of shape `sizes`, offset by `offsets`
 *  between windows along each dimension — the matrix-into-2x2-blocks form. */
const windowStarts = (dimLength: number, size: number, offset: number): number[] => {
  const starts: number[] = [];
  for (let s = 0; s + size <= dimLength; s += offset) starts.push(s);
  return starts;
};

const extractBlock = (
  node: BoxedExpression,
  ce: ComputeEngine,
  starts: readonly number[],
  sizes: readonly number[],
): BoxedExpression => {
  if (starts.length === 0) return node;
  const [s0, ...restStarts] = starts;
  const [n0, ...restSizes] = sizes;
  const items = operandsOf(node).slice(s0, s0 + n0);
  return ce.function(
    "List",
    items.map((item) => extractBlock(item, ce, restStarts, restSizes)),
  );
};

const partitionBlocks = (
  ce: ComputeEngine,
  list: BoxedExpression,
  sizes: readonly number[],
  offsets: readonly number[],
): BoxedExpression => {
  const dims = shapeOf(list);
  const startsPerDim = sizes.map((size, i) => windowStarts(dims[i], size, offsets[i]));
  const build = (dimIndex: number, prefix: readonly number[]): BoxedExpression => {
    if (dimIndex === sizes.length) return extractBlock(list, ce, prefix, sizes);
    return ce.function(
      "List",
      startsPerDim[dimIndex].map((s) => build(dimIndex + 1, [...prefix, s])),
    );
  };
  return build(0, []);
};

/** Wolfram's `{kL, kR}` overhang convention: position `k` in a sublist (1-based from the
 *  front, or from the back when `k < 0`) resolved to a plain 1-based index within a window
 *  of length `n`. */
const sublistIndex = (k: number, n: number): number => (k > 0 ? k : n + k + 1);

/** `Partition(list, n, d, {kL, kR}, pad?)`: sliding windows whose overhang past either end
 *  of `list` either wraps cyclically (no `pad`) or is filled with `pad`. `kL` pins where
 *  the first window starts relative to `list`'s first element; `kR` pins where the last
 *  window ends relative to `list`'s last element — see `sublistIndex`. */
const overhangWindows = (
  ce: ComputeEngine,
  items: readonly BoxedExpression[],
  n: number,
  d: number,
  kL: number,
  kR: number,
  pad: BoxedExpression | undefined,
): BoxedExpression => {
  const len = items.length;
  const firstStart = 2 - sublistIndex(kL, n);
  const lastStart = len - sublistIndex(kR, n) + 1;
  const valueAt = (index: number): BoxedExpression => {
    if (index >= 1 && index <= len) return items[index - 1];
    if (pad !== undefined) return pad;
    const wrapped = (((index - 1) % len) + len) % len;
    return items[wrapped];
  };
  const windows: BoxedExpression[] = [];
  for (let start = firstStart; start <= lastStart; start += d) {
    const window: BoxedExpression[] = [];
    for (let k = 0; k < n; k++) window.push(valueAt(start + k));
    windows.push(ce.function("List", window));
  }
  return ce.function("List", windows);
};

// --- FirstPosition ---------------------------------------------------------------------

/** The first position `value` occurs at, searching every level (depth-first, outer-to-inner,
 *  left-to-right) rather than only the top one — Wolfram's `FirstPosition`, which
 *  [[IndexOf]] and [[Position]] don't reach for since they stay at the top level. */
const firstPositionPath = (
  expr: BoxedExpression,
  value: BoxedExpression,
  prefix: readonly number[],
): number[] | undefined => {
  const items = operandsOf(expr);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const path = [...prefix, i + 1];
    if (item.isEqual(value) === true) return path;
    if (item.operator === "List") {
      const found = firstPositionPath(item, value, path);
      if (found !== undefined) return found;
    }
  }
  return undefined;
};

/** Declare the level-aware and structural list heads: Partition's block/overhang forms,
 *  Flatten's infinite depth / dimension permutation / any-head nesting, Count/All/Any's
 *  level arguments, At(Part) of any expression, and the new FirstPosition head. */
export function declareListLevelHeads(ce: ComputeEngine): void {
  // Partition(list, {n1, n2, …}, offset): a list of sizes cuts a rank-k array into
  // rectangular blocks, `offset` either a shared scalar or a per-dimension list.
  widenSignature(ce, "Partition", "(any, any, any?, any?, any?) -> any");
  wrapOperator(
    ce,
    ["Partition", 1, 1],
    (ops) => {
      if (ops.length !== 3 || ops[1].operator !== "List") return false;
      const sizes = operandsOf(ops[1]).map(integerAt);
      if (sizes.some((n) => n === undefined)) return false;
      const scalarOffset = integerAt(ops[2]);
      if (scalarOffset !== undefined) return true;
      if (ops[2].operator !== "List") return false;
      const offsets = operandsOf(ops[2]).map(integerAt);
      return offsets.length === sizes.length && offsets.every((n) => n !== undefined);
    },
    () => (ops) => {
      const sizes = operandsOf(ops[1]).map((op) => integerAt(op)!);
      const scalarOffset = integerAt(ops[2]);
      const offsets =
        scalarOffset !== undefined ? sizes.map(() => scalarOffset) : operandsOf(ops[2]).map((op) => integerAt(op)!);
      return partitionBlocks(ce, ops[0], sizes, offsets);
    },
  );

  // Partition(list, n, d, {kL, kR}, pad?): wraparound (no pad) or padded overhangs — see
  // `overhangWindows`.
  wrapOperator(
    ce,
    ["Partition", 1, 1],
    (ops) =>
      (ops.length === 4 || ops.length === 5) &&
      integerAt(ops[1]) !== undefined &&
      integerAt(ops[2]) !== undefined &&
      ops[3].operator === "List" &&
      operandsOf(ops[3]).length === 2 &&
      operandsOf(ops[3]).every((op) => integerAt(op) !== undefined),
    () => (ops) => {
      const items = operandsOf(ops[0]);
      const n = integerAt(ops[1])!;
      const d = integerAt(ops[2])!;
      const [kL, kR] = operandsOf(ops[3]).map((op) => integerAt(op)!);
      return overhangWindows(ce, items, n, d, kL, kR, ops[4]);
    },
  );

  // Flatten(list, PositiveInfinity): an explicit infinite depth, same as the (already
  // fully-flattening) default — compute-engine's depth parameter wants a plain integer.
  // `PositiveInfinity` boxes as a number (re === Infinity), not a symbol.
  widenSignature(ce, "Flatten", "(any, any?) -> any");
  wrapOperator(
    ce,
    ["Flatten", 1, 1],
    (ops) => ops.length === 2 && ops[1].re === Infinity,
    (native) => (ops, options) => native?.([ops[0]], options),
  );

  // Flatten(list, {{p1}, {p2}, …}): a permutation-shaped list-of-levels regroups the
  // array's dimensions — e.g. transposing a matrix. See `permuteDimensions`.
  wrapOperator(
    ce,
    ["Flatten", 1, 1],
    (ops) => {
      if (ops.length !== 2 || ops[0].operator !== "List" || ops[1].operator !== "List") {
        return false;
      }
      return permutationOf(ops[1], shapeOf(ops[0]).length) !== undefined;
    },
    () => (ops) => permuteDimensions(ce, ops[0], permutationOf(ops[1], shapeOf(ops[0]).length)!),
  );

  // Flatten(f(a, f(b, …))): nested calls of any one head flatten, not just `List` — tried
  // only once nothing else (the plain single-argument List case, handled natively) applies.
  wrapOperator(
    ce,
    ["Flatten", 1, 1],
    (ops) => ops.length === 1 && ops[0].operator !== "List",
    () => (ops) => flattenSameHead(ce, ops[0]),
  );

  // Count(collection, value, level): a bare integer counts matches at every level from 1
  // through it; `{level}` counts that level only. See `levelSpecOf`.
  //
  // A 3rd operand is arity compute-engine's native Count rejects outright at BOX time
  // ("unexpected-argument"), replacing it with an error carrying only its PRINTED form —
  // not the original boxed expression — before `evaluate` (or even `wrapOperator`'s
  // `applies` gate) ever runs. Patched on `operator.canonical` instead, the same technique
  // `list-heads.ts` uses for `Join`/`Append`'s own box-time folding: our 3-operand case is
  // resolved to its answer directly in canonical, and everything else defers to the native
  // fold via a `canonical`-pinned stand-in that breaks the self-recursion (see the `Join`
  // override's own note on why).
  {
    const definition = ce.lookupDefinition("Count");
    const operator =
      definition !== undefined && "operator" in definition
        ? (
            definition as {
              operator: {
                canonical?: (ops: readonly BoxedExpression[], options: unknown) => BoxedExpression | undefined;
              };
            }
          ).operator
        : undefined;
    if (operator !== undefined) {
      const nativeCanonical = operator.canonical;
      const nativeOperator = Object.create(operator) as typeof operator;
      nativeOperator.canonical = nativeCanonical;
      operator.canonical = (ops, options) => {
        const spec = ops.length === 3 ? levelSpecOf(ops[2]) : undefined;
        return spec !== undefined
          ? ce.number(countMatches(ce, elementsAtLevelSpec(ops[0], spec), ops[1]))
          : nativeCanonical?.call(nativeOperator, ops, options);
      };
    }
  }

  // All(collection, predicate, level) / Any(collection, predicate, level): test the
  // elements at exactly that level, delegating the actual True/False decision to the
  // native 2-argument form over the gathered elements.
  //
  // Like Count's own over-arity case (above), a 3rd operand here is silently DROPPED by
  // native canonical folding rather than turned into a recoverable error — `evaluate`
  // (and `wrapOperator`'s own `applies` gate) never even sees it. Patched on
  // `operator.canonical` for the same reason.
  for (const head of ["All", "Any"] as const) {
    const definition = ce.lookupDefinition(head);
    const operator =
      definition !== undefined && "operator" in definition
        ? (
            definition as {
              operator: {
                canonical?: (ops: readonly BoxedExpression[], options: unknown) => BoxedExpression | undefined;
              };
            }
          ).operator
        : undefined;
    if (operator === undefined) continue;
    const nativeCanonical = operator.canonical;
    const nativeOperator = Object.create(operator) as typeof operator;
    nativeOperator.canonical = nativeCanonical;
    operator.canonical = (ops, options) => {
      const level = ops.length === 3 ? integerAt(ops[2]) : undefined;
      if (level === undefined) return nativeCanonical?.call(nativeOperator, ops, options);
      const elements = elementsAtExactLevel(ops[0], level);
      return ce.function(head, [ce.function("List", elements), ops[1]]).evaluate();
    };
  }

  // At(expr, index): parts of any expression, not just a collection's — the second term of
  // a sum, say. compute-engine's native At types its first parameter strictly as
  // `dictionary | indexed_collection`, so boxing e.g. `At(Add(a, b, c), 2)` coerces the
  // `Add` operand into an INVALID `Error` expression at BOX time — and evaluate() on an
  // invalid expression short-circuits to that same error without ever reaching
  // `operator.evaluate` (confirmed by hand: a `wrapOperator` handler here is simply never
  // called), so this can't be fixed downstream the way Count's own over-arity case (above)
  // is. Patched on `operator.canonical` instead: the native fold still runs FIRST, for
  // every shape it already handles (a `List`, a lazy family collection, `At`'s own `Span`
  // form, …) — only when ITS result is invalid do we recompute the answer ourselves,
  // straight from the pre-coercion operands `canonical` was called with.
  {
    const definition = ce.lookupDefinition("At");
    const operator =
      definition !== undefined && "operator" in definition
        ? (
            definition as {
              operator: {
                canonical?: (ops: readonly BoxedExpression[], options: unknown) => BoxedExpression | undefined;
              };
            }
          ).operator
        : undefined;
    if (operator !== undefined) {
      const nativeCanonical = operator.canonical;
      const nativeOperator = Object.create(operator) as typeof operator;
      nativeOperator.canonical = nativeCanonical;
      operator.canonical = (ops, options) => {
        // All as a part spec is every part, Span(1, −1); the bare symbol would otherwise
        // be read as compute-engine's own All(collection, predicate) head and fail typing.
        if (ops.slice(1).some((op) => symbolNameOf(op) === "All")) {
          const all = ce.function("Span", [ce.One, ce.number(-1)]);
          return ce.function(
            "At",
            ops.map((op, i) => (i > 0 && symbolNameOf(op) === "All" ? all : op)),
          );
        }
        if (ops.length !== 2 || integerAt(ops[1]) === undefined) {
          return nativeCanonical?.call(nativeOperator, ops, options);
        }
        const nativeResult = nativeCanonical?.call(nativeOperator, ops, options);
        if (nativeResult !== undefined && nativeResult.isValid !== false) return nativeResult;
        const items = operandsOf(ops[0]);
        const index = resolveIndex1Based(integerAt(ops[1])!, items.length);
        return index === undefined ? ce.symbol("NaN") : items[index];
      };
    }
  }

  // FirstPosition(collection, value): the position of the first occurrence anywhere in a
  // nested collection, searching every level rather than just the top one. Wolfram's own
  // "not found" answer is Missing["NotFound"]; without a Missing domain here, the empty
  // list stands in, echoing Position's own answer for an absent value.
  ce.declare("FirstPosition", {
    signature: "(any, any) -> list<integer>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const found = firstPositionPath(ops[0], ops[1], []);
      return found === undefined ? ce.box(["List"]) : ce.box(["List", ...found]);
    },
  });
}
