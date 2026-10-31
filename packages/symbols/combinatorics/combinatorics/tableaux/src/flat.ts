// Tableau maps on flat integer lists, so they compile: the compiler can't count, index or join a list of lists,
// but it builds one (a `Map` over rows) and reads one whole (`Flatten`). Two layouts:
//
// - Capacity: row r at offset (r - 1) * n of n cells, after n row lengths, for a tableau growing to n cells.
//   Row insertion works in this one. A state is the lengths, then the insertion tableau's n * n cells, then
//   (when recording) the recording tableau's.
// - Compact: a tableau's entries row by row, with its row lengths and each row's offset beside them. The shape
//   never changes, so promotion walks a hole through it.

import { at, lets, type MathJSON } from "../../src/map-helpers.ts";

const upTo = (n: MathJSON): MathJSON => ["Range", 1, n, 1];
const add = (...terms: MathJSON[]): MathJSON => ["Add", ...terms];
const sub = (a: MathJSON, b: MathJSON): MathJSON => ["Subtract", a, b];
const times = (a: MathJSON, b: MathJSON): MathJSON => ["Multiply", a, b];
const equal = (a: MathJSON, b: MathJSON): MathJSON => ["Equal", a, b];
const greater = (a: MathJSON, b: MathJSON): MathJSON => ["Greater", a, b];
const less = (a: MathJSON, b: MathJSON): MathJSON => ["Less", a, b];
const when = (condition: MathJSON, then: MathJSON, otherwise: MathJSON): MathJSON => ["If", condition, then, otherwise];
const keep = (over: MathJSON, test: MathJSON, variable: string): MathJSON => [
  "Filter",
  over,
  ["Function", test, variable],
];
const forEach = (over: MathJSON, body: MathJSON, variable: string): MathJSON => [
  "Map",
  ["Function", body, variable],
  over,
];
/** `forEach` as a fold, for a list that is a state (a `Map` over a range stays lazy, so each step's state would
 *  be re-derived from the last wherever it is read). */
const built = (over: MathJSON, body: MathJSON, variable: string): MathJSON => [
  "Fold",
  ["Function", ["Join", `${variable}_built`, ["List", body]], `${variable}_built`, variable],
  ["List"],
  over,
];

/** `tag`'s names, one per key: two passes in one body keep theirs apart. */
const named = <K extends string>(tag: string, keys: readonly K[]): Record<K, string> =>
  Object.fromEntries(keys.map((key) => [key, `${tag}_${key}`])) as Record<K, string>;

/** The cell (`row`, `column`) of the capacity layout of `n` cells a row, after `before` leading entries. */
const cell = (state: MathJSON, n: MathJSON, before: MathJSON, row: MathJSON, column: MathJSON): MathJSON =>
  at(add(before, times(sub(row, 1), n), column), state);

/** The number of rows with a cell in the capacity-layout state `s` of `n` cells. */
const rowCount = (s: string, n: MathJSON, variable: string): MathJSON => [
  "Count",
  keep(upTo(n), greater(at(variable, s), 0), variable),
];

/** The insertion tableau after row-inserting each entry of the permutation word `word` in turn, as a capacity-
 *  layout state: n row lengths, n * n insertion cells, and, when `recording`, n * n recording cells. `tag`
 *  prefixes the names, so two passes can sit in one body.
 *
 *  An insertion bumps one entry down each row it passes. That chain is found first, on the state as it was (the
 *  entry entering each row and the column it takes), and then every cell is written once. */
export const rskState = (tag: string, word: MathJSON, recording = false): MathJSON => {
  const {
    w,
    n,
    nn,
    s,
    k,
    j,
    q,
    c,
    acc,
    row: rowOf,
    col: colOf,
    chain,
    v,
    l,
    p,
  } = named(tag, ["w", "n", "nn", "s", "k", "j", "q", "c", "acc", "row", "col", "chain", "v", "l", "p"] as const);
  const entering = (row: MathJSON): MathJSON => at(sub(times(2, row), 1), chain);
  const landing = (row: MathJSON): MathJSON => at(times(2, row), chain);
  const length = (row: MathJSON): MathJSON => at(row, s);
  const inserted = (row: MathJSON, column: MathJSON): MathJSON => cell(s, n, n, row, column);
  const recorded = (row: MathJSON, column: MathJSON): MathJSON => cell(s, n, add(n, nn), row, column);

  // Row q takes `entering(q)` in the place of its next larger entry (one more than the number of smaller ones),
  // which enters row q + 1; at the end of the row, nothing goes on. A zero enters no row.
  const chainStep: MathJSON = lets(
    [
      [v, at(sub(times(2, q), 1), acc), "integer"],
      [l, length(q), "integer"],
      [p, when(equal(v, 0), 0, add(1, ["Count", keep(upTo(l), less(inserted(q, c), v), c)])), "integer"],
    ],
    ["Join", acc, ["List", p, when(["Or", equal(v, 0), greater(p, l)], 0, inserted(q, p))]],
  );

  const grown = (row: MathJSON): MathJSON => equal(landing(row), add(length(row), 1));
  const cellsOf = (body: (row: MathJSON, column: MathJSON) => MathJSON): MathJSON =>
    built(
      upTo(nn),
      lets(
        [
          [q, at(j, rowOf), "integer"],
          [c, at(j, colOf), "integer"],
        ],
        body(q, c),
      ),
      j,
    );

  const step: MathJSON = lets(
    [[chain, ["Fold", ["Function", chainStep, acc, q], ["List", at(k, w)], upTo(n)], "list<integer>"]],
    [
      "Join",
      built(upTo(n), when(grown(q), add(length(q), 1), length(q)), q),
      cellsOf((row, column) => when(equal(landing(row), column), entering(row), inserted(row, column))),
      ...(recording
        ? [cellsOf((row, column) => when(["And", equal(landing(row), column), grown(row)], k, recorded(row, column)))]
        : []),
    ],
  );

  return lets(
    [
      [w, word, "list<integer>"],
      [n, ["Length", w], "integer"],
      [nn, times(n, n), "integer"],
      // The row and the column of each of the n * n cells, as lists to index.
      [rowOf, forEach(upTo(nn), add(["Floor", ["Divide", sub(j, 1), n]], 1), j), "list<integer>"],
      [colOf, forEach(upTo(nn), add(["Mod", sub(j, 1), n], 1), j), "list<integer>"],
    ],
    ["Fold", ["Function", step, s, k], forEach(upTo(add(n, times(recording ? 2 : 1, nn))), 0, j), upTo(n)],
  );
};

/** The tableau of the capacity-layout state `s` (n cells a row) whose cells follow `before` leading entries, as its
 *  rows. */
const rowsOfState = (s: string, n: MathJSON, before: MathJSON): MathJSON =>
  forEach(
    upTo(rowCount(s, n, "fl_q")),
    forEach(upTo(at("fl_r", s)), cell(s, n, before, "fl_r", "fl_c"), "fl_c"),
    "fl_r",
  );

/** `body` with `n` the length of the permutation word `word` and `s` its insertion state (with the recording
 *  tableau, when `recording`). */
const withInsertion = (
  tag: string,
  word: MathJSON,
  recording: boolean,
  body: (n: string, s: string) => MathJSON,
): MathJSON =>
  lets(
    [
      [`${tag}_len`, ["Length", word], "integer"],
      [`${tag}_state`, rskState(tag, word, recording), "list<integer>"],
    ],
    body(`${tag}_len`, `${tag}_state`),
  );

/** The insertion tableau of the permutation word `word`, as its rows. */
export const insertionRows = (tag: string, word: MathJSON): MathJSON =>
  withInsertion(tag, word, false, (n, s) => rowsOfState(s, n, n));

/** The recording tableau of the permutation word `word`, as its rows. */
export const recordingRows = (tag: string, word: MathJSON): MathJSON =>
  withInsertion(tag, word, true, (n, s) => rowsOfState(s, n, add(n, times(n, n))));

/** The row lengths of the insertion tableau of the permutation word `word`. */
export const insertionShape = (tag: string, word: MathJSON): MathJSON =>
  withInsertion(tag, word, false, (n, s) => forEach(upTo(rowCount(s, n, "fl_q")), at("fl_r", s), "fl_r"));

/** Both the tableaux of `word`'s RSK pair, as the list of their rows. */
export const rskPairRows = (tag: string, word: MathJSON): MathJSON =>
  withInsertion(tag, word, true, (n, s) => ["List", rowsOfState(s, n, n), rowsOfState(s, n, add(n, times(n, n)))]);

/** The row reading word of the insertion tableau of `word`: its rows from the bottom up, each left to right. */
export const readingWord = (tag: string, word: MathJSON): MathJSON =>
  withInsertion(tag, word, false, (n, s) =>
    lets(
      [[`${tag}_rows`, rowCount(s, n, "fl_q"), "integer"]],
      [
        "Fold",
        [
          "Function",
          lets(
            [["fl_bottom", sub(add(`${tag}_rows`, 1), "fl_r"), "integer"]],
            ["Join", "fl_acc", forEach(upTo(at("fl_bottom", s)), cell(s, n, n, "fl_bottom", "fl_c"), "fl_c")],
          ),
          "fl_acc",
          "fl_r",
        ],
        ["List"],
        upTo(`${tag}_rows`),
      ],
    ),
  );

/** The permutation of n entries whose insertion tableau is in the capacity-layout state `p` and whose recording
 *  tableau, of the same shape, is in `q` (inverse RSK). From n down to 1, the cell of `q` holding k leaves both
 *  tableaux, and `p`'s entry in it bumps up the rows above, each time taking the place of the largest entry
 *  smaller than it; what leaves the first row is the k-th letter. `q`'s cells stay as they are: a row's last
 *  cell is the one at its length now. */
export const inverseRsk = (tag: string, p: string, q: string, n: MathJSON): MathJSON => {
  const { nn, s, c, k, row, u, pos, j, i, acc, m, col, rowOf, colOf } = named(tag, [
    "nn",
    "s",
    "c",
    "k",
    "row",
    "u",
    "pos",
    "j",
    "i",
    "acc",
    "m",
    "col",
    "rowOf",
    "colOf",
  ] as const);
  const length = (r: MathJSON): MathJSON => at(r, s);
  const held = (r: MathJSON, column: MathJSON): MathJSON => cell(s, n, n, r, column);
  const lastOf = (r: MathJSON): MathJSON => cell(q, n, n, r, length(r));
  // The state: the lengths, the cells, then the word so far.
  const letter = (index: MathJSON): MathJSON => at(add(n, nn, index), s);

  // What leaves each row on the way up: u[1] the cell that left, u[t + 1] what row (row - t) gives up.
  const climb: MathJSON = [
    "Fold",
    [
      "Function",
      lets(
        [[m, sub(row, j), "integer"]],
        [
          "Join",
          acc,
          ["List", when(less(0, m), held(m, ["Count", keep(upTo(length(m)), less(held(m, i), at(j, acc)), i)]), 0)],
        ],
      ),
      acc,
      j,
    ],
    ["List", held(row, length(row))],
    upTo(n),
  ];

  const step: MathJSON = lets(
    [
      [k, sub(add(n, 1), c), "integer"],
      [row, ["Min", keep(upTo(n), ["And", greater(length(i), 0), equal(lastOf(i), k)], i)], "integer"],
    ],
    lets(
      [
        [u, climb, "list<integer>"],
        // The column each row above takes the entry coming up from below in.
        [
          pos,
          built(
            upTo(n),
            when(less(i, row), ["Count", keep(upTo(length(i)), less(held(i, j), at(sub(row, i), u)), j)], 0),
            i,
          ),
          "list<integer>",
        ],
      ],
      [
        "Join",
        built(upTo(n), when(equal(i, row), sub(length(i), 1), length(i)), i),
        built(
          upTo(nn),
          lets(
            [
              [m, at(j, rowOf), "integer"],
              [col, at(j, colOf), "integer"],
            ],
            when(["And", less(m, row), equal(at(m, pos), col)], at(sub(row, m), u), at(add(n, j), s)),
          ),
          j,
        ),
        built(upTo(n), when(equal(i, k), at(row, u), letter(i)), i),
      ],
    ),
  );

  const done = `${tag}_done`;
  return lets(
    [
      [nn, times(n, n), "integer"],
      [rowOf, forEach(upTo(nn), add(["Floor", ["Divide", sub(j, 1), n]], 1), j), "list<integer>"],
      [colOf, forEach(upTo(nn), add(["Mod", sub(j, 1), n], 1), j), "list<integer>"],
      [
        done,
        [
          "Fold",
          ["Function", step, s, c],
          forEach(upTo(add(n, nn, n)), when(["LessEqual", j, add(n, nn)], at(j, p), 0), j),
          upTo(n),
        ],
        "list<integer>",
      ],
    ],
    forEach(upTo(n), at(add(n, nn, i), done), i),
  );
};

/** The permutation `_raw` with its insertion tableau kept and its recording tableau evacuated. A word's recording
 *  tableau is the insertion tableau of its inverse, and reverse-complementing a word evacuates its insertion
 *  tableau, so the evacuated one is the insertion tableau of the inverse, reversed and complemented. */
export const cactusEvacuation: MathJSON = lets(
  [
    ["ce_n", ["Length", "_raw"], "integer"],
    ["ce_p", rskState("ce_p", "_raw"), "list<integer>"],
    [
      "ce_inverse",
      forEach(upTo("ce_n"), ["Min", keep(upTo("ce_n"), equal(at("ce_j", "_raw"), "ce_i"), "ce_j")], "ce_i"),
      "list<integer>",
    ],
    [
      "ce_word",
      forEach(upTo("ce_n"), sub(add("ce_n", 1), at(sub(add("ce_n", 1), "ce_i"), "ce_inverse")), "ce_i"),
      "list<integer>",
    ],
    ["ce_q", rskState("ce_q", "ce_word"), "list<integer>"],
  ],
  inverseRsk("ce_r", "ce_p", "ce_q", "ce_n"),
);

/** Schützenberger's evacuation of the standard tableau `table` (a bound name): the insertion tableau of its reading
 *  word reversed and complemented, the rows top to bottom, each right to left, every entry e taken to n + 1 - e.
 *  The reading word is bound outside the insertion: a typed binding's value that is itself a binding is not
 *  reduced before its type is checked. */
export const evacuation = (tag: string, table: string): MathJSON =>
  lets(
    [
      [
        "fl_reading",
        ["Flatten", forEach(upTo(["Length", table]), at(sub(add(["Length", table], 1), "fl_r"), table), "fl_r")],
        "list<integer>",
      ],
      ["fl_size", ["Length", "fl_reading"], "integer"],
    ],
    insertionRows(
      tag,
      forEach(upTo("fl_size"), sub(add("fl_size", 1), at(sub(add("fl_size", 1), "fl_w"), "fl_reading")), "fl_w"),
    ),
  );

// Promotion walks a hole through a tableau's entries in the compact layout. The state is the n entries, then the
// hole's row and column.

/** `table`'s (a bound name) row lengths, each row's offset into the entries (one more entry, the total, after the
 *  last), and its entries; the name `ent` etc. are then free in `body`. */
const compact = (table: string, body: MathJSON): MathJSON =>
  lets(
    [
      ["fl_rows", ["Length", table], "integer"],
      ["fl_lens", forEach(upTo("fl_rows"), ["Length", at("fl_r", table)], "fl_r"), "list<integer>"],
      [
        "fl_offs",
        [
          "Fold",
          [
            "Function",
            ["Join", "fl_acc", ["List", add(at("fl_r", "fl_acc"), at("fl_r", "fl_lens"))]],
            "fl_acc",
            "fl_r",
          ],
          ["List", 0],
          upTo("fl_rows"),
        ],
        "list<integer>",
      ],
      ["fl_ent", ["Flatten", table], "list<integer>"],
      ["fl_n", ["Length", "fl_ent"], "integer"],
    ],
    body,
  );

/** The tableau of shape `fl_lens` whose entries are the list `ent`, as rows. */
const rowsFrom = (ent: MathJSON): MathJSON =>
  lets(
    [["fl_out", ent, "list<integer>"]],
    forEach(
      upTo("fl_rows"),
      forEach(upTo(at("fl_r", "fl_lens")), at(add(at("fl_r", "fl_offs"), "fl_c"), "fl_out"), "fl_c"),
      "fl_r",
    ),
  );

/** The state after the hole, at `fl_idx`, takes `value` there and moves to (`row`, `column`). */
const holeMoved = (value: MathJSON, row: MathJSON, column: MathJSON): MathJSON =>
  built(
    upTo(add("fl_n", 2)),
    when(
      equal("fl_i", "fl_idx"),
      value,
      when(equal("fl_i", add("fl_n", 1)), row, when(equal("fl_i", add("fl_n", 2)), column, at("fl_i", "fl_s"))),
    ),
    "fl_i",
  );

/** One step of a walk: `choose` gets the hole's row and column and says the next state. */
const walk = (start: MathJSON, choose: MathJSON): MathJSON => [
  "Fold",
  [
    "Function",
    lets(
      [
        ["fl_row", at(add("fl_n", 1), "fl_s"), "integer"],
        ["fl_col", at(add("fl_n", 2), "fl_s"), "integer"],
      ],
      lets([["fl_idx", add(at("fl_row", "fl_offs"), "fl_col"), "integer"]], choose),
    ),
    "fl_s",
    "fl_step",
  ],
  start,
  upTo("fl_n"),
];

/** Promotion of the standard tableau `table` (a bound name): the hole starts at the largest entry and slides to the
 *  origin, pulling in the larger of the entry to its left and the one above it; the entries then all go up by one
 *  and the origin takes 1. A walk of n steps is enough: a step with nowhere to go changes nothing. */
export const promotion = (table: string): MathJSON =>
  compact(
    table,
    when(
      equal("fl_n", 0),
      ["List"],
      lets(
        [
          ["fl_at", ["Min", keep(upTo("fl_n"), equal(at("fl_j", "fl_ent"), "fl_n"), "fl_j")], "integer"],
          ["fl_from", ["Count", keep(upTo("fl_rows"), less(at("fl_j", "fl_offs"), "fl_at"), "fl_j")], "integer"],
        ],
        lets(
          [
            [
              "fl_end",
              walk(
                ["Join", "fl_ent", ["List", "fl_from", sub("fl_at", at("fl_from", "fl_offs"))]],
                lets(
                  [
                    ["fl_left", when(greater("fl_col", 1), at(sub("fl_idx", 1), "fl_s"), 0), "integer"],
                    [
                      "fl_up",
                      when(greater("fl_row", 1), at(add(at(sub("fl_row", 1), "fl_offs"), "fl_col"), "fl_s"), 0),
                      "integer",
                    ],
                  ],
                  when(
                    ["And", equal("fl_left", 0), equal("fl_up", 0)],
                    "fl_s",
                    when(
                      greater("fl_left", "fl_up"),
                      holeMoved("fl_left", "fl_row", sub("fl_col", 1)),
                      holeMoved("fl_up", sub("fl_row", 1), "fl_col"),
                    ),
                  ),
                ),
              ),
              "list<integer>",
            ],
          ],
          rowsFrom(forEach(upTo("fl_n"), when(equal("fl_k", 1), 1, add(at("fl_k", "fl_end"), 1)), "fl_k")),
        ),
      ),
    ),
  );

/** Inverse promotion of the standard tableau `table` (a bound name): the hole starts at the origin and slides out,
 *  pulling in the smaller of the entry to its right and the one below it; the entries then all go down by one and
 *  the hole's cell takes n. */
export const inversePromotion = (table: string): MathJSON =>
  compact(
    table,
    lets(
      [
        // One row past the last, so the row below can be read: it has no cells.
        ["fl_below", ["Join", "fl_lens", ["List", 0]], "list<integer>"],
        [
          "fl_end",
          walk(
            ["Join", "fl_ent", ["List", 1, 1]],
            lets(
              [
                [
                  "fl_right",
                  when(less("fl_col", at("fl_row", "fl_lens")), at(add("fl_idx", 1), "fl_s"), add("fl_n", 1)),
                  "integer",
                ],
                [
                  "fl_down",
                  when(
                    ["GreaterEqual", at(add("fl_row", 1), "fl_below"), "fl_col"],
                    at(add(at(add("fl_row", 1), "fl_offs"), "fl_col"), "fl_s"),
                    add("fl_n", 1),
                  ),
                  "integer",
                ],
              ],
              when(
                ["And", greater("fl_right", "fl_n"), greater("fl_down", "fl_n")],
                "fl_s",
                when(
                  less("fl_right", "fl_down"),
                  holeMoved("fl_right", "fl_row", add("fl_col", 1)),
                  holeMoved("fl_down", add("fl_row", 1), "fl_col"),
                ),
              ),
            ),
          ),
          "list<integer>",
        ],
      ],
      rowsFrom(
        forEach(
          upTo("fl_n"),
          when(
            equal("fl_k", add(at(at(add("fl_n", 1), "fl_end"), "fl_offs"), at(add("fl_n", 2), "fl_end"))),
            "fl_n",
            sub(at("fl_k", "fl_end"), 1),
          ),
          "fl_k",
        ),
      ),
    ),
  );
