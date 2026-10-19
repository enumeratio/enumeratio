// AdditiveEnergy(A, B) and MultiplicativeEnergy(A, B): the number of quadruples
// (a₁, a₂, b₁, b₂) ∈ A×A×B×B with a₁ + b₁ = a₂ + b₂, resp. a₁·b₁ = a₂·b₂ (mathlib's
// `Finset.addEnergy` and `Finset.mulEnergy`). With r(x) the number of pairs (a, b) ∈ A×B
// whose sum (product) is x, a quadruple is two such pairs with the same value, so the
// energy is Σ r(x)²: |A||B| pairs to tally, not |A|²|B|² quadruples to test.
//
// The Epsil definition is the implementation. A collection is read as the set of its
// distinct members, as mathlib's `Finset` is.

import { bigRationalAt, operandsOf, type Engine, type Expr } from "@enumeratio/engine";
import { SUMMARIES } from "@enumeratio/manifest/package/combinatorics";
import { evaluateEpsil } from "@enumeratio/structures";

type MathJSON = unknown;

/** The `op` of every pair from `_a` and `_b` (as sets), in one flat list. */
const pairValues = (op: "Add" | "Multiply"): MathJSON => [
  "Flatten",
  ["Map", ["Function", ["Map", ["Function", [op, "x", "y"], "y"], ["Unique", "_b"]], "x"], ["Unique", "_a"]],
];

/** Σ r(x)²: Tally pairs each value with its count r(x), which the sum squares. */
const energy = (op: "Add" | "Multiply"): MathJSON => [
  "Sum",
  ["Map", ["Function", ["Multiply", "r", "r"], "r"], ["At", ["Tally", pairValues(op)], 2]],
];

export const ADDITIVE_ENERGY_EPSIL: MathJSON = energy("Add");
export const MULTIPLICATIVE_ENERGY_EPSIL: MathJSON = energy("Multiply");

/** The distinct members of a finite collection, as a list, if each is an exact rational: a
 *  float's sum would be tallied by rounding, not by value, and a symbol's sum by shape. */
const membersAsList = (ce: Engine, collection: Expr): Expr | undefined => {
  if (collection.isFiniteCollection !== true) return undefined;
  const list = ce.function("Unique", [collection]).evaluate();
  return list.operator === "List" && operandsOf(list).every((m) => bigRationalAt(m) !== undefined) ? list : undefined;
};

export function declareAdditiveEnergy(ce: Engine): void {
  const declare = (name: "AdditiveEnergy" | "MultiplicativeEnergy", definition: MathJSON): void => {
    ce.declare(name, {
      description: SUMMARIES[name],
      signature: "(collection, collection?) -> integer",
      evaluate: (ops: readonly Expr[]): Expr | undefined => {
        const [a, b = a] = ops;
        if (a === undefined || b === undefined) return undefined;
        const left = membersAsList(ce, a);
        const right = membersAsList(ce, b);
        if (left === undefined || right === undefined) return undefined;
        try {
          return ce.box(evaluateEpsil(ce, definition, { _a: left.json, _b: right.json }) as never);
        } catch {
          return undefined;
        }
      },
    });
  };
  declare("AdditiveEnergy", ADDITIVE_ENERGY_EPSIL);
  declare("MultiplicativeEnergy", MULTIPLICATIVE_ENERGY_EPSIL);
}
