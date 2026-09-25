// Row insertion, and the maps built on it.
//
// THE RULE THAT MAKES THIS WORK. A first attempt at RSK produced an unevaluated tree, and
// the cause is worth stating because it governs every non-trivial expression here:
//
//   Iterate over a RANGE and index. Never fold or filter over a list taken out of the
//   accumulator.
//
// `Filter(At(state, 1), …)` inside a fold step does not force — the substitution happens,
// the collection stays lazy, and nothing downstream forces it, not even `Count`. The same
// selection written as `Fold` over `Range(1, Count(row))`, indexing with `At`, evaluates
// eagerly. Every helper below is written that way on purpose.
//
// The second rule, from the statistics package: when a list has to BE a value rather than a
// promise, build it with a fold. `Map` over a range stays lazy.

/** A MathJSON expression, structurally — declared locally so this package stays packable
 *  (a bundled package cannot import types from the src-only reference package). */
type MathJSON = string | number | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

const at = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
const count = (list: MathJSON): MathJSON => ["Count", list];

/** `body` with `name` bound to `value` — a `let`, as a lambda applied to its argument.
 *
 *  The third rule. A sub-term embedded by value at several places is evaluated at each of
 *  them — compute-engine has no common-subexpression elimination — and a tableau referenced
 *  from inside a loop over its own rows is rebuilt once per row. Binding it evaluates it once.
 *  Names must not collide with anything bound around them, or with the engine's constants
 *  (`e`, `i`, `pi`): the ones used here are short words, never single letters. */
const bind = (name: string, value: MathJSON, body: MathJSON): MathJSON => ["Apply", ["Function", body, name], value];

/** A fold over `1 .. n`, indexing rather than iterating a structure. */
const overRange = (n: MathJSON, initial: MathJSON, step: MathJSON, accumulator: string, variable: string): MathJSON => [
  "Fold",
  ["Function", step, accumulator, variable],
  initial,
  ["Range", 1, n],
];

/** The entries of `row` greater than `x`. */
const greaterThan = (row: MathJSON, x: MathJSON): MathJSON =>
  overRange(
    count(row),
    ["List"],
    ["If", ["Greater", at(row, "g"), x], ["Join", "bacc", ["List", at(row, "g")]], "bacc"],
    "bacc",
    "g",
  );

/** The entry `x` bumps out of `row`, or 0 when it simply appends. */
export const bumpedFrom = (row: MathJSON, x: MathJSON): MathJSON =>
  bind("larger", greaterThan(row, x), ["If", ["Equal", count("larger"), 0], 0, ["Min", "larger"]]);

/** `row` after inserting `x`: the smallest larger entry is replaced, or `x` is appended.
 *  The bumped entry is fixed once, outside the walk over the row. */
export const rowAfterInserting = (row: MathJSON, x: MathJSON): MathJSON =>
  bind("bumped", bumpedFrom(row, x), [
    "If",
    ["Equal", "bumped", 0],
    overRange(
      ["Add", count(row), 1],
      ["List"],
      ["If", ["Greater", "n", count(row)], ["Join", "nacc", ["List", x]], ["Join", "nacc", ["List", at(row, "n")]]],
      "nacc",
      "n",
    ),
    overRange(
      count(row),
      ["List"],
      ["Join", "nacc", ["List", ["If", ["Equal", at(row, "n"), "bumped"], x, at(row, "n")]]],
      "nacc",
      "n",
    ),
  ]);

const TABLEAU: MathJSON = ["At", "st", 1];
const CARRIED: MathJSON = ["At", "st", 2];
const ROW_R: MathJSON = at(TABLEAU, "r");

/** One insertion: walk the rows, bumping down, until something lands.
 *
 *  The state is `(tableau, carried)`, and `carried = 0` means the value has been placed —
 *  which is why 0 can stand for "nothing", the entries being 1..n. */
const insertionStep: MathJSON = [
  "If",
  ["Equal", CARRIED, 0],
  "st",
  [
    "If",
    ["Greater", "r", count(TABLEAU)],
    [
      "List",
      overRange(
        ["Add", count(TABLEAU), 1],
        ["List"],
        [
          "If",
          ["Greater", "m", count(TABLEAU)],
          ["Join", "tacc", ["List", ["List", CARRIED]]],
          ["Join", "tacc", ["List", at(TABLEAU, "m")]],
        ],
        "tacc",
        "m",
      ),
      0,
    ],
    [
      "List",
      overRange(
        count(TABLEAU),
        ["List"],
        ["Join", "tacc", ["List", ["If", ["Equal", "m", "r"], rowAfterInserting(ROW_R, CARRIED), at(TABLEAU, "m")]]],
        "tacc",
        "m",
      ),
      bumpedFrom(ROW_R, CARRIED),
    ],
  ],
];

/** Insert `x` into tableau `tableau`, returning the tableau. */
export const afterInserting = (tableau: MathJSON, x: MathJSON): MathJSON => [
  "At",
  ["Fold", ["Function", insertionStep, "st", "r"], ["List", tableau, x], ["Range", 1, ["Add", count(tableau), 1]]],
  1,
];

/** The RSK insertion tableau of a word: insert every entry in turn. */
export const insertionTableau: MathJSON = ["Fold", ["Function", afterInserting("a", "b"), "a", "b"], ["List"], "_raw"];

/** `body` with `tab` bound to the insertion tableau, built once. */
const withInsertionTableau = (body: MathJSON): MathJSON => bind("tab", insertionTableau, body);

/** The row lengths of `tableau`, as a partition. */
const shapeOf = (tableau: MathJSON): MathJSON =>
  overRange(count(tableau), ["List"], ["Join", "sacc", ["List", count(at(tableau, "s"))]], "sacc", "s");

/** `tableau` as a ROW WORD — its rows concatenated. */
const rowWordOf = (tableau: MathJSON): MathJSON =>
  overRange(count(tableau), ["List"], ["Join", "wacc", at(tableau, "w")], "wacc", "w");

/** The shape of that tableau — the row lengths, as a partition. */
export const insertionShape: MathJSON = withInsertionTableau(shapeOf("tab"));

/**
 * The insertion tableau as a ROW WORD — its rows concatenated.
 *
 * That is how enumeratio stores a standard tableau (`standard_tableau AS (row_word int[])`),
 * and it is the right call: the rows are recoverable from the word plus the shape, so the
 * carrier holds one array instead of a ragged nested one. A nested list is REJECTED by the
 * type, which is the extracted carrier shapes earning their keep for the third time.
 */
export const insertionRowWord: MathJSON = withInsertionTableau(rowWordOf("tab"));

/**
 * The insertion tableau's READING WORD: rows read bottom to top, each left to right — the
 * standard reading word, and the one Knuth equivalence is stated in terms of. Row `w` here
 * (1 at the bottom) is row `count + 1 - w` of the tableau as stored (1 at the top), which is
 * the whole difference from `insertionRowWord` above.
 */
export const insertionReadingWord: MathJSON = withInsertionTableau(
  overRange(
    count("tab"),
    ["List"],
    ["Join", "wacc", at("tab", ["Subtract", ["Add", count("tab"), 1], "w"])],
    "wacc",
    "w",
  ),
);

// ── the recording tableau, and the pair ──────────────────────────────────────────────────
//
// Q records WHERE each insertion added a cell: inserting the k-th entry grows exactly one row
// of P by one cell, and Q gets `k` in that same position. So Q always has P's shape, and the
// two together are the RSK correspondence.
//
// The insertion logic needs no change at all. Comparing row lengths before and after says
// which row grew, which is strictly less work than instrumenting the bumping to report it —
// and it keeps `afterInserting` as the single description of what insertion does.

const P_SO_FAR: MathJSON = ["At", "s", 1];
const Q_SO_FAR: MathJSON = ["At", "s", 2];
/** The k-th entry of the word. Folding over INDICES rather than entries is what makes the
 *  position available to record. */
const KTH: MathJSON = ["At", "_raw", "k"];

/** P after the k-th insertion, bound once per fold step — `recordedQ` reads it per row. */
const insertedP: MathJSON = "insertedP";

/** Q after the k-th insertion: the row that grew gets `k` appended. */
const recordedQ: MathJSON = overRange(
  count(insertedP),
  ["List"],
  [
    "Join",
    "qacc",
    [
      "List",
      [
        "If",
        ["Greater", "m", count(Q_SO_FAR)],
        ["List", "k"],
        [
          "If",
          ["Greater", count(at(insertedP, "m")), count(at(Q_SO_FAR, "m"))],
          ["Join", at(Q_SO_FAR, "m"), ["List", "k"]],
          at(Q_SO_FAR, "m"),
        ],
      ],
    ],
  ],
  "qacc",
  "m",
);

/** The RSK pair `(P, Q)`, both as tableaux of rows. */
export const rskPair: MathJSON = [
  "Fold",
  ["Function", bind("insertedP", afterInserting(P_SO_FAR, KTH), ["List", insertedP, recordedQ]), "s", "k"],
  ["List", ["List"], ["List"]],
  ["Range", 1, ["Count", "_raw"]],
];

/** The recording tableau alone, as a row word. */
export const recordingRowWord: MathJSON = bind("pq", rskPair, rowWordOf(at("pq", 2)));

/** Both tableaux as row words, ready for the `standard_tableau_pair` constructor — one RSK
 *  run for the pair, not one per half. */
export const rskRowWords: MathJSON = bind("pq", rskPair, [
  "Tuple",
  ["StandardTableau", rowWordOf(at("pq", 1))],
  ["StandardTableau", rowWordOf(at("pq", 2))],
]);
