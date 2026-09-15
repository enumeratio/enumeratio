import { registerAlgebra } from "@enumeratio/algebra";
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf } from "@enumeratio/boxed";
import {
  booleanLattice,
  chain,
  divisorLattice,
  incidenceDimension,
  intervals,
  maskMembers,
  moebius,
  moebiusInvert,
  type Poset,
  sumDown,
  zeta,
} from "./poset.ts";

// Wiring the incidence algebra to compute-engine.
//
// The basis is the set of INTERVALS, and the product is composition: [x,y]·[y,z] = [x,z],
// and zero when the endpoints do not meet. That makes this the first family here whose
// product is usually zero — an honest annihilation rather than a refusal to answer, so
// it returns 0 rather than staying symbolic.
//
// Element labels are strings internally; each poset says how to render them as a
// compute-engine value, so the divisor lattice reads as integers and the Boolean lattice
// as subsets.

/** A poset, plus how to show and read its elements. */
interface Presented {
  readonly poset: Poset;
  /** The label as a compute-engine value. */
  show(ce: ComputeEngine, label: string): BoxedExpression;
  /** Which element index an expression names, if any. */
  read(expr: BoxedExpression): number | undefined;
}

const numeric = (poset: Poset): Presented => ({
  poset,
  show: (ce, label) => ce.number(Number(label)),
  read: (expr) => {
    const value = integerAt(expr);
    return value === undefined ? undefined : poset.elements.indexOf(String(value));
  },
});

const subsets = (poset: Poset): Presented => ({
  poset,
  show: (ce, label) =>
    ce.function(
      "List",
      maskMembers(Number(label)).map((m) => ce.number(m)),
    ),
  read: (expr) => {
    if (expr.operator !== "List") return undefined;
    const members = operandsOf(expr).map(integerAt);
    if (!members.every((m): m is number => m !== undefined && m >= 1)) return undefined;
    const mask = members.reduce((acc, m) => acc | (1 << (m - 1)), 0);
    return poset.elements.indexOf(String(mask));
  },
});

/** Read `Chain(n)` / `BooleanLattice(n)` / `DivisorLattice(n)`. */
function presentedPoset(expr: BoxedExpression): Presented | undefined {
  const n = integerAt(operandsOf(expr)[0]);
  if (n === undefined) return undefined;
  switch (expr.operator) {
    case "Chain": {
      const poset = chain(n);
      return poset === undefined ? undefined : numeric(poset);
    }
    case "DivisorLattice": {
      const poset = divisorLattice(n);
      return poset === undefined ? undefined : numeric(poset);
    }
    case "BooleanLattice": {
      const poset = booleanLattice(n);
      return poset === undefined ? undefined : subsets(poset);
    }
    default:
      return undefined;
  }
}

/** `IncidenceAlgebra(poset)` → the poset it is built on. */
const incidenceOf = (expr: BoxedExpression): Presented | undefined =>
  expr.operator === "IncidenceAlgebra"
    ? (() => {
        const inner = operandsOf(expr)[0];
        return inner === undefined ? undefined : presentedPoset(inner);
      })()
    : undefined;

export function declareIncidence(ce: ComputeEngine): void {
  for (const head of ["Chain", "BooleanLattice", "DivisorLattice"]) {
    ce.declare(head, { signature: "(integer) -> value" });
  }
  ce.declare("IncidenceAlgebra", { signature: "(value) -> value" });
  ce.declare("PosetInterval", { signature: "(any, any) -> number" });

  const interval = (present: Presented, from: number, to: number): BoxedExpression =>
    ce.function("PosetInterval", [
      present.show(ce, present.poset.elements[from]!),
      present.show(ce, present.poset.elements[to]!),
    ]);

  ce.declare("PosetElements", {
    signature: "(value) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const present = ops[0] === undefined ? undefined : presentedPoset(ops[0]);
      if (present === undefined) return undefined;
      return ce.function(
        "List",
        present.poset.elements.map((label) => present.show(ce, label)),
      );
    },
  });

  /** A two-argument function on a poset: read the poset and both endpoints. */
  const pointwise = (head: string, f: (poset: Poset, i: number, j: number) => number): void => {
    ce.declare(head, {
      signature: "(value, any, any) -> integer",
      evaluate: (ops: readonly BoxedExpression[]) => {
        const present = ops[0] === undefined ? undefined : presentedPoset(ops[0]);
        if (present === undefined || ops[1] === undefined || ops[2] === undefined) return undefined;
        const from = present.read(ops[1]);
        const to = present.read(ops[2]);
        if (from === undefined || to === undefined || from < 0 || to < 0) return undefined;
        return ce.number(f(present.poset, from, to));
      },
    });
  };

  // μ — the inverse of ζ in this algebra, and the whole reason to build it.
  pointwise("MoebiusFunction", moebius);
  pointwise("PosetZeta", zeta);

  /** Möbius inversion, as a head: undo a sum-down over the order. */
  ce.declare("MoebiusInvert", {
    signature: "(value, list<number>) -> list<number>",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const present = ops[0] === undefined ? undefined : presentedPoset(ops[0]);
      const listed = ops[1];
      if (present === undefined || listed === undefined || listed.operator !== "List") {
        return undefined;
      }
      const values = operandsOf(listed).map((v) => v.re);
      if (!values.every((v) => Number.isFinite(v))) return undefined;
      if (values.length !== present.poset.elements.length) return undefined;
      return ce.function(
        "List",
        moebiusInvert(present.poset, values).map((v) => ce.number(v)),
      );
    },
  });

  /** The map Möbius inversion undoes: g(y) = Σ_{x ≤ y} f(x). */
  ce.declare("PosetSumDown", {
    signature: "(value, list<number>) -> list<number>",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const present = ops[0] === undefined ? undefined : presentedPoset(ops[0]);
      const listed = ops[1];
      if (present === undefined || listed === undefined || listed.operator !== "List") {
        return undefined;
      }
      const values = operandsOf(listed).map((v) => v.re);
      if (!values.every((v) => Number.isFinite(v))) return undefined;
      if (values.length !== present.poset.elements.length) return undefined;
      return ce.function(
        "List",
        sumDown(present.poset, values).map((v) => ce.number(v)),
      );
    },
  });

  registerAlgebra(ce, {
    name: "incidence",
    basis: (expr) => {
      const present = incidenceOf(expr);
      if (present === undefined) return undefined;
      const all = intervals(present.poset);
      if (all.length > 512) return undefined;
      return ce.function(
        "List",
        all.map(({ from, to }) => interval(present, from, to)),
      );
    },
    dimension: (expr) => {
      const present = incidenceOf(expr);
      return present === undefined ? undefined : ce.number(incidenceDimension(present.poset));
    },
    contains: (element, expr) => {
      const present = incidenceOf(expr);
      if (present === undefined || element.operator !== "PosetInterval") return undefined;
      const ends = operandsOf(element);
      const from = ends[0] === undefined ? undefined : present.read(ends[0]);
      const to = ends[1] === undefined ? undefined : present.read(ends[1]);
      const inside =
        from !== undefined &&
        to !== undefined &&
        from >= 0 &&
        to >= 0 &&
        present.poset.leq(from, to);
      return ce.symbol(inside ? "True" : "False");
    },
  });
}
