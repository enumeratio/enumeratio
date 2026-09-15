import { registerAlgebra } from "@enumeratio/algebra";
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf } from "@enumeratio/boxed";
import {
  add,
  basisElement,
  type Coefficients,
  type Element,
  identityPermutation,
  multiply,
  type Permutation,
  permutationKey,
  permutations,
  scale,
} from "./hecke.ts";

// Wiring H_n(q) to compute-engine. Two things are new here relative to the earlier
// algebra libraries:
//
//  1. A product of two basis elements is a LINEAR COMBINATION, not one basis element
//     times a scalar — so the parser has to read sums back in, and the printer has to
//     write them out.
//  2. The coefficients are polynomials in q. Keeping them as compute-engine expressions
//     means they stay exact and simplify themselves: `q·(q−1) + (q−1)` comes back
//     factored or expanded as the engine sees fit, and substituting q = 1 is just
//     `Subs`.

/** The deformation parameter. Free, so H_n(q) lives over ℤ[q] until you pick a q. */
const PARAMETER = "q";

/** `HeckeAlgebra(n)` → n. */
function algebraSize(expr: BoxedExpression): number | undefined {
  if (expr.operator !== "HeckeAlgebra") return undefined;
  const n = integerAt(operandsOf(expr)[0]);
  return n !== undefined && n >= 1 ? n : undefined;
}

/** `HeckeT([2,1,3])` → the permutation, if it is one. */
function basisPermutation(expr: BoxedExpression): Permutation | undefined {
  if (expr.operator !== "HeckeT") return undefined;
  const listed = operandsOf(expr)[0];
  if (listed === undefined || listed.operator !== "List") return undefined;
  const values = operandsOf(listed).map(integerAt);
  if (!values.every((v): v is number => v !== undefined)) return undefined;
  const n = values.length;
  const seen = new Set(values);
  if (seen.size !== n || values.some((v) => v < 1 || v > n)) return undefined; // not a permutation
  return values;
}

export function declareHecke(ce: ComputeEngine): void {
  // `q` becomes a session-wide free symbol, because every coefficient this package
  // produces is a polynomial in it and those outlive any scope we could push. Declaring
  // it explicitly says so; `ce.symbol` would bind it anyway, just silently and untyped.
  if (!ce.lookupDefinition(PARAMETER)) ce.declare(PARAMETER, "number");

  /** Coefficients are compute-engine expressions, evaluated as they are combined. */
  const ring: Coefficients<BoxedExpression> = {
    zero: ce.number(0),
    one: ce.number(1),
    q: ce.symbol(PARAMETER),
    qMinusOne: ce.function("Subtract", [ce.symbol(PARAMETER), ce.number(1)]).evaluate(),
    add: (a, b) => ce.function("Add", [a, b]).evaluate(),
    multiply: (a, b) => ce.function("Multiply", [a, b]).evaluate(),
    isZero: (a) => a.is(0) === true,
  };

  const toExpression = (element: Element<BoxedExpression>): BoxedExpression => {
    const terms = [...element.values()].sort((a, b) =>
      permutationKey(a.w).localeCompare(permutationKey(b.w)),
    );
    if (terms.length === 0) return ce.number(0);
    const parts = terms.map((term) => {
      const basis = ce.function("HeckeT", [
        ce.function(
          "List",
          term.w.map((v) => ce.number(v)),
        ),
      ]);
      return term.coefficient.is(1) === true
        ? basis
        : ce.function("Multiply", [term.coefficient, basis]);
    });
    return parts.length === 1 ? parts[0]! : ce.function("Add", parts);
  };

  /**
   * Read an expression as an element: a basis element, or a scalar multiple of one, or
   * a sum of those. Anything else is not ours — including a `HeckeT` on a different
   * number of strands, which belongs to a different algebra.
   */
  const toElement = (expr: BoxedExpression): Element<BoxedExpression> | undefined => {
    const w = basisPermutation(expr);
    if (w !== undefined) return basisElement(ring, w);
    const ops = operandsOf(expr);
    if (expr.operator === "Add") {
      const parts = ops.map(toElement);
      return parts.every((p): p is Element<BoxedExpression> => p !== undefined)
        ? add(ring, parts)
        : undefined;
    }
    if (expr.operator === "Negate") {
      const inner = ops[0] === undefined ? undefined : toElement(ops[0]);
      return inner === undefined ? undefined : scale(ring, inner, ce.number(-1));
    }
    if (expr.operator === "Multiply") {
      // Exactly one operand may be a Hecke element; the rest are coefficients.
      const elements = ops.map(toElement);
      const carried = elements.filter((e) => e !== undefined);
      if (carried.length !== 1) return undefined;
      const index = elements.findIndex((e) => e !== undefined);
      const scalars = ops.filter((_, i) => i !== index);
      if (scalars.some((s) => basisPermutation(s) !== undefined)) return undefined;
      const factor = scalars.length === 0 ? ring.one : ce.function("Multiply", scalars).evaluate();
      return scale(ring, carried[0]!, factor);
    }
    return undefined;
  };

  /** Every T_w carried by an expression must be on the same number of strands. */
  const sameSize = (element: Element<BoxedExpression>): boolean => {
    const sizes = new Set([...element.values()].map((t) => t.w.length));
    return sizes.size <= 1;
  };

  ce.declare("HeckeAlgebra", { signature: "(integer) -> value" });
  ce.declare("HeckeT", { signature: "(list<integer>) -> number" });

  registerAlgebra(ce, {
    name: "hecke",
    basis: (expr) => {
      const n = algebraSize(expr);
      if (n === undefined || n > 6) return undefined; // 720 basis elements is already plenty
      return ce.function(
        "List",
        permutations(n).map((w) =>
          ce.function("HeckeT", [
            ce.function(
              "List",
              w.map((v) => ce.number(v)),
            ),
          ]),
        ),
      );
    },
    dimension: (expr) => {
      const n = algebraSize(expr);
      if (n === undefined) return undefined;
      let total = 1;
      for (let k = 2; k <= n; k++) total *= k;
      return ce.number(total);
    },
    contains: (element, expr) => {
      const n = algebraSize(expr);
      const read = toElement(element);
      if (n === undefined || read === undefined) return undefined;
      const inside = [...read.values()].every((term) => term.w.length === n);
      return ce.symbol(inside ? "True" : "False");
    },
    product: (ops) => {
      const parts = ops.map(toElement);
      if (!parts.every((p): p is Element<BoxedExpression> => p !== undefined)) return undefined;
      if (!parts.every(sameSize)) return undefined;
      const sizes = new Set(parts.flatMap((p) => [...p.values()].map((t) => t.w.length)));
      if (sizes.size > 1) return undefined; // different algebras
      return toExpression(parts.reduce((a, b) => multiply(ring, a, b)));
    },
  });

  /**
   * The specialisation q ↦ 1, where the deformation vanishes and H_n(q) becomes the
   * group algebra of S_n. Worth its own head because it is the whole point of calling
   * this a deformation, and because reading it off a printed polynomial is fiddly.
   */
  ce.declare("HeckeSpecialize", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const element = ops[0] === undefined ? undefined : toElement(ops[0]);
      const value = ops[1];
      if (element === undefined || value === undefined) return undefined;
      // Substitute, then keep only what survives — a coefficient that vanishes at this
      // q takes its basis element out of the element entirely.
      const substituted = new Map(
        [...element.entries()]
          .map(([key, term]) => {
            const coefficient = term.coefficient.subs({ [PARAMETER]: value }).evaluate();
            return [key, { w: term.w, coefficient }] as const;
          })
          .filter(([, term]) => term.coefficient.is(0) !== true),
      );
      return toExpression(substituted);
    },
  });

  /** The identity element T_e, for writing products that start from one. */
  ce.declare("HeckeIdentity", {
    signature: "(integer) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = integerAt(ops[0]);
      if (n === undefined || n < 1) return undefined;
      return toExpression(basisElement(ring, identityPermutation(n)));
    },
  });
}
