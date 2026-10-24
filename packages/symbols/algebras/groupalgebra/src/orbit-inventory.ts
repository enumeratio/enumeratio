// OrbitInventory(ci, {x1, x2, …}, weights): Pólya's enumeration theorem (Combinatorica's name and
// argument order). `ci` is a cycle index in the variables x_i, the cycle lengths of
// `CycleIndexPolynomial`; with colors weighted w_1 … w_k each x_i becomes the power sum
// p_i = w_1^i + … + w_k^i, and the expanded result is the inventory of the colorings up to the group.
// A single number w stands for every x_i (Combinatorica's scalar form): with w = k, the count of
// k-colorings up to the group.
//
// The Epsil definition is the meaning: `Expand(Apply(Function(ci, x1 … xn), p_1 … p_n))`. The
// declare only reads the variable list and builds the power sums, which depend on the weights' length.

import type { Engine, Expr } from "@enumeratio/engine";
import { evaluateEpsil } from "@enumeratio/structures";

type MathJSON = unknown;

/** A parameter typed `number`, so a first call with integers does not narrow it for the next. */
const typed = (name: string): MathJSON => ["Typed", name, "'number'"];

const listOf = (json: unknown): unknown[] | undefined =>
  Array.isArray(json) && json[0] === "List" ? json.slice(1) : undefined;

const isSymbol = (json: unknown): json is string => typeof json === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(json);

/** p_i = Σ_j w_j^i, for i = 1 … n. */
export const powerSums = (weights: readonly MathJSON[], n: number): MathJSON[] =>
  Array.from({ length: n }, (_, i) => ["Add", ...weights.map((w) => ["Power", w, i + 1])]);

/** `_ci` with its variables `vars` renamed to `fresh`, expanded so the rational coefficients are
 *  distributed. Applying a function whose parameters are the weights' own names would substitute
 *  twice, so the variables are renamed apart first. */
export const renameEpsil = (vars: readonly string[], fresh: readonly string[]): MathJSON => [
  "Apply",
  ["Function", ["Expand", "_ci"], ...vars.map(typed)],
  ...fresh,
];

/** `_ci`, in the variables `fresh`, with each replaced by the matching `values`. `Expand` holds its
 *  argument, so the substituted polynomial is bound first and expanded after. */
export const orbitInventoryEpsil = (fresh: readonly string[], values: readonly MathJSON[]): MathJSON => [
  "Apply",
  ["Function", ["Expand", "oi_s"], typed("oi_s")],
  ["Apply", ["Function", "_ci", ...fresh.map(typed)], ...values],
];

export function declareOrbitInventory(ce: Engine): void {
  ce.declare("OrbitInventory", {
    signature: "(number, list, number | list) -> number",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [ci, variables, weights] = ops;
      if (ci === undefined || variables === undefined || weights === undefined) return undefined;
      const vars = listOf(variables.json);
      if (vars === undefined || vars.length === 0 || !vars.every(isSymbol) || new Set(vars).size !== vars.length) {
        return undefined;
      }
      const ws = listOf(weights.json);
      if (ws !== undefined && ws.length === 0) return undefined;
      // The variables are the function's parameters, so a weight named like one is not captured.
      const values = ws === undefined ? vars.map(() => weights.json) : powerSums(ws, vars.length);
      try {
        const fresh = vars.map((_, i) => `oi_x${i + 1}`);
        const renamed = evaluateEpsil(ce, renameEpsil(vars, fresh), { _ci: ci.json });
        return ce.box(evaluateEpsil(ce, orbitInventoryEpsil(fresh, values), { _ci: renamed }) as never);
      } catch {
        return undefined;
      }
    },
  });
}
