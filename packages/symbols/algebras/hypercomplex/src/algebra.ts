import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";
import { registerAlgebra } from "@enumeratio/algebra";
import { containsGenerator, generatorsOf, multiplyMultivectors, toExpression, toMultivector } from "./multivector.ts";
import { FAMILIES, type Generator, generatorSymbol } from "./units.ts";

// Naming a whole algebra, the way Wolfram's `CliffordAlgebra` does.
//
// An algebra here is nothing but an ORDERED LIST OF GENERATORS — the families already
// carry the squares and the commutation rules, so a name is just a way to say "these
// generators" and get its basis, dimension and signature back. That is enough to probe
// an algebra's properties and to build its elements from a tuple of scalars, which is
// what a constructor is actually for.

/** A named algebra: its generators, in canonical order. */
export interface Algebra {
  readonly generators: readonly Generator[];
  readonly label: string;
}

const familyByPrefix = (prefix: string) => FAMILIES.find((f) => f.prefix === prefix)!;

/** `count` generators of one family, indexed from 1. */
const run = (prefix: string, count: number): Generator[] =>
  Array.from({ length: count }, (_, k) => ({ family: familyByPrefix(prefix), index: k + 1 }));

/** Constructors taking a single generator count. */
const SINGLE_FAMILY: Record<string, { prefix: string; label: (n: number) => string }> = {
  MulticomplexAlgebra: { prefix: "i", label: (n) => `ℂ_${n}` },
  SplitAlgebra: { prefix: "j", label: (n) => `split ℝ[j_1..j_${n}]` },
  DualAlgebra: { prefix: "epsilon", label: (n) => `dual ℝ[ε_1..ε_${n}]` },
  GrassmannAlgebra: { prefix: "theta", label: (n) => `Λ(ℝ^${n})` },
};

/**
 * Named algebras — the ones with their own names in the literature, so they can be
 * written that way. Each is just a constructor applied to a fixed size. `\mathbb{H}`
 * parses to `H_doublestruck`, so alias that onto ℍ and `z ∈ ℍ` works as written.
 */
const NAMED: Record<string, { prefix: string; size: number; label: string }> = {
  Quaternions: { prefix: "f", size: 2, label: "ℍ" },
  H_doublestruck: { prefix: "f", size: 2, label: "ℍ" },
  BicomplexNumbers: { prefix: "i", size: 2, label: "ℂ_2" },
  TricomplexNumbers: { prefix: "i", size: 3, label: "ℂ_3" },
  SplitComplexNumbers: { prefix: "j", size: 1, label: "split-complex ℝ[j]" },
  DualNumbers: { prefix: "epsilon", size: 1, label: "dual ℝ[ε]" },
};

/** Every named-algebra symbol, for the docs and for declaring them. */
export const NAMED_ALGEBRAS: readonly string[] = Object.keys(NAMED);

/** A non-negative integer operand, or undefined. */
const count = (expr: BoxedExpression | undefined): number | undefined =>
  expr !== undefined && expr.im === 0 && Number.isInteger(expr.re) && expr.re >= 0 ? expr.re : undefined;

/**
 * Read an expression as an algebra:
 * - `CliffordAlgebra(p, q, r)` — p anticommuting generators squaring to +1 (`e_k`), q
 *   squaring to −1 (`f_k`) and r DEGENERATE ones squaring to 0 (`theta_k`); `q` and `r`
 *   default to 0, so `CliffordAlgebra(n)` is Cl(n,0). The degenerate generators are what
 *   projective geometric algebra is built on — Cl(2,0,1) and Cl(3,0,1) are 2-D and 3-D
 *   PGA — and they are the anticommuting nilpotent family, which already exists; only
 *   the constructor was missing an argument.
 * - a named algebra: `Quaternions` / `\mathbb{H}` (which IS Cl(0,2), ⟨f_1, f_2⟩ with
 *   k = f_1f_2), `BicomplexNumbers`, `TricomplexNumbers`, `SplitComplexNumbers`,
 *   `DualNumbers`.
 * - `MulticomplexAlgebra(n)` / `SplitAlgebra(n)` / `DualAlgebra(n)` / `GrassmannAlgebra(n)`.
 */
export function algebraOf(expr: BoxedExpression): Algebra | undefined {
  const name = symbolNameOf(expr);
  const named = name === undefined ? undefined : NAMED[name];
  if (named !== undefined) {
    return { generators: run(named.prefix, named.size), label: named.label };
  }
  const ops = operandsOf(expr);
  if (expr.operator === "CliffordAlgebra") {
    const p = count(ops[0]);
    const q = ops.length > 1 ? count(ops[1]) : 0;
    const r = ops.length > 2 ? count(ops[2]) : 0;
    if (p === undefined || q === undefined || r === undefined) return undefined;
    // A trailing zero is not worth printing: Cl(2,0,0) is how anyone writes Cl(2,0).
    const label = r === 0 ? `Cl(${p},${q})` : `Cl(${p},${q},${r})`;
    return { generators: [...run("e", p), ...run("f", q), ...run("theta", r)], label };
  }
  const single = SINGLE_FAMILY[expr.operator];
  if (single !== undefined) {
    const n = count(ops[0]);
    return n === undefined ? undefined : { generators: run(single.prefix, n), label: single.label(n) };
  }
  return undefined;
}

/**
 * The 2ⁿ basis blades, ordered by grade then by generator order — so Cl(0,2) comes back
 * as (1, f_1, f_2, f_1f_2), which is (1, i, j, k) for the quaternions.
 */
export function basisBlades(algebra: Algebra): Generator[][] {
  const blades: Generator[][] = [];
  const n = algebra.generators.length;
  for (let mask = 0; mask < 2 ** n; mask++) {
    blades.push(algebra.generators.filter((_, k) => (mask >> k) & 1));
  }
  const order = (blade: readonly Generator[]) => blade.map((g) => algebra.generators.indexOf(g)).join(",");
  return blades.sort((a, b) => a.length - b.length || order(a).localeCompare(order(b)));
}

/** The heads a coefficient may be built from — anything else belongs to another library. */
const ARITHMETIC = new Set([
  "Add",
  "Subtract",
  "Multiply",
  "Divide",
  "Negate",
  "Power",
  "Rational",
  "Complex",
  "Conjugate",
  "OverBar",
]);

/** Whether an expression is a hypercomplex element or an ordinary scalar. */
function isScalarLike(expr: BoxedExpression): boolean {
  if (containsGenerator(expr)) return true;
  if (symbolNameOf(expr) !== undefined) return true;
  if (Number.isFinite(expr.re) && Number.isFinite(expr.im)) return true;
  return ARITHMETIC.has(expr.operator) && operandsOf(expr).every(isScalarLike);
}

/** Declare the algebra constructors and register this library on the shared seam. */
export function declareAlgebras(ce: ComputeEngine): void {
  const blade = (generators: readonly Generator[]): BoxedExpression => {
    const units = generators.map((g) => ce.symbol(generatorSymbol(g)));
    if (units.length === 0) return ce.number(1);
    return units.length === 1 ? units[0]! : ce.function("Multiply", units);
  };

  // The constructors themselves stay inert: an algebra is a NAME, and evaluating it to
  // its own basis would conflate the algebra with the list of its blades.
  for (const head of Object.keys(SINGLE_FAMILY)) {
    ce.declare(head, { signature: "(integer, integer?) -> value" });
  }
  // Clifford takes the third, degenerate count as well: Cl(p, q, r).
  ce.declare("CliffordAlgebra", { signature: "(integer, integer?, integer?) -> value" });

  /** Whether every generator occurring in `expr` belongs to `algebra`. */
  const containsIn = (algebra: Algebra, expr: BoxedExpression): boolean | undefined => {
    const mv = toMultivector(ce, expr);
    if (mv === undefined) return undefined; // cannot read it — no opinion
    const occurring = generatorsOf(mv);
    // A free symbol reads as a scalar, which would make `x ∈ ℍ` come back true; only
    // answer for something that actually carries a unit, or a plain number.
    const isConcreteNumber = Number.isFinite(expr.re) && Number.isFinite(expr.im);
    if (occurring.length === 0) return isConcreteNumber ? true : undefined;
    return occurring.every((g) =>
      algebra.generators.some((h) => h.family.rank === g.family.rank && h.index === g.index),
    );
  };

  // Basis, AlgebraDimension, AlgebraSignature, the ordered product and Element are
  // declared once by @enumeratio/algebra and dispatched over registered providers —
  // compute-engine refuses a second `ce.declare` of the same extension head, so two
  // algebra libraries on one engine have to share the heads rather than each claim them.
  registerAlgebra(ce, {
    name: "hypercomplex",
    basis: (expr) => {
      const algebra = algebraOf(expr);
      return algebra === undefined ? undefined : ce.function("List", basisBlades(algebra).map(blade));
    },
    dimension: (expr) => {
      const algebra = algebraOf(expr);
      return algebra === undefined ? undefined : ce.number(2 ** algebra.generators.length);
    },
    // The signature VECTOR — each generator's square, in order.
    signature: (expr) => {
      const algebra = algebraOf(expr);
      return algebra === undefined
        ? undefined
        : ce.function(
            "List",
            algebra.generators.map((g) => ce.number(g.family.square)),
          );
    },
    contains: (element, expr) => {
      const algebra = algebraOf(expr);
      if (algebra === undefined) return undefined;
      const verdict = containsIn(algebra, element);
      return verdict === undefined ? undefined : ce.symbol(verdict ? "True" : "False");
    },
    product: (ops) => {
      // Decline anything that is not ours. `toMultivector` reads ANY generator-free
      // expression as a scalar coefficient, which is right inside a multivector and
      // wrong at the seam: without this guard a product of two `Diagram`s would be
      // claimed here and multiplied as if the diagrams were opaque numbers.
      if (!ops.every(isScalarLike)) return undefined;
      const parts = ops.map((op) => toMultivector(ce, op));
      if (!parts.every((p): p is NonNullable<typeof p> => p !== undefined)) return undefined;
      if (parts.length === 0) return ce.number(1);
      return toExpression(
        ce,
        parts.reduce((a, b) => multiplyMultivectors(ce, a, b)),
      );
    },
  });
}
