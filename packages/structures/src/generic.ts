import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf, widenSignature, wrapOperator } from "@enumeratio/engine";
import { compare, member } from "./conform.ts";

// The generic heads: compute-engine's own `Min`, `Max`, `Clamp`, `Floor`, `Ceil`, `Round`,
// taught to work on any value whose type has the structure they need (design/structures.md).
// A real number keeps the native path, and so does anything with an unknown in it. Anything
// else goes to the members of the protocols its type conforms to; when it conforms to none,
// the native handler has it as before.

const isReal = (op: BoxedExpression): boolean => op.type.matches("real") || op.type.matches("signed_infinity");

/** A value the generic path can look at: not a real number, and nothing left unknown. */
const isStructured = (op: BoxedExpression): boolean => !isReal(op) && op.unknowns.length === 0;

/** The pool `Min`/`Max` compare: lists flattened, as compute-engine's do. */
const pool = (ops: readonly BoxedExpression[]): BoxedExpression[] =>
  ops.flatMap((op) => (op.operator === "List" ? pool(operandsOf(op)) : [op]));

/** Each value's components when all of them are product-ordered, else undefined. */
function coordinatesOf(ce: ComputeEngine, values: readonly BoxedExpression[]): BoxedExpression[][] | undefined {
  const out: BoxedExpression[][] = [];
  for (const v of values) {
    const parts = member(ce, "Coordinates", [v]);
    if (parts === undefined) return undefined;
    out.push([...operandsOf(parts)]);
  }
  return out;
}

/** Apply `head` component by component, rebuilding a value shaped like `like`. */
function componentwise(
  ce: ComputeEngine,
  head: string,
  like: BoxedExpression,
  parts: readonly BoxedExpression[][],
): BoxedExpression | undefined {
  const width = parts[0]!.length;
  if (parts.some((p) => p.length !== width)) return undefined;
  const combined = Array.from({ length: width }, (_, i) =>
    ce
      .function(
        head,
        parts.map((p) => p[i]!),
      )
      .evaluate(),
  );
  return member(ce, "WithCoordinates", [like, ce.function("List", combined)]);
}

/** The least (`side` -1) or greatest (1) of `values`: the lattice's meet or join, else by `Compare`. */
function extremum(ce: ComputeEngine, values: readonly BoxedExpression[], side: -1 | 1): BoxedExpression | undefined {
  const head = side < 0 ? "Min" : "Max";
  const parts = coordinatesOf(ce, values);
  if (parts !== undefined) return componentwise(ce, head, values[0]!, parts);
  const bound = side < 0 ? "GreatestLowerBound" : "LeastUpperBound";
  let best = values[0]!;
  for (const v of values.slice(1)) {
    const joined = member(ce, bound, [best, v]);
    if (joined !== undefined) {
      best = joined;
      continue;
    }
    const c = compare(ce, v, best);
    if (c === undefined) return undefined;
    if (c === side) best = v;
  }
  return best;
}

/** A tick next to `x`: the lower (`Floor`) or the upper (`Ceil`). */
function tick(ce: ComputeEngine, x: BoxedExpression, head: "Floor" | "Ceil"): BoxedExpression | undefined {
  const parts = coordinatesOf(ce, [x]);
  if (parts !== undefined) return componentwise(ce, head, x, parts);
  return member(ce, head === "Floor" ? "LowerTick" : "UpperTick", [x]);
}

/**
 * The nearest tick to `x`: the lower one below the midpoint between them, the upper one above.
 * A tie goes to the even tick when the ticks have a parity (Wolfram's rule), else up.
 */
function nearest(ce: ComputeEngine, x: BoxedExpression): BoxedExpression | undefined {
  const parts = coordinatesOf(ce, [x]);
  if (parts !== undefined) return componentwise(ce, "Round", x, parts);
  const lo = member(ce, "LowerTick", [x]);
  const hi = member(ce, "UpperTick", [x]);
  if (lo === undefined || hi === undefined) return undefined;
  if (compare(ce, lo, hi) === 0) return lo;
  const mid = member(ce, "Midpoint", [lo, hi]);
  if (mid === undefined) return undefined;
  const c = compare(ce, x, mid);
  if (c === undefined) return undefined;
  if (c !== 0) return c < 0 ? lo : hi;
  const even = member(ce, "IsEvenTick", [lo]);
  return even !== undefined && symbolNameOf(even) === "True" ? lo : hi;
}

export function declareGenericHeads(ce: ComputeEngine): void {
  // Wide enough to box a non-number; the native handlers still only see what they took.
  for (const head of ["Min", "Max"]) widenSignature(ce, head, "(any*) -> any");
  for (const head of ["Floor", "Ceil", "Round"]) widenSignature(ce, head, "(any, any?) -> any");
  widenSignature(ce, "Clamp", "(any, any?, any?, any?, any?) -> any");

  for (const [head, side] of [
    ["Min", -1],
    ["Max", 1],
  ] as const) {
    wrapOperator(
      ce,
      [head, "'b'", "'a'"],
      (ops) => pool(ops).some(isStructured),
      (native) => (ops, options) => extremum(ce, pool(ops), side) ?? native?.(ops, options),
      { min: 1 },
    );
  }

  // Clamp(x, lo, hi) = Max(lo, Min(x, hi)), in any lattice.
  wrapOperator(
    ce,
    ["Clamp", "'m'", "'c'", "'k'"],
    (ops) => ops.some(isStructured),
    (native) => (ops, options) => {
      const [x, lo, hi] = ops as [BoxedExpression, BoxedExpression, BoxedExpression];
      const below = extremum(ce, [x, hi], -1);
      return (below === undefined ? undefined : extremum(ce, [lo, below], 1)) ?? native?.(ops, options);
    },
    3,
  );

  for (const head of ["Floor", "Ceil"] as const)
    wrapOperator(
      ce,
      [head, ["Complex", 2.5, 3.7]],
      (ops) => isStructured(ops[0]!),
      (native) => (ops, options) => tick(ce, ops[0]!, head) ?? native?.(ops, options),
      1,
    );
  wrapOperator(
    ce,
    ["Round", ["Complex", 2.5, 3.7]],
    (ops) => isStructured(ops[0]!),
    (native) => (ops, options) => nearest(ce, ops[0]!) ?? native?.(ops, options),
    1,
  );
}
