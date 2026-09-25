import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf } from "@enumeratio/boxed";
import {
  CLASS_ADMITS,
  composeDiagrams,
  diagram,
  type Diagram,
  diagramKey,
  type DiagramClass,
  enumerateDiagrams,
} from "./diagram.ts";
import {
  type AlgebraElement,
  basisElement,
  coarsenings,
  diagramToOrbit,
  element as algebraElement,
  orbitToDiagram,
  partitionMobius,
} from "./orbit.ts";
import { registerAlgebra } from "@enumeratio/algebra";
import { dimensionOf } from "./dimensions.ts";

// How diagrams reach compute-engine. Same seam as @enumeratio/hypercomplex: replace an
// operator's definition, keep a reference to the previous handler, and dispatch only
// when an operand is ours. Because each wrapper defers, the two packages compose — a
// `Basis` call falls through to whichever of them recognises the algebra, in either
// declaration order.

/** The loop parameter δ. A diagram algebra is defined over ℤ[δ], so it stays a symbol. */
const LOOP_PARAMETER = "delta";

/** Constructor head → the class of diagrams it admits. */
const CONSTRUCTORS: Record<string, DiagramClass> = {
  PartitionAlgebra: "partition",
  PlanarPartitionAlgebra: "planar-partition",
  BrauerAlgebra: "brauer",
  TemperleyLiebAlgebra: "temperley-lieb",
  MotzkinAlgebra: "motzkin",
  RookAlgebra: "rook",
  SymmetricGroupAlgebra: "symmetric",
};

/** Emitting a basis past this many diagrams is not useful; the dimension still is. */
const BASIS_LIMIT = 1024;

/** Read `PartitionAlgebra(n)` and friends. */
function algebraOf(expr: BoxedExpression): { cls: DiagramClass; strands: number } | undefined {
  const cls = CONSTRUCTORS[expr.operator];
  if (cls === undefined) return undefined;
  const strands = integerAt(operandsOf(expr)[0]);
  return strands !== undefined && strands >= 0 ? { cls, strands } : undefined;
}

/**
 * Read `Diagram([[1,-1],[2,-2]])`. Every point ±1…±n must appear exactly once, with n
 * the largest label used — a diagram is a partition of ALL 2n points, so a missing one
 * is a malformed diagram rather than an implicit singleton.
 */
function diagramOf(expr: BoxedExpression): Diagram | undefined {
  if (expr.operator !== "Diagram") return undefined;
  const listed = operandsOf(expr)[0];
  if (listed === undefined || listed.operator !== "List") return undefined;
  const blocks: number[][] = [];
  for (const block of operandsOf(listed)) {
    if (block.operator !== "List") return undefined;
    const labels: number[] = [];
    for (const label of operandsOf(block)) {
      const value = integerAt(label);
      if (value === undefined || value === 0) return undefined;
      labels.push(value);
    }
    blocks.push(labels);
  }
  const all = blocks.flat();
  const strands = Math.max(0, ...all.map(Math.abs));
  const seen = new Set(all);
  if (all.length !== seen.size || seen.size !== 2 * strands) return undefined;
  for (let k = 1; k <= strands; k++) if (!seen.has(k) || !seen.has(-k)) return undefined;
  return diagram(strands, blocks);
}

export function declareDiagrams(ce: ComputeEngine): void {
  const toExpression = (d: Diagram): BoxedExpression =>
    ce.function("Diagram", [
      ce.function(
        "List",
        d.blocks.map((block) =>
          ce.function(
            "List",
            block.map((label) => ce.number(label)),
          ),
        ),
      ),
    ]);

  /** The same blocks, spelt with the orbit head. */
  const orbitExpression = (d: Diagram): BoxedExpression =>
    ce.function("OrbitDiagram", operandsOf(toExpression(d)));

  // The carrier normalises itself. A diagram has one canonical spelling — blocks
  // sorted, and sorted among themselves — so that a hand-written diagram and a computed
  // one are the SAME expression. A malformed one is left exactly as written.
  ce.declare("Diagram", {
    signature: "(list) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const d = diagramOf(ce.function("Diagram", ops));
      return d === undefined ? undefined : toExpression(d);
    },
  });
  for (const head of Object.keys(CONSTRUCTORS)) {
    ce.declare(head, { signature: "(integer) -> value" });
  }

  /** a·b = δ^loops · (a∘b). */
  const product = (parts: readonly Diagram[]): BoxedExpression | undefined => {
    let current = parts[0];
    if (current === undefined) return undefined;
    let loops = 0;
    for (const next of parts.slice(1)) {
      if (next.strands !== current.strands) return undefined; // different algebras
      const composed = composeDiagrams(current, next);
      current = composed.result;
      loops += composed.loops;
    }
    const body = toExpression(current);
    return loops === 0
      ? body
      : ce.function("Multiply", [
          ce.function("Power", [ce.symbol(LOOP_PARAMETER), ce.number(loops)]),
          body,
        ]);
  };

  // Everything shared lives on the seam: Basis, AlgebraDimension, the ordered product
  // and Element are declared once by @enumeratio/algebra and dispatched over providers,
  // so this library and @enumeratio/hypercomplex can both answer for them.
  // ── the orbit basis ─────────────────────────────────────────────────────────

  /** The orbit basis element x_λ, carrying the same blocks as the diagram d_λ. */
  ce.declare("OrbitDiagram", {
    signature: "(list) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const d = diagramOf(ce.function("Diagram", ops));
      return d === undefined ? undefined : orbitExpression(d);
    },
  });

  /** Read a combination of diagrams or of orbit elements — not a mix of the two. */
  const readAlgebra = (
    expr: BoxedExpression,
  ): { head: "Diagram" | "OrbitDiagram"; element: AlgebraElement } | undefined => {
    if (expr.operator === "Diagram" || expr.operator === "OrbitDiagram") {
      const d = diagramOf(ce.function("Diagram", operandsOf(expr)));
      return d === undefined ? undefined : { head: expr.operator, element: basisElement(d) };
    }
    const ops = operandsOf(expr);
    if (expr.operator === "Negate" && ops.length === 1) {
      const inner = readAlgebra(ops[0] as BoxedExpression);
      if (inner === undefined) return undefined;
      return {
        head: inner.head,
        element: algebraElement(
          [...inner.element.values()].map((v) => [v.diagram, -v.coefficient] as const),
        ),
      };
    }
    if (expr.operator === "Add") {
      const parts = ops.map(readAlgebra);
      if (!parts.every((p): p is NonNullable<typeof p> => p !== undefined)) return undefined;
      const head = parts[0]?.head;
      if (head === undefined || parts.some((p) => p.head !== head)) return undefined;
      return {
        head,
        element: algebraElement(
          parts.flatMap((p) =>
            [...p.element.values()].map((v) => [v.diagram, v.coefficient] as const),
          ),
        ),
      };
    }
    if (expr.operator === "Multiply") {
      const parts = ops.map(readAlgebra);
      const carried = parts.filter((p) => p !== undefined);
      if (carried.length !== 1) return undefined;
      const index = parts.findIndex((p) => p !== undefined);
      const scalars = ops.filter((_, i) => i !== index).map(integerAt);
      if (!scalars.every((x): x is number => x !== undefined)) return undefined;
      const factor = scalars.reduce((a, b) => a * b, 1);
      const one = carried[0] as NonNullable<(typeof parts)[number]>;
      return {
        head: one.head,
        element: algebraElement(
          [...one.element.values()].map((v) => [v.diagram, v.coefficient * factor] as const),
        ),
      };
    }
    return undefined;
  };

  const writeAlgebra = (
    head: "Diagram" | "OrbitDiagram",
    value: AlgebraElement,
  ): BoxedExpression => {
    const terms = [...value.values()].sort((a, b) =>
      diagramKey(a.diagram) < diagramKey(b.diagram) ? -1 : 1,
    );
    if (terms.length === 0) return ce.number(0);
    const parts = terms.map(({ diagram: d, coefficient }) => {
      const b = head === "Diagram" ? toExpression(d) : orbitExpression(d);
      return coefficient === 1 ? b : ce.function("Multiply", [ce.number(coefficient), b]);
    });
    return parts.length === 1 ? (parts[0] as BoxedExpression) : ce.function("Add", parts);
  };

  /** Rewrite in the other basis, in either direction. */
  const rewrite = (head: string, into: "Diagram" | "OrbitDiagram"): void => {
    ce.declare(head, {
      signature: "(number) -> number",
      evaluate: (ops: readonly BoxedExpression[]) => {
        const read = ops[0] === undefined ? undefined : readAlgebra(ops[0]);
        if (read === undefined) return undefined;
        if (read.head === into) return writeAlgebra(into, read.element);
        const converted =
          into === "Diagram" ? orbitToDiagram(read.element) : diagramToOrbit(read.element);
        return writeAlgebra(into, converted);
      },
    });
  };
  rewrite("InDiagramBasis", "Diagram");
  rewrite("InOrbitBasis", "OrbitDiagram");

  /** The partition lattice's Möbius function on the interval between two diagrams. */
  ce.declare("PartitionMobius", {
    signature: "(number, number) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [finer, coarser] = [ops[0], ops[1]].map((op) =>
        op === undefined ? undefined : diagramOf(ce.function("Diagram", operandsOf(op))),
      );
      if (finer === undefined || coarser === undefined) return undefined;
      const value = partitionMobius(finer, coarser);
      return value === undefined ? undefined : ce.number(value);
    },
  });

  /** Every partition coarser than this one — Bell(k) of them, for k blocks. */
  ce.declare("DiagramCoarsenings", {
    signature: "(number) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const d =
        ops[0] === undefined ? undefined : diagramOf(ce.function("Diagram", operandsOf(ops[0])));
      return d === undefined ? undefined : ce.function("List", coarsenings(d).map(toExpression));
    },
  });

  registerAlgebra(ce, {
    name: "diagram",
    basis: (expr) => {
      const algebra = algebraOf(expr);
      if (algebra === undefined) return undefined;
      if (dimensionOf(algebra.cls, algebra.strands) > BASIS_LIMIT) return undefined;
      return ce.function("List", enumerateDiagrams(algebra.cls, algebra.strands).map(toExpression));
    },
    dimension: (expr) => {
      const algebra = algebraOf(expr);
      return algebra === undefined
        ? undefined
        : ce.number(dimensionOf(algebra.cls, algebra.strands));
    },
    product: (ops) => {
      const diagrams = ops.map(diagramOf);
      return diagrams.every((d): d is Diagram => d !== undefined) ? product(diagrams) : undefined;
    },
    // Containment is what makes the inclusions checkable — every Temperley–Lieb diagram
    // is a Brauer diagram, but not conversely.
    contains: (element, expr) => {
      const algebra = algebraOf(expr);
      const d = diagramOf(element);
      if (algebra === undefined || d === undefined) return undefined;
      const inside = d.strands === algebra.strands && CLASS_ADMITS[algebra.cls](d);
      return ce.symbol(inside ? "True" : "False");
    },
  });
}
