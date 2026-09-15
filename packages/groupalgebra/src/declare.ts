import { registerAlgebra } from "@enumeratio/algebra";
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, stringAt } from "@enumeratio/boxed";
import {
  basisElement,
  classSum,
  conjugacyClasses,
  cyclicGroup,
  dihedralGroup,
  directProduct,
  type Element,
  type Group,
  isAbelian,
  isCentral,
  multiplyElements,
  order,
} from "./group.ts";

// Wiring k[G] to compute-engine.
//
// Group elements are named by their LABEL (a string), so `GroupBasis("s0")` is the
// reflection s in a dihedral group. A basis element does not know which group it belongs
// to, so — as with quiver paths — the product takes the group as an argument.
//
// The heads worth having are not really about the product, which is just the group's own
// table. They are about the centre: `ConjugacyClasses`, `ClassSum`, and the fact that a
// class sum commutes with everything.

/**
 * The string an expression carries — which takes more care than it should.
 *
 * `ce.string("s0")` exposes `.string`, but the MathJSON form `["String", "s0"]` does not:
 * it boxes as a String FUNCTION, and canonicalises to a literal whose `.json` is
 * `'"s0"'` — single quotes for the literal, and INNER DOUBLE QUOTES that compute-engine
 * adds for a non-numeric string. `["String", "2"]` meanwhile becomes plain `'2'`. So a
 * naive reader works on numeric labels and silently fails on every other one, which is
 * exactly the bug this replaced: dihedral products quietly stayed symbolic while cyclic
 * ones worked. Strip both layers.
 */

/** Read `CyclicGroup(n)`, `DihedralGroup(n)` or `GroupDirectProduct(g, h)`. */
function groupOf(expr: BoxedExpression): Group | undefined {
  const ops = operandsOf(expr);
  if (expr.operator === "CyclicGroup") {
    const n = integerAt(ops[0]);
    return n === undefined ? undefined : cyclicGroup(n);
  }
  if (expr.operator === "DihedralGroup") {
    const n = integerAt(ops[0]);
    return n === undefined ? undefined : dihedralGroup(n);
  }
  if (expr.operator === "GroupDirectProduct") {
    const left = ops[0] === undefined ? undefined : groupOf(ops[0]);
    const right = ops[1] === undefined ? undefined : groupOf(ops[1]);
    return left === undefined || right === undefined ? undefined : directProduct(left, right);
  }
  return undefined;
}

/** `GroupAlgebra(group)` → its group. */
const algebraOf = (expr: BoxedExpression): Group | undefined =>
  expr.operator === "GroupAlgebra"
    ? (() => {
        const inner = operandsOf(expr)[0];
        return inner === undefined ? undefined : groupOf(inner);
      })()
    : undefined;

export function declareGroupAlgebra(ce: ComputeEngine): void {
  ce.declare("CyclicGroup", { signature: "(integer) -> value" });
  ce.declare("DihedralGroup", { signature: "(integer) -> value" });
  ce.declare("GroupDirectProduct", { signature: "(value, value) -> value" });
  ce.declare("GroupAlgebra", { signature: "(value) -> value" });
  ce.declare("GroupBasis", { signature: "(string) -> number" });

  const basisExpression = (g: Group, i: number): BoxedExpression =>
    ce.function("GroupBasis", [ce.string(g.elements[i]!)]);

  const toExpression = (g: Group, element: Element): BoxedExpression => {
    const terms = [...element].sort(([a], [b]) => a - b);
    if (terms.length === 0) return ce.number(0);
    const parts = terms.map(([index, coefficient]) => {
      const b = basisExpression(g, index);
      return coefficient === 1 ? b : ce.function("Multiply", [ce.number(coefficient), b]);
    });
    return parts.length === 1 ? parts[0]! : ce.function("Add", parts);
  };

  /** Read an element of k[G]: a basis element, a scalar multiple, or a sum of those. */
  const toElement = (g: Group, expr: BoxedExpression): Element | undefined => {
    if (expr.operator === "GroupBasis") {
      const label = stringAt(operandsOf(expr)[0]);
      if (label === undefined) return undefined;
      const index = g.elements.indexOf(label);
      return index < 0 ? undefined : basisElement(index);
    }
    const ops = operandsOf(expr);
    if (expr.operator === "Add") {
      const parts = ops.map((op) => toElement(g, op));
      if (!parts.every((p): p is Element => p !== undefined)) return undefined;
      const out = new Map<number, number>();
      for (const part of parts) {
        for (const [i, c] of part) out.set(i, (out.get(i) ?? 0) + c);
      }
      return out;
    }
    if (expr.operator === "Multiply") {
      const read = ops.map((op) => toElement(g, op));
      const carried = read.filter((r) => r !== undefined);
      if (carried.length !== 1) return undefined;
      const index = read.findIndex((r) => r !== undefined);
      const scalars = ops.filter((_, i) => i !== index).map(integerAt);
      if (!scalars.every((s): s is number => s !== undefined)) return undefined;
      const factor = scalars.reduce((a, b) => a * b, 1);
      const out = new Map<number, number>();
      for (const [i, c] of carried[0]!) if (c * factor !== 0) out.set(i, c * factor);
      return out;
    }
    return undefined;
  };

  /** A head taking a group and returning a plain value. */
  const aboutGroup = (
    head: string,
    signature: string,
    answer: (g: Group) => BoxedExpression | undefined,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const g = ops[0] === undefined ? undefined : groupOf(ops[0]);
        return g === undefined ? undefined : answer(g);
      },
    });
  };

  aboutGroup("GroupOrder", "(value) -> integer", (g) => ce.number(order(g)));
  aboutGroup("GroupIsAbelian", "(value) -> boolean", (g) =>
    ce.symbol(isAbelian(g) ? "True" : "False"),
  );
  aboutGroup("GroupElements", "(value) -> list", (g) =>
    ce.function(
      "List",
      g.elements.map((_, i) => basisExpression(g, i)),
    ),
  );
  aboutGroup("ConjugacyClasses", "(value) -> list", (g) =>
    ce.function(
      "List",
      conjugacyClasses(g).map((members) =>
        ce.function(
          "List",
          members.map((i) => basisExpression(g, i)),
        ),
      ),
    ),
  );
  // The dimension of the centre — and the number of irreducible characters of G.
  aboutGroup("GroupCentreDimension", "(value) -> integer", (g) =>
    ce.number(conjugacyClasses(g).length),
  );

  /** The k-th class sum: a basis element of the centre of k[G]. */
  ce.declare("ClassSum", {
    signature: "(value, integer) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const g = ops[0] === undefined ? undefined : groupOf(ops[0]);
      const k = integerAt(ops[1]);
      if (g === undefined || k === undefined) return undefined;
      const classes = conjugacyClasses(g);
      const members = classes[k - 1]; // 1-indexed, as elsewhere in the catalogue
      return members === undefined ? undefined : toExpression(g, classSum(members));
    },
  });

  /** Whether an element lies in the centre. */
  ce.declare("IsCentral", {
    signature: "(value, number) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const g = ops[0] === undefined ? undefined : groupOf(ops[0]);
      const element = g === undefined || ops[1] === undefined ? undefined : toElement(g, ops[1]);
      if (g === undefined || element === undefined) return undefined;
      return ce.symbol(isCentral(g, element) ? "True" : "False");
    },
  });

  /** The product of k[G] — it takes the group, since a basis element does not carry it. */
  ce.declare("GroupProduct", {
    signature: "(value, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const g = ops[0] === undefined ? undefined : groupOf(ops[0]);
      if (g === undefined) return undefined;
      const a = ops[1] === undefined ? undefined : toElement(g, ops[1]);
      const b = ops[2] === undefined ? undefined : toElement(g, ops[2]);
      if (a === undefined || b === undefined) return undefined;
      return toExpression(g, multiplyElements(g, a, b));
    },
  });

  registerAlgebra(ce, {
    name: "groupalgebra",
    basis: (expr) => {
      const g = algebraOf(expr);
      if (g === undefined || order(g) > 512) return undefined;
      return ce.function(
        "List",
        g.elements.map((_, i) => basisExpression(g, i)),
      );
    },
    dimension: (expr) => {
      const g = algebraOf(expr);
      return g === undefined ? undefined : ce.number(order(g));
    },
    contains: (element, expr) => {
      const g = algebraOf(expr);
      if (g === undefined) return undefined;
      const read = toElement(g, element);
      return ce.symbol(read === undefined ? "False" : "True");
    },
  });
}
