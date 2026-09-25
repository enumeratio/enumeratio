import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type Algebra, algebraOf, type Multivector, toExpression, toMultivector } from "@enumeratio/hypercomplex";
import { gradePart, gradesOf } from "./blades.ts";
import { poincareDual, pseudoscalar, sandwich, vee } from "./dual.ts";
import {
  cliffordConjugate,
  gradeInvolution,
  leftContraction,
  reversion,
  rightContraction,
  scalarProduct,
  wedge,
} from "./products.ts";

// The heads. Every one of them is the same shape: read the operands as multivectors,
// do the blade arithmetic, render back. An operand that cannot be linearised over the
// blades leaves the whole expression UNEVALUATED rather than answered — the rule the
// rest of the repo follows, and the only safe one when the alternative is a plausible
// wrong sign.
//
// None of these names were taken: compute-engine has `Cross`, `Dot` and `Conjugate`,
// but `Wedge`, `Vee`, `Dual` and the rest are free. Note that the LATEX operators are
// not: `\wedge` parses to `And` and `\vee` to `Or`, so these are reached by name —
// `Wedge(a, b)`, not `a \wedge b`.
//
// Wolfram-wise, `Wedge` and `Vee` are genuine `System\`` symbols for these same outer and
// regressive products — see `HEADS` in `@enumeratio/wolfram`, which vouches for them. Every
// other name here (`Dual`, `Grade`, `GradePart`, `Pseudoscalar`, `Reversion`,
// `GradeInvolution`, `CliffordConjugate`, `LeftContraction`, `RightContraction`,
// `ScalarProduct`, `Sandwich`) is one we coined; Wolfram has no symbol by any of those
// spellings, so none of them belongs in `HEADS` or `FOREIGN` — they are ours alone.

/** Read one operand as a multivector, or give up on the whole call. */
const read = (ce: ComputeEngine, op: BoxedExpression | undefined): Multivector | undefined =>
  op === undefined ? undefined : toMultivector(ce, op);

/** Read every operand, or give up. */
function readAll(ce: ComputeEngine, ops: readonly BoxedExpression[]): Multivector[] | undefined {
  const parts = ops.map((op) => toMultivector(ce, op));
  return parts.every((m): m is Multivector => m !== undefined) ? parts : undefined;
}

/** The algebra an operand names, for the operations that need an ambient space. */
const readAlgebra = (op: BoxedExpression | undefined): Algebra | undefined =>
  op === undefined ? undefined : algebraOf(op);

/**
 * Declare the geometric-algebra heads on `ce`. Requires `declareHypercomplex` to have
 * run first — the generators and the geometric product come from there.
 *
 * - `Wedge(a, b, …)`, `Vee(a, b, algebra)` — the outer and regressive products.
 * - `LeftContraction(a, b)`, `RightContraction(a, b)`, `ScalarProduct(a, b)`.
 * - `Grade(x)`, `GradePart(x, k)` — the grade of a homogeneous element, and the
 *   projection everything else is written against.
 * - `Reversion(x)`, `GradeInvolution(x)`, `CliffordConjugate(x)` — the involutions.
 * - `Dual(x, algebra)`, `Pseudoscalar(algebra)` — the Poincare complement, and the top
 *   blade it is taken against.
 * - `Sandwich(a, b)` — `a b ā`, how a versor acts.
 */
export function declareGeometric(ce: ComputeEngine): void {
  const binary = (name: string, op: (ce: ComputeEngine, a: Multivector, b: Multivector) => Multivector): void => {
    ce.declare(name, {
      signature: "(number, number) -> number",
      commutative: false,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const parts = readAll(ce, ops);
        if (parts === undefined || parts.length !== 2) return undefined;
        return toExpression(ce, op(ce, parts[0]!, parts[1]!));
      },
    });
  };

  const involution = (name: string, op: (ce: ComputeEngine, mv: Multivector) => Multivector): void => {
    ce.declare(name, {
      signature: "(number) -> number",
      evaluate: (ops: readonly BoxedExpression[]) => {
        const mv = read(ce, ops[0]);
        return mv === undefined ? undefined : toExpression(ce, op(ce, mv));
      },
    });
  };

  // The wedge is associative, so it takes any number of operands and folds them —
  // `Wedge(a, b, c)` is the trivector, not a nested pair.
  ce.declare("Wedge", {
    signature: "(number+) -> number",
    associative: true,
    commutative: false,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const parts = readAll(ce, ops);
      if (parts === undefined || parts.length === 0) return undefined;
      return toExpression(
        ce,
        parts.reduce((a, b) => wedge(ce, a, b)),
      );
    },
  });

  binary("LeftContraction", leftContraction);
  binary("RightContraction", rightContraction);
  binary("ScalarProduct", scalarProduct);
  binary("Sandwich", sandwich);

  involution("Reversion", reversion);
  involution("GradeInvolution", gradeInvolution);
  involution("CliffordConjugate", cliffordConjugate);

  ce.declare("GradePart", {
    signature: "(number, integer) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const mv = read(ce, ops[0]);
      const grade = ops[1];
      if (mv === undefined || grade === undefined) return undefined;
      if (grade.im !== 0 || !Number.isInteger(grade.re)) return undefined;
      return toExpression(ce, gradePart(ce, mv, grade.re));
    },
  });

  // A multivector has A grade only when it is homogeneous; a rotor (scalar + bivector)
  // has two, and answering with either would be a lie. Zero is homogeneous of every
  // grade, so it has none to report and stays unevaluated with the rest.
  ce.declare("Grade", {
    signature: "(number) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const mv = read(ce, ops[0]);
      if (mv === undefined) return undefined;
      const grades = gradesOf(mv);
      return grades.length === 1 ? ce.number(grades[0]!) : undefined;
    },
  });

  ce.declare("Pseudoscalar", {
    signature: "(any) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const algebra = readAlgebra(ops[0]);
      return algebra === undefined ? undefined : toExpression(ce, pseudoscalar(ce, algebra.generators));
    },
  });

  ce.declare("Dual", {
    signature: "(number, any) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const mv = read(ce, ops[0]);
      const algebra = readAlgebra(ops[1]);
      if (mv === undefined || algebra === undefined) return undefined;
      const dual = poincareDual(ce, mv, algebra.generators);
      return dual === undefined ? undefined : toExpression(ce, dual);
    },
  });

  ce.declare("Vee", {
    signature: "(number, number, any) -> number",
    commutative: false,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const a = read(ce, ops[0]);
      const b = read(ce, ops[1]);
      const algebra = readAlgebra(ops[2]);
      if (a === undefined || b === undefined || algebra === undefined) return undefined;
      const met = vee(ce, a, b, algebra.generators);
      return met === undefined ? undefined : toExpression(ce, met);
    },
  });
}
