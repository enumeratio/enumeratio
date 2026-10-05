import { declareAlgebra } from "@enumeratio/structures";
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { registerNotation } from "@enumeratio/boxes";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/engine";
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
import { HECKE_NOTATION } from "./notation.ts";

// Wiring H_n(q) to compute-engine. The parameter q is an argument — `HeckeAlgebra(n, q)`,
// `HeckeT(w, q)` — never a declared symbol, so it is the user's own `q` (or a number). Two things are new here relative to the earlier
// algebra libraries:
//
//  1. A product of two basis elements is a LINEAR COMBINATION, not one basis element
//     times a scalar — so the parser has to read sums back in, and the printer has to
//     write them out.
//  2. The coefficients are polynomials in q. Keeping them as compute-engine expressions
//     means they stay exact and simplify themselves: `q·(q−1) + (q−1)` comes back
//     factored or expanded as the engine sees fit, and substituting q = 1 is just
//     `Subs`.

/** `HeckeAlgebra(n, q)` → n. */
function algebraSize(expr: BoxedExpression): number | undefined {
  if (expr.operator !== "HeckeAlgebra") return undefined;
  const n = integerAt(operandsOf(expr)[0]);
  return n !== undefined && n >= 1 ? n : undefined;
}

/** The parameter of the first `HeckeT` or `HeckeAlgebra` inside `expr`. */
function parameterOf(expr: BoxedExpression): BoxedExpression | undefined {
  const ops = operandsOf(expr);
  if (expr.operator === "HeckeT" || expr.operator === "HeckeAlgebra") return ops[1];
  for (const op of ops) {
    const found = parameterOf(op);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** `HeckeT([2,1,3], q)` → the permutation, if it is one and carries this `q`. */
function basisPermutation(expr: BoxedExpression, q: BoxedExpression): Permutation | undefined {
  if (expr.operator !== "HeckeT") return undefined;
  const carried = operandsOf(expr)[1];
  if (carried === undefined || !carried.isSame(q)) return undefined;
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
  registerNotation(ce, HECKE_NOTATION);
  /** Coefficients are compute-engine expressions, evaluated as they are combined. */
  const ringFor = (q: BoxedExpression): Coefficients<BoxedExpression> => ({
    zero: ce.number(0),
    one: ce.number(1),
    q,
    qMinusOne: ce.function("Subtract", [q, ce.number(1)]).evaluate(),
    add: (a, b) => ce.function("Add", [a, b]).evaluate(),
    multiply: (a, b) => ce.function("Multiply", [a, b]).evaluate(),
    isZero: (a) => a.is(0) === true,
  });

  const toExpression = (element: Element<BoxedExpression>, q: BoxedExpression): BoxedExpression => {
    const terms = [...element.values()].toSorted((a, b) => permutationKey(a.w).localeCompare(permutationKey(b.w)));
    if (terms.length === 0) return ce.number(0);
    const parts = terms.map((term) => {
      const basis = ce.function("HeckeT", [
        ce.function(
          "List",
          term.w.map((v) => ce.number(v)),
        ),
        q,
      ]);
      return term.coefficient.is(1) === true ? basis : ce.function("Multiply", [term.coefficient, basis]);
    });
    return parts.length === 1 ? parts[0]! : ce.function("Add", parts);
  };

  /**
   * Read an expression as an element: a basis element, or a scalar multiple of one, or
   * a sum of those. Anything else is not ours — including a `HeckeT` on a different
   * number of strands, which belongs to a different algebra.
   */
  const toElement = (expr: BoxedExpression, q: BoxedExpression): Element<BoxedExpression> | undefined => {
    const ring = ringFor(q);
    const w = basisPermutation(expr, q);
    if (w !== undefined) return basisElement(ring, w);
    const ops = operandsOf(expr);
    if (expr.operator === "Add") {
      const parts = ops.map((op) => toElement(op, q));
      return parts.every((p): p is Element<BoxedExpression> => p !== undefined) ? add(ring, parts) : undefined;
    }
    if (expr.operator === "Negate") {
      const inner = ops[0] === undefined ? undefined : toElement(ops[0], q);
      return inner === undefined ? undefined : scale(ring, inner, ce.number(-1));
    }
    if (expr.operator === "Multiply") {
      // Exactly one operand may be a Hecke element; the rest are coefficients.
      const elements = ops.map((op) => toElement(op, q));
      const carried = elements.filter((e) => e !== undefined);
      if (carried.length !== 1) return undefined;
      const index = elements.findIndex((e) => e !== undefined);
      const scalars = ops.filter((_, i) => i !== index);
      if (scalars.some((s) => basisPermutation(s, q) !== undefined)) return undefined;
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

  ce.declareType("hecke_algebra", "expression<HeckeAlgebra>", { mint: false });
  ce.declare("HeckeAlgebra", { signature: "(integer, number) -> hecke_algebra" });
  ce.declare("HeckeT", { signature: "(list<integer>, number) -> number" });

  declareAlgebra(ce, {
    type: "hecke_algebra",
    basis: (expr) => {
      const n = algebraSize(expr);
      const q = parameterOf(expr);
      if (n === undefined || q === undefined || n > 6) return undefined; // 720 basis elements is already plenty
      return ce.function(
        "List",
        permutations(n).map((w) =>
          ce.function("HeckeT", [
            ce.function(
              "List",
              w.map((v) => ce.number(v)),
            ),
            q,
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
      const q = parameterOf(expr);
      const read = q === undefined ? undefined : toElement(element, q);
      if (n === undefined || read === undefined) return undefined;
      const inside = [...read.values()].every((term) => term.w.length === n);
      return ce.symbol(inside ? "True" : "False");
    },
    product: (ops) => {
      const q = ops.map(parameterOf).find((found) => found !== undefined);
      if (q === undefined) return undefined;
      const parts = ops.map((op) => toElement(op, q));
      if (!parts.every((p): p is Element<BoxedExpression> => p !== undefined)) return undefined;
      if (!parts.every(sameSize)) return undefined;
      const sizes = new Set(parts.flatMap((p) => [...p.values()].map((t) => t.w.length)));
      if (sizes.size > 1) return undefined; // different algebras
      return toExpression(
        parts.reduce((a, b) => multiply(ringFor(q), a, b)),
        q,
      );
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
      const q = ops[0] === undefined ? undefined : parameterOf(ops[0]);
      const element = q === undefined || ops[0] === undefined ? undefined : toElement(ops[0], q);
      const value = ops[1];
      // Only a symbolic q can be replaced; a number is already a specialisation.
      const name = q === undefined ? undefined : symbolNameOf(q);
      if (name === undefined || element === undefined || value === undefined) return undefined;
      // Substitute, then keep only what survives — a coefficient that vanishes at this
      // q takes its basis element out of the element entirely.
      const substituted = new Map(
        [...element.entries()]
          .map(([key, term]) => {
            const coefficient = term.coefficient.subs({ [name]: value }).evaluate();
            return [key, { w: term.w, coefficient }] as const;
          })
          .filter(([, term]) => term.coefficient.is(0) !== true),
      );
      return toExpression(substituted, value);
    },
  });

  /** The identity element T_e, for writing products that start from one. */
  ce.declare("HeckeIdentity", {
    signature: "(integer, number) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = integerAt(ops[0]);
      const q = ops[1];
      if (n === undefined || n < 1 || q === undefined) return undefined;
      return toExpression(basisElement(ringFor(q), identityPermutation(n)), q);
    },
  });
}
