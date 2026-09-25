import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/boxed";

// A second wave of Wolfram list heads compute-engine doesn't have at all (Riffle, Gather,
// GatherBy, Split, SplitBy, SortBy, PadLeft, PadRight, NoneTrue), plus two heads that exist
// only as OTHER heads' argument forms (Span, UpTo) — they carry no evaluation of their own,
// just data other operators (At, Take, Partition, Ordering) learn to read.
//
// Declared after `declareListHeads` in library.ts on purpose: Partition and Ordering are
// already wrapped there for their plain-integer forms, and our UpTo handlers below need to
// run BEFORE those wrappers see the call (an UpTo operand is not the integer they expect),
// so we attach on top — `wrapOperator`'s `applies` check runs outermost-first, and our
// handlers never call through to the layer below for the UpTo case at all, so which native
// evaluate is captured underneath them doesn't matter.

/**
 * Call a (possibly `Function`-headed) expression as an operator over `args`. `ce.box`'s
 * input type wants a symbol name in head position; a boxed `Function(...)` works fine there
 * at runtime (compute-engine dispatches on whatever it finds), so the cast is just working
 * around a type that's narrower than the runtime accepts.
 */
const invoke = (
  ce: ComputeEngine,
  f: BoxedExpression,
  args: readonly BoxedExpression[],
): BoxedExpression => ce.box([f, ...args] as never).evaluate();

/** Ascending order: numeric/orderable via `isLess`/`isGreater`, lexicographic for strings. */
const naturalCompare = (a: BoxedExpression, b: BoxedExpression): number => {
  if (a.isLess(b) === true) return -1;
  if (a.isGreater(b) === true) return 1;
  return 0;
};

/**
 * Normalize a Wolfram-style 1-based position (negative counts from the end, -1 = last) to a
 * positive 1-based position. Not bounds-checked — a caller that indexes past the collection
 * gets `undefined`, which every Span/At path here treats as "no such element".
 */
const normalizePosition = (position: number, length: number): number =>
  position < 0 ? length + position + 1 : position;

/** The integer indices (1-based) a `Span(i, j, step?)` selects out of a `length`-long list. */
const spanIndices = (span: BoxedExpression, length: number): number[] | undefined => {
  const [i, j, s] = operandsOf(span);
  const from = integerAt(i);
  const to = integerAt(j);
  const step = s === undefined ? 1 : integerAt(s);
  if (from === undefined || to === undefined || step === undefined || step === 0) return undefined;
  const start = normalizePosition(from, length);
  const end = normalizePosition(to, length);
  const indices: number[] = [];
  if (step > 0) for (let k = start; k <= end; k += step) indices.push(k);
  else for (let k = start; k >= end; k += step) indices.push(k);
  return indices;
};

/**
 * `At`/`Part` with one or more `Span` operands: resolve the first spec against `expr`
 * (a scalar index drills one level deeper; a `Span` selects several elements, and the
 * remaining specs are applied recursively to EACH of them — which is exactly how nested
 * `Span`s cut a submatrix out of a matrix of matrices).
 */
const partWithSpecs = (
  ce: ComputeEngine,
  expr: BoxedExpression,
  specs: readonly BoxedExpression[],
): BoxedExpression | undefined => {
  if (specs.length === 0) return expr;
  const [spec, ...rest] = specs;
  const items = operandsOf(expr);
  if (spec.operator === "Span") {
    const indices = spanIndices(spec, items.length);
    if (indices === undefined) return undefined;
    const selected = indices
      .map((k) => items[k - 1])
      .filter((element): element is BoxedExpression => element !== undefined);
    if (rest.length === 0) return ce.box(["List", ...selected]);
    const drilled = selected
      .map((element) => partWithSpecs(ce, element, rest))
      .filter((element): element is BoxedExpression => element !== undefined);
    return ce.box(["List", ...drilled]);
  }
  const index = integerAt(spec);
  if (index === undefined) return undefined;
  const element = items[normalizePosition(index, items.length) - 1];
  return element === undefined ? undefined : partWithSpecs(ce, element, rest);
};

/** `Riffle(list, x)` where `x` is a list: pair `list[i]` with `x[i]`, dropping whichever runs out. */
const riffleZip = (
  ce: ComputeEngine,
  items: readonly BoxedExpression[],
  xs: readonly BoxedExpression[],
): BoxedExpression => {
  const result: BoxedExpression[] = [];
  const length = Math.max(items.length, xs.length);
  for (let i = 0; i < length; i++) {
    if (i < items.length) result.push(items[i]);
    if (i < xs.length) result.push(xs[i]);
  }
  return ce.box(["List", ...result]);
};

/** `Riffle(list, x, n)`, and the scalar-`x` 2-arg form: a separator every `n` elements. */
const rifflePeriodic = (
  ce: ComputeEngine,
  items: readonly BoxedExpression[],
  nextSeparator: (index: number) => BoxedExpression | undefined,
  groupSize: number,
): BoxedExpression => {
  const result: BoxedExpression[] = [];
  let i = 0;
  let separatorIndex = 0;
  while (i < items.length) {
    const end = Math.min(i + groupSize, items.length);
    result.push(...items.slice(i, end));
    i = end;
    if (i < items.length) {
      const separator = nextSeparator(separatorIndex++);
      if (separator !== undefined) result.push(separator);
    }
  }
  return ce.box(["List", ...result]);
};

/** Tally elements into first-appearance-ordered groups by a caller-supplied equivalence. */
const groupBy = (
  items: readonly BoxedExpression[],
  sameGroup: (representative: BoxedExpression, candidate: BoxedExpression) => boolean,
): BoxedExpression[][] => {
  const groups: BoxedExpression[][] = [];
  for (const item of items) {
    const group = groups.find((g) => sameGroup(g[0], item));
    if (group !== undefined) group.push(item);
    else groups.push([item]);
  }
  return groups;
};

/** Split into runs on which adjacent elements agree, per `same(prev, current)`. */
const splitRuns = (
  items: readonly BoxedExpression[],
  same: (prev: BoxedExpression, current: BoxedExpression) => boolean,
): BoxedExpression[][] => {
  const runs: BoxedExpression[][] = [];
  for (const item of items) {
    const current = runs[runs.length - 1];
    if (current !== undefined && same(current[current.length - 1], item)) current.push(item);
    else runs.push([item]);
  }
  return runs;
};

/** `PadLeft`/`PadRight`'s ragged-matrix form: pad every row to the widest row's length. */
const padRagged = (
  ce: ComputeEngine,
  rows: readonly BoxedExpression[],
  side: "left" | "right",
): BoxedExpression | undefined => {
  if (rows.length === 0 || !rows.every((row) => row.operator === "List")) return undefined;
  const width = Math.max(...rows.map((row) => operandsOf(row).length));
  const padded = rows.map((row) => {
    const cells = operandsOf(row);
    const filler = Array.from({ length: width - cells.length }, () => ce.Zero);
    return ce.box(["List", ...(side === "left" ? [...filler, ...cells] : [...cells, ...filler])]);
  });
  return ce.box(["List", ...padded]);
};

/** `PadLeft`/`PadRight(list, n, x?)`: pad to length `n`, or truncate to the nearer `n` elements. */
const padTo = (
  ce: ComputeEngine,
  items: readonly BoxedExpression[],
  n: number,
  fill: BoxedExpression,
  side: "left" | "right",
): BoxedExpression => {
  if (n >= items.length) {
    const filler = Array.from({ length: n - items.length }, () => fill);
    return ce.box(["List", ...(side === "left" ? [...filler, ...items] : [...items, ...filler])]);
  }
  const kept = side === "left" ? items.slice(items.length - n) : items.slice(0, n);
  return ce.box(["List", ...kept]);
};

/** Declare Riffle, Span, UpTo, Gather, GatherBy, Split, SplitBy, SortBy, PadLeft, PadRight, NoneTrue. */
export function declareListOpsWolfram(ce: ComputeEngine): void {
  // Span(i, j, step?): a part-spec, never evaluated on its own — At/Part below read it.
  ce.declare("Span", { signature: "(integer, integer, integer?) -> unknown" });
  // UpTo(n): a count-spec meaning "at most n" — Take/Partition/Ordering below read it.
  ce.declare("UpTo", { signature: "(integer) -> unknown" });

  // At(c, spec, spec, …) with at least one Span among the specs: our own recursive part
  // evaluator (see `partWithSpecs`) replaces the native call entirely for this shape, since
  // compute-engine's own multi-operand At silently ignores every spec past the first once
  // one of them is a multi-value index (see list-ops-wolfram.test.ts).
  wrapOperator(
    ce,
    ["At", 1, 1],
    (ops) => ops.slice(1).some((op) => op.operator === "Span"),
    () => (ops) => partWithSpecs(ce, ops[0], ops.slice(1)),
    { min: 2 },
  );

  // Take(c, UpTo(n)) is NOT handled here. Unlike every other head in this module, Take's
  // own operator carries neither an `evaluate` nor a `canonical` — compute-engine dispatches
  // it through an internal table keyed on the operator NAME, reached only when
  // `operator.evaluate` is absent, and used by the collection-protocol families this
  // package declares elsewhere (SquareNumbers, Primes, …). Assigning ANY function to
  // `operator.evaluate` — even one that calls through to a temporarily-unhooked re-box for
  // every shape but UpTo — permanently shadows that table: `numeric-sets.test.ts` and
  // `numeric-closed-form.test.ts`'s `Take(SquareNumbers, 5)`-style calls stopped
  // evaluating at all as soon as this was tried (confirmed by hand; reverted). Reaching the
  // internal table safely would need a compute-engine hook this version doesn't expose, so
  // Take(c, UpTo(n)) stays aspirational — see the entry.

  // Partition(c, UpTo(n)): unlike a plain integer (which @enumeratio/collections' own
  // Partition override drops the ragged remainder of), UpTo keeps a shorter final chunk —
  // exactly compute-engine's native, un-overridden chunking. Implemented directly rather
  // than reached through the layer below, so it doesn't depend on attach order.
  wrapOperator(
    ce,
    ["Partition", 1, 1],
    (ops) => ops[1].operator === "UpTo",
    () => (ops) => {
      const n = integerAt(operandsOf(ops[1])[0]);
      if (n === undefined || n <= 0) return undefined;
      const items = operandsOf(ops[0]);
      const chunks: BoxedExpression[] = [];
      for (let i = 0; i < items.length; i += n) {
        chunks.push(ce.box(["List", ...items.slice(i, i + n)]));
      }
      return ce.box(["List", ...chunks]);
    },
    2,
  );

  // Ordering(c, UpTo(n)): at most n positions of the full ordering — n clamped by `slice`
  // exactly as the plain-integer form already is (@enumeratio/collections' list-heads.ts).
  wrapOperator(
    ce,
    ["Ordering", 1, 1],
    (ops) => ops[1].operator === "UpTo",
    (native) => (ops, options) => {
      const n = integerAt(operandsOf(ops[1])[0]);
      if (n === undefined) return undefined;
      const full = native?.([ops[0]], options);
      return full === undefined ? undefined : ce.box(["List", ...operandsOf(full).slice(0, n)]);
    },
    2,
  );

  // Riffle(list, x, n?): interleave a scalar separator or a second list between list's
  // elements. See `riffleZip` and `rifflePeriodic` for the two shapes' semantics.
  ce.declare("Riffle", {
    signature: "(collection<any>, any, integer?) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const list = ops[0];
      const x = ops[1];
      if (list === undefined || x === undefined || list.operator !== "List") return undefined;
      const items = operandsOf(list);
      const n = ops[2] === undefined ? undefined : integerAt(ops[2]);
      if (ops[2] !== undefined && n === undefined) return undefined;
      if (x.operator === "List" && n === undefined) return riffleZip(ce, items, operandsOf(x));
      const groupSize = n === undefined ? 1 : Math.max(1, n - 1);
      if (x.operator === "List") {
        const xs = operandsOf(x);
        return rifflePeriodic(ce, items, (i) => xs[i], groupSize);
      }
      return rifflePeriodic(ce, items, () => x, groupSize);
    },
  });

  // Gather(list, test?): group identical (or `test`-equivalent) elements, first-appearance
  // order, elements within a group in their original relative order.
  ce.declare("Gather", {
    signature: "(indexed_collection<any>, ((any, any) any -> boolean)?) -> list<list<any>>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const items = operandsOf(ops[0]);
      const test = ops[1];
      const sameGroup =
        test === undefined
          ? (a: BoxedExpression, b: BoxedExpression) => a.isEqual(b) === true
          : (a: BoxedExpression, b: BoxedExpression) =>
              symbolNameOf(invoke(ce, test, [a, b])) === "True";
      const groups = groupBy(items, sameGroup);
      return ce.box(["List", ...groups.map((group) => ce.box(["List", ...group]))]);
    },
  });

  // GatherBy(list, f): group by the value of f(element), same ordering rules as Gather.
  ce.declare("GatherBy", {
    signature: "(indexed_collection<any>, (any) any -> any) -> list<list<any>>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const items = operandsOf(ops[0]);
      const f = ops[1];
      if (f === undefined) return undefined;
      const groups: { key: BoxedExpression; members: BoxedExpression[] }[] = [];
      for (const item of items) {
        const key = invoke(ce, f, [item]);
        const group = groups.find((g) => g.key.isEqual(key) === true);
        if (group !== undefined) group.members.push(item);
        else groups.push({ key, members: [item] });
      }
      return ce.box(["List", ...groups.map((group) => ce.box(["List", ...group.members]))]);
    },
  });

  // Split(list, test?): runs of adjacent elements the test (default equality) agrees on.
  ce.declare("Split", {
    signature: "(indexed_collection<any>, ((any, any) any -> boolean)?) -> list<list<any>>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const items = operandsOf(ops[0]);
      const test = ops[1];
      const same =
        test === undefined
          ? (a: BoxedExpression, b: BoxedExpression) => a.isEqual(b) === true
          : (a: BoxedExpression, b: BoxedExpression) =>
              symbolNameOf(invoke(ce, test, [a, b])) === "True";
      const runs = splitRuns(items, same);
      return ce.box(["List", ...runs.map((run) => ce.box(["List", ...run]))]);
    },
  });

  // SplitBy(list, f): runs on which f(element) is constant.
  ce.declare("SplitBy", {
    signature: "(indexed_collection<any>, (any) any -> any) -> list<list<any>>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const items = operandsOf(ops[0]);
      const f = ops[1];
      if (f === undefined) return undefined;
      const keys = items.map((item) => invoke(ce, f, [item]));
      const runs: BoxedExpression[][] = [];
      const keyRuns: BoxedExpression[] = [];
      items.forEach((item, i) => {
        const lastKey = keyRuns[keyRuns.length - 1];
        if (lastKey !== undefined && lastKey.isEqual(keys[i]) === true) {
          runs[runs.length - 1].push(item);
        } else {
          runs.push([item]);
          keyRuns.push(keys[i]);
        }
      });
      return ce.box(["List", ...runs.map((run) => ce.box(["List", ...run]))]);
    },
  });

  // SortBy(collection, f): sorted by the value of f on each element, stable on ties.
  ce.declare("SortBy", {
    signature: "(collection<any>, (any) any -> any) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const items = operandsOf(ops[0]);
      const f = ops[1];
      if (f === undefined) return undefined;
      const keyed = items.map((item, index) => ({ item, key: invoke(ce, f, [item]), index }));
      keyed.sort((a, b) => naturalCompare(a.key, b.key) || a.index - b.index);
      return ce.box(["List", ...keyed.map((entry) => entry.item)]);
    },
  });

  // PadLeft/PadRight(list, n?, x?): pad to length n with x (default 0), truncating from the
  // padding side when n is shorter; with no n, pad a ragged matrix to a rectangular one.
  for (const [name, side] of [
    ["PadLeft", "left"],
    ["PadRight", "right"],
  ] as const) {
    ce.declare(name, {
      signature: "(collection<any>, integer?, any?) -> collection",
      evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
        const list = ops[0];
        if (list === undefined || list.operator !== "List") return undefined;
        const items = operandsOf(list);
        if (ops[1] === undefined) return padRagged(ce, items, side);
        const n = integerAt(ops[1]);
        if (n === undefined) return undefined;
        return padTo(ce, items, n, ops[2] ?? ce.Zero, side);
      },
    });
  }

  // NoneTrue(xs, predicate): no element satisfies predicate — the negation of Any, which
  // compute-engine already declares (as does All, its NoneTrue-adjacent AllTrue).
  ce.declare("NoneTrue", {
    signature: "(indexed_collection<any>, (any) any -> boolean) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      if (ops[0] === undefined || ops[1] === undefined) return undefined;
      const any = ce.box(["Any", ops[0], ops[1]]).evaluate();
      const verdict = symbolNameOf(any);
      return verdict === "True" ? ce.False : verdict === "False" ? ce.True : undefined;
    },
  });
}
