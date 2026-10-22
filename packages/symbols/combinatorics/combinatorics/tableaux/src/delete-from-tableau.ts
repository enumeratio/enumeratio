// DeleteFromTableau(t, r): reverse row insertion (Combinatorica's name). The last cell of row r
// leaves the tableau; its entry bumps back up the rows above, each time taking the place of the
// largest entry smaller than it, and what comes out of row 1 is dropped. It is the step inverse RSK
// repeats (`ToPermutation`), and undoes the insertion that ended in row r.
//
// The Epsil definition is the meaning; the declare only checks the domain: a semistandard tableau
// (rows weakly, columns strictly increasing) of small integers, with r a row that ends in a corner.

import { type Engine, type Expr } from "@enumeratio/engine";
import { evaluateEpsil } from "@enumeratio/structures";

import { at, fold, iff, less, lets, sub, upTo } from "../../collections/src/families/tables.ts";

type MathJSON = unknown;

const count = (xs: MathJSON): MathJSON => ["Count", xs];

/** `_t` without the last cell of row `_r`, the row going with it when that was its only cell. */
const withoutCell: MathJSON = iff(
  ["Equal", count(at("_t", "_r")), 1],
  ["Take", "_t", sub(count("_t"), 1)],
  ["ReplaceAt", "_t", "_r", ["Take", at("_t", "_r"), sub(count(at("_t", "_r")), 1)]],
);

/** One step up: the state [tableau, entry] with `entry` taking the place of the largest entry of
 *  row `_r - dt_j` smaller than it. */
const bumpUp: MathJSON = lets(
  [
    ["dt_w", sub("_r", "dt_j"), "integer"],
    ["dt_row", at(at("dt_s", 1), "dt_w"), "list<integer>"],
  ],
  lets(
    [
      [
        "dt_pos",
        fold(
          iff(less(at("dt_row", "dt_m"), at("dt_s", 2)), "dt_m", "dt_g"),
          "dt_g",
          "dt_m",
          0,
          upTo(1, count("dt_row")),
        ),
        "integer",
      ],
    ],
    [
      "List",
      ["ReplaceAt", at("dt_s", 1), "dt_w", ["ReplaceAt", "dt_row", "dt_pos", at("dt_s", 2)]],
      at("dt_row", "dt_pos"),
    ],
  ),
);

export const DELETE_FROM_TABLEAU_EPSIL: MathJSON = at(
  fold(bumpUp, "dt_s", "dt_j", ["List", withoutCell, at(at("_t", "_r"), count(at("_t", "_r")))], upTo(1, sub("_r", 1))),
  1,
);

/** The operands of a MathJSON `List`, or undefined for anything else. */
const listOf = (json: unknown): unknown[] | undefined =>
  Array.isArray(json) && json[0] === "List" ? json.slice(1) : undefined;

/** Whether `tableau` (a MathJSON list of lists) is a semistandard tableau of small integers and row `r`
 *  ends in a corner. */
export function deletable(tableau: unknown, r: unknown): boolean {
  const rows = listOf(tableau)?.map(listOf);
  if (rows === undefined || rows.length === 0 || !Number.isInteger(r)) return false;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i] as unknown;
    if (!Array.isArray(cells) || cells.length === 0 || !cells.every((x) => Number.isSafeInteger(x))) return false;
    if (cells.some((x: number, k: number) => k > 0 && x < cells[k - 1])) return false;
    const above = rows[i - 1] as number[] | undefined;
    if (above !== undefined && (cells.length > above.length || cells.some((x: number, k: number) => x <= above[k]!))) {
      return false;
    }
  }
  const k = r as number;
  if (k < 1 || k > rows.length) return false;
  const below = rows[k] as number[] | undefined;
  return below === undefined || (rows[k - 1] as number[]).length > below.length;
}

export function declareDeleteFromTableau(ce: Engine): void {
  ce.declare("DeleteFromTableau", {
    signature: "(list, integer) -> unknown",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [tableau, r] = ops;
      if (tableau === undefined || r === undefined) return undefined;
      const index = r.re;
      if (!deletable(tableau.json, index)) return undefined;
      try {
        return ce.box(evaluateEpsil(ce, DELETE_FROM_TABLEAU_EPSIL, { _t: tableau.json, _r: index }) as never);
      } catch {
        return undefined;
      }
    },
  });
}
