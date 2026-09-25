import { registerAlgebra } from "@enumeratio/algebra";
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf } from "@enumeratio/boxed";
import {
  completeToRibbon,
  conjugateComposition,
  fundamentalToMonomial,
  monomialToFundamental,
  ribbonToComplete,
} from "./bases.ts";
import {
  antipode,
  basis,
  type Composition,
  compositionKey,
  compositions,
  counit,
  degree,
  type Element,
  fromKey,
  type HopfAlgebra,
  nsym,
  qsym,
  splitTensorKey,
  type Tensor,
  tensorKey,
} from "./hopf.ts";

// Wiring NSym and QSym to compute-engine.
//
// The new surface is the COPRODUCT, which returns a sum of tensor pairs rather than an
// element. Tensor pairs get their own head, `HopfTensor(left, right)` — `CircleTimes` is
// already the shared ordered product, and overloading it for a genuine tensor pair would
// be a conflation.

/** Read a composition: a `List` of positive integers. */
function compositionOf(expr: BoxedExpression | undefined): Composition | undefined {
  if (expr === undefined || expr.operator !== "List") return undefined;
  const parts = operandsOf(expr).map(integerAt);
  if (!parts.every((p): p is number => p !== undefined && p >= 1)) return undefined;
  return parts;
}

/**
 * Which basis head belongs to which algebra, and how to get to and from the basis the
 * product and coproduct are actually written in.
 *
 * Everything downstream computes in the NATIVE basis — H for NSym, M for QSym — and the
 * head the caller used is carried along only to decide how to write the answer back. So
 * adding a basis is adding a row here, not a second copy of the algebra.
 */
interface BasisSpec {
  readonly algebra: HopfAlgebra;
  readonly toNative: (element: Element) => Element;
  readonly fromNative: (element: Element) => Element;
}
const same = (element: Element): Element => element;
const BASIS_HEADS: Record<string, BasisSpec> = {
  NSymH: { algebra: nsym, toNative: same, fromNative: same },
  NSymR: { algebra: nsym, toNative: ribbonToComplete, fromNative: completeToRibbon },
  QSymM: { algebra: qsym, toNative: same, fromNative: same },
  QSymF: { algebra: qsym, toNative: fundamentalToMonomial, fromNative: monomialToFundamental },
};
const ALGEBRA_HEADS: Record<string, { algebra: HopfAlgebra; basisHead: string }> = {
  NSymAlgebra: { algebra: nsym, basisHead: "NSymH" },
  QSymAlgebra: { algebra: qsym, basisHead: "QSymM" },
};

export function declareHopf(ce: ComputeEngine): void {
  for (const head of Object.keys(BASIS_HEADS)) {
    ce.declare(head, { signature: "(list<integer>) -> number" });
  }
  for (const head of Object.keys(ALGEBRA_HEADS)) {
    ce.declare(head, { signature: "(integer) -> value" });
  }
  ce.declare("HopfTensor", { signature: "(number, number) -> number" });

  const basisExpression = (head: string, a: Composition): BoxedExpression =>
    ce.function(head, [
      ce.function(
        "List",
        a.map((p) => ce.number(p)),
      ),
    ]);

  const toExpression = (head: string, element: Element): BoxedExpression => {
    const shown = (BASIS_HEADS[head] as BasisSpec).fromNative(element);
    const terms = [...shown].sort(([a], [b]) => a.localeCompare(b));
    if (terms.length === 0) return ce.number(0);
    const parts = terms.map(([key, coefficient]) => {
      const b = basisExpression(head, fromKey(key));
      return coefficient === 1 ? b : ce.function("Multiply", [ce.number(coefficient), b]);
    });
    return parts.length === 1 ? parts[0]! : ce.function("Add", parts);
  };

  /** Read an element of ONE of the algebras: which head it uses, and the combination. */
  const toElement = (
    expr: BoxedExpression,
  ): { head: string; algebra: HopfAlgebra; element: Element } | undefined => {
    const direct = BASIS_HEADS[expr.operator];
    if (direct !== undefined) {
      const a = compositionOf(operandsOf(expr)[0]);
      return a === undefined
        ? undefined
        : { head: expr.operator, algebra: direct.algebra, element: direct.toNative(basis(a)) };
    }
    const ops = operandsOf(expr);
    // Canonical form writes a −1 coefficient as `Negate`, and a difference as `Subtract`;
    // the signed basis expansions are full of both, so neither can be left unread.
    if (expr.operator === "Negate" && ops.length === 1) {
      const inner = toElement(ops[0] as BoxedExpression);
      if (inner === undefined) return undefined;
      const out = new Map<string, number>();
      for (const [key, c] of inner.element) out.set(key, -c);
      return { ...inner, element: out };
    }
    if (expr.operator === "Subtract" && ops.length === 2) {
      const left = toElement(ops[0] as BoxedExpression);
      const right = toElement(ops[1] as BoxedExpression);
      if (left === undefined || right === undefined || left.head !== right.head) return undefined;
      const out = new Map<string, number>(left.element);
      for (const [key, c] of right.element) {
        const total = (out.get(key) ?? 0) - c;
        if (total === 0) out.delete(key);
        else out.set(key, total);
      }
      return { ...left, element: out };
    }
    if (expr.operator === "Add" || expr.operator === "Multiply") {
      const read = ops.map(toElement);
      const carried = read.filter((r) => r !== undefined);
      if (carried.length === 0) return undefined;
      const head = carried[0]!.head;
      if (carried.some((r) => r.head !== head)) return undefined; // mixing algebras
      const algebra = carried[0]!.algebra;
      if (expr.operator === "Add") {
        if (carried.length !== read.length) return undefined;
        const out = new Map<string, number>();
        for (const part of carried) {
          for (const [key, c] of part.element) out.set(key, (out.get(key) ?? 0) + c);
        }
        return { head, algebra, element: out };
      }
      // A Multiply: exactly one basis factor, the rest integer coefficients.
      if (carried.length !== 1) return undefined;
      const index = read.findIndex((r) => r !== undefined);
      const scalars = ops.filter((_, i) => i !== index).map(integerAt);
      if (!scalars.every((s): s is number => s !== undefined)) return undefined;
      const factor = scalars.reduce((a, b) => a * b, 1);
      const out = new Map<string, number>();
      for (const [key, c] of carried[0]!.element) {
        if (c * factor !== 0) out.set(key, c * factor);
      }
      return { head, algebra, element: out };
    }
    return undefined;
  };

  /** Change of basis on a tensor: apply the map to each leg and expand. */
  const inBasis = (tensor: Tensor, map: (element: Element) => Element): Tensor => {
    const out = new Map<string, number>();
    for (const [key, coefficient] of tensor) {
      const [left, right] = splitTensorKey(key);
      for (const [leftKey, leftCoefficient] of map(basis(left))) {
        for (const [rightKey, rightCoefficient] of map(basis(right))) {
          const target = tensorKey(fromKey(leftKey), fromKey(rightKey));
          const total = (out.get(target) ?? 0) + coefficient * leftCoefficient * rightCoefficient;
          if (total === 0) out.delete(target);
          else out.set(target, total);
        }
      }
    }
    return out;
  };

  /** Rewrite an element in another basis of the same algebra. */
  const conversion = (head: string, target: string): void => {
    ce.declare(head, {
      signature: "(number) -> number",
      evaluate: (ops: readonly BoxedExpression[]) => {
        const read = ops[0] === undefined ? undefined : toElement(ops[0]);
        if (read === undefined) return undefined;
        const spec = BASIS_HEADS[target] as BasisSpec;
        if (read.algebra !== spec.algebra) return undefined; // wrong algebra entirely
        return toExpression(target, read.element);
      },
    });
  };
  conversion("InRibbonBasis", "NSymR");
  conversion("InCompleteBasis", "NSymH");
  conversion("InFundamentalBasis", "QSymF");
  conversion("InMonomialBasis", "QSymM");

  /** The conjugate composition — the transpose of the ribbon's skew shape. */
  ce.declare("ConjugateComposition", {
    signature: "(list<integer>) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const a = compositionOf(ops[0]);
      if (a === undefined) return undefined;
      return ce.function(
        "List",
        conjugateComposition(a).map((p) => ce.number(p)),
      );
    },
  });

  ce.declare("Coproduct", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const read = ops[0] === undefined ? undefined : toElement(ops[0]);
      if (read === undefined) return undefined;
      const spec = BASIS_HEADS[read.head] as BasisSpec;
      const terms = [...inBasis(read.algebra.coproduct(read.element), spec.fromNative)].sort(
        ([a], [b]) => a.localeCompare(b),
      );
      if (terms.length === 0) return ce.number(0);
      const parts = terms.map(([key, coefficient]) => {
        const [left, right] = splitTensorKey(key);
        const pair = ce.function("HopfTensor", [
          basisExpression(read.head, left),
          basisExpression(read.head, right),
        ]);
        return coefficient === 1 ? pair : ce.function("Multiply", [ce.number(coefficient), pair]);
      });
      return parts.length === 1 ? parts[0]! : ce.function("Add", parts);
    },
  });

  ce.declare("Antipode", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const read = ops[0] === undefined ? undefined : toElement(ops[0]);
      return read === undefined
        ? undefined
        : toExpression(read.head, antipode(read.algebra, read.element));
    },
  });

  ce.declare("Counit", {
    signature: "(number) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const read = ops[0] === undefined ? undefined : toElement(ops[0]);
      return read === undefined ? undefined : ce.number(counit(read.element));
    },
  });

  ce.declare("HopfDegree", {
    signature: "(number) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const read = ops[0] === undefined ? undefined : toElement(ops[0]);
      if (read === undefined) return undefined;
      const degrees = new Set([...read.element.keys()].map((k) => degree(fromKey(k))));
      // A sum of mixed degrees is not homogeneous, so it has no degree.
      return degrees.size === 1 ? ce.number([...degrees][0]!) : undefined;
    },
  });

  registerAlgebra(ce, {
    name: "hopf",
    basis: (expr) => {
      const spec = ALGEBRA_HEADS[expr.operator];
      const n = integerAt(operandsOf(expr)[0]);
      if (spec === undefined || n === undefined || n < 0 || n > 12) return undefined;
      return ce.function(
        "List",
        compositions(n).map((a) => basisExpression(spec.basisHead, a)),
      );
    },
    dimension: (expr) => {
      const spec = ALGEBRA_HEADS[expr.operator];
      const n = integerAt(operandsOf(expr)[0]);
      if (spec === undefined || n === undefined || n < 0) return undefined;
      // The graded piece of degree n has one basis element per composition of n.
      return ce.number(n === 0 ? 1 : 2 ** (n - 1));
    },
    contains: (element, expr) => {
      const spec = ALGEBRA_HEADS[expr.operator];
      const n = integerAt(operandsOf(expr)[0]);
      const read = toElement(element);
      if (spec === undefined || n === undefined || read === undefined) return undefined;
      const readBasis = BASIS_HEADS[read.head] as BasisSpec;
      const wanted = BASIS_HEADS[spec.basisHead] as BasisSpec;
      if (readBasis.algebra !== wanted.algebra) return ce.symbol("False");
      const inside = [...read.element.keys()].every((k) => degree(fromKey(k)) === n);
      return ce.symbol(inside ? "True" : "False");
    },
    product: (ops) => {
      const read = ops.map(toElement);
      if (!read.every((r): r is NonNullable<typeof r> => r !== undefined)) return undefined;
      const head = read[0]!.head;
      if (read.some((r) => r.head !== head)) return undefined;
      const algebra = read[0]!.algebra;
      return toExpression(
        head,
        read.map((r) => r.element).reduce((a, b) => algebra.product(a, b)),
      );
    },
  });

  // A basis element's own key, for readable comparisons in tests and docs.
  void compositionKey;
}
