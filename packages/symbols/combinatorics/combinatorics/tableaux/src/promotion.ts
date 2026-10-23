// Evacuation and promotion of standard tableaux, and the cactus evacuation of a permutation.
//
// - Evacuation goes through RSK: the reverse complement of a word evacuates its insertion tableau, and a
//   tableau is the insertion tableau of its reading word.
// - Promotion slides one entry at a time, the hole walking from where it starts to where it stops. The state is
//   [rows, row, column] of the hole, and a walk of n steps is enough: a step with nowhere to go changes nothing.
import { at, bind, forEach, type MathJSON } from "../../src/map-helpers.ts";
import { inverseRsk } from "./families/rsk-pairs.ts";
import { afterInserting, insertionRows } from "./tableau.ts";

/** `expr` with the symbol `from` named `to`. */
const renamed = (expr: MathJSON, from: string, to: string): MathJSON =>
  Array.isArray(expr) ? expr.map((part) => renamed(part, from, to)) : expr === from ? to : expr;

const upTo = (n: MathJSON): MathJSON => ["Range", 1, n, 1];
const rows = "list<list<integer>>";

/** The reading word of the tableau `table` (bottom row first) reversed and complemented. */
const reverseComplementReading = (table: string): MathJSON =>
  bind(
    "ev_reading",
    ["Flatten", forEach(upTo(["Length", table]), at(["Subtract", ["Add", ["Length", table], 1], "r"], table), "r")],
    bind(
      "ev_size",
      ["Length", "ev_reading"],
      forEach(
        upTo("ev_size"),
        ["Subtract", ["Add", "ev_size", 1], at(["Subtract", ["Add", "ev_size", 1], "w"], "ev_reading")],
        "w",
      ),
      "integer",
    ),
    "list<integer>",
  );

/** Schützenberger's evacuation of the standard tableau whose rows are `table` (a bound name). */
export const evacuationRows = (table: string): MathJSON =>
  bind(
    "ev_word",
    reverseComplementReading(table),
    ["Fold", ["Function", afterInserting("a", "b"), "a", "b"], ["List"], "ev_word"],
    "list<integer>",
  );

/** The word `_raw` inverted, reversed and complemented. */
const evacuatedRecordingWord: MathJSON = bind(
  "ce_inverse",
  forEach(upTo(["Length", "_raw"]), ["IndexOf", "_raw", "i"]),
  forEach(
    upTo(["Length", "_raw"]),
    ["Subtract", ["Add", ["Length", "_raw"], 1], at(["Subtract", ["Add", ["Length", "_raw"], 1], "j"], "ce_inverse")],
    "j",
  ),
  "list<integer>",
);

/** The permutation `_raw` with its insertion tableau kept and its recording tableau evacuated. A word's recording
 *  tableau is the insertion tableau of its inverse, and reverse-complementing a word evacuates its insertion
 *  tableau, so the evacuated one is the insertion tableau of the inverse, reversed and complemented. */
export const cactusEvacuationBody: MathJSON = bind(
  "ce_p",
  insertionRows,
  bind(
    "ce_w",
    evacuatedRecordingWord,
    bind(
      "ce_q",
      renamed(insertionRows, "_raw", "ce_w"),
      inverseRsk("ce_p", "ce_q", ["Length", "_raw"]) as MathJSON,
      rows,
    ),
    "list<integer>",
  ),
  rows,
);

/** The insertion tableau of `word`, by row insertion. */
function insertionTableauOf(word: readonly number[]): number[][] {
  const rows: number[][] = [];
  for (const entry of word) {
    let carried: number | undefined = entry;
    for (const row of rows) {
      const bumped = row.findIndex((x) => x > carried!);
      if (bumped < 0) {
        row.push(carried);
        carried = undefined;
        break;
      }
      [row[bumped], carried] = [carried, row[bumped]!];
    }
    if (carried !== undefined) rows.push([carried]);
  }
  return rows;
}

/** The word whose insertion tableau is `p` and recording tableau is `q`: each cell of `q` from the
 *  largest entry down leaves both tableaux, and `p`'s entry there bumps back up through the rows above. */
function inverseRskOf(p: number[][], q: number[][], size: number): number[] {
  const word = Array.from<number>({ length: size });
  for (let k = size; k >= 1; k--) {
    const r = q.findIndex((row) => row[row.length - 1] === k);
    q[r]!.pop();
    if (q[r]!.length === 0) q.pop();
    let carried = p[r]!.pop()!;
    if (p[r]!.length === 0) p.pop();
    for (let above = r - 1; above >= 0; above--) {
      const row = p[above]!;
      const pos = row.findLastIndex((x) => x < carried);
      [row[pos], carried] = [carried, row[pos]!];
    }
    word[k - 1] = carried;
  }
  return word;
}

/** A fast path for `cactusEvacuationBody` over a permutation of 1..n; `undefined` for anything else.
 *  The same three steps as the Epsil, which nested lists keep from compiling. */
export function cactusEvacuationKernel(word: readonly number[]): number[] | undefined {
  const n = word.length;
  if (new Set(word).size !== n || word.some((x) => !Number.isInteger(x) || x < 1 || x > n)) return undefined;
  const inverse = Array.from<number>({ length: n });
  word.forEach((x, i) => (inverse[x - 1] = i + 1));
  const evacuated = inverse.map((_, j) => n + 1 - inverse[n - 1 - j]!);
  return inverseRskOf(insertionTableauOf(word), insertionTableauOf(evacuated), n);
}

/** The rows of the tableau in the state `state` (a bound name), the hole's row, and its column. */
const heldRows = (state: string): MathJSON => at(1, state);
const holeRow = (state: string): MathJSON => at(2, state);
const holeColumn = (state: string): MathJSON => at(3, state);

/** The state after the hole takes the entry `value` from the cell (`row`, `column`), moving there. */
const moved = (state: string, value: MathJSON, row: MathJSON, column: MathJSON): MathJSON => [
  "List",
  [
    "ReplaceAt",
    heldRows(state),
    holeRow(state),
    ["ReplaceAt", at(holeRow(state), heldRows(state)), holeColumn(state), value],
  ],
  row,
  column,
];

const entry = (state: string, row: MathJSON, column: MathJSON): MathJSON => at(column, at(row, heldRows(state)));

/** Promotion: the hole starts at the largest entry and slides to the origin, pulling in the larger of the entry to
 *  its left and the one above it; the entries then all go up by one and the origin takes 1. */
export const promotionRows = (table: string): MathJSON =>
  bind(
    "pm_size",
    ["Count", ["Flatten", table]],
    bind(
      "pm_start",
      [
        "IndexWhere",
        table,
        ["Function", ["If", ["Equal", ["Length", "r"], 0], "False", ["Element", "pm_size", "r"]], "r"],
      ],
      bind(
        "pm_end",
        [
          "Fold",
          [
            "Function",
            bind(
              "pm_left",
              [
                "If",
                ["Greater", holeColumn("pm_s"), 1],
                entry("pm_s", holeRow("pm_s"), ["Subtract", holeColumn("pm_s"), 1]),
                0,
              ],
              bind(
                "pm_up",
                [
                  "If",
                  ["Greater", holeRow("pm_s"), 1],
                  entry("pm_s", ["Subtract", holeRow("pm_s"), 1], holeColumn("pm_s")),
                  0,
                ],
                [
                  "If",
                  ["And", ["Equal", "pm_left", 0], ["Equal", "pm_up", 0]],
                  "pm_s",
                  [
                    "If",
                    ["Greater", "pm_left", "pm_up"],
                    moved("pm_s", "pm_left", holeRow("pm_s"), ["Subtract", holeColumn("pm_s"), 1]),
                    moved("pm_s", "pm_up", ["Subtract", holeRow("pm_s"), 1], holeColumn("pm_s")),
                  ],
                ],
                "integer",
              ),
              "integer",
            ),
            "pm_s",
            "pm_step",
          ],
          ["List", table, "pm_start", ["IndexOf", at("pm_start", table), "pm_size"]],
          upTo("pm_size"),
        ],
        forEach(
          upTo(["Length", heldRows("pm_end")]),
          forEach(
            upTo(["Length", at("pm_row", heldRows("pm_end"))]),
            [
              "If",
              ["And", ["Equal", "pm_row", 1], ["Equal", "pm_col", 1]],
              1,
              ["Add", entry("pm_end", "pm_row", "pm_col"), 1],
            ],
            "pm_col",
          ),
          "pm_row",
        ),
        "list<any>",
      ),
      "integer",
    ),
    "integer",
  );

/** Inverse promotion: the hole starts at the origin and slides out, pulling in the smaller of the entry to its right
 *  and the one below it; the entries then all go down by one and the hole's cell takes n. */
export const inversePromotionRows = (table: string): MathJSON =>
  bind(
    "pm_size",
    ["Count", ["Flatten", table]],
    bind(
      "pm_end",
      [
        "Fold",
        [
          "Function",
          bind(
            "pm_right",
            [
              "If",
              ["Less", holeColumn("pm_s"), ["Length", at(holeRow("pm_s"), heldRows("pm_s"))]],
              entry("pm_s", holeRow("pm_s"), ["Add", holeColumn("pm_s"), 1]),
              ["Add", "pm_size", 1],
            ],
            bind(
              "pm_down",
              [
                "If",
                [
                  "And",
                  ["Less", holeRow("pm_s"), ["Length", heldRows("pm_s")]],
                  ["GreaterEqual", ["Length", at(["Add", holeRow("pm_s"), 1], heldRows("pm_s"))], holeColumn("pm_s")],
                ],
                entry("pm_s", ["Add", holeRow("pm_s"), 1], holeColumn("pm_s")),
                ["Add", "pm_size", 1],
              ],
              [
                "If",
                ["And", ["Greater", "pm_right", "pm_size"], ["Greater", "pm_down", "pm_size"]],
                "pm_s",
                [
                  "If",
                  ["Less", "pm_right", "pm_down"],
                  moved("pm_s", "pm_right", holeRow("pm_s"), ["Add", holeColumn("pm_s"), 1]),
                  moved("pm_s", "pm_down", ["Add", holeRow("pm_s"), 1], holeColumn("pm_s")),
                ],
              ],
              "integer",
            ),
            "integer",
          ),
          "pm_s",
          "pm_step",
        ],
        ["List", table, 1, 1],
        upTo("pm_size"),
      ],
      forEach(
        upTo(["Length", heldRows("pm_end")]),
        forEach(
          upTo(["Length", at("pm_row", heldRows("pm_end"))]),
          [
            "If",
            ["And", ["Equal", "pm_row", holeRow("pm_end")], ["Equal", "pm_col", holeColumn("pm_end")]],
            "pm_size",
            ["Subtract", entry("pm_end", "pm_row", "pm_col"), 1],
          ],
          "pm_col",
        ),
        "pm_row",
      ),
      "list<any>",
    ),
    "integer",
  );
