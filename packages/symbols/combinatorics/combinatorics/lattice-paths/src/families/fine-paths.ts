// FinePaths in Epsil: the Dyck paths of semilength n with no hill, an elementary up-down arch
// touching the ground on both sides. A Dyck path is a sequence of primitive blocks at ground level,
// each an up step, a Dyck path inside and a down step; a hill is a block with nothing inside. So a
// path is a sequence of blocks of semilength at least 2, and there are F(k) such sequences of total
// semilength k (the Fine numbers): F(0) = 1, F(k) = Σ_{m ≥ 2} C(m − 1) F(k − m), C the Catalan
// numbers. Paths are listed by their first block's semilength m, then by the Dyck rank of what is
// inside it, then by the rank of the rest, so a path of remaining semilength k has rank
//   Σ_{2 ≤ j < m} C(j − 1) F(k − j) + rank(inside) F(k − m) + rank(rest).
// Unrank and rank walk the blocks left to right, DyckPaths' definitions applied to each inside.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  and,
  at,
  equal,
  fold,
  iff,
  less,
  lets,
  map,
  mul,
  quotient,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { dyckPaths } from "./core.ts";

type MathJSON = unknown;

const N = "_n";
/** The tables' size is that of n clamped at 0, so a negative n has an empty fiber, not an error. */
const top: MathJSON = ["Max", N, 0];

/** `expr` with the symbol `from` renamed `to`. */
const rename = (expr: MathJSON, from: string, to: string): MathJSON =>
  Array.isArray(expr) ? expr.map((e) => rename(e, from, to)) : expr === from ? to : expr;

/** Cells of `_tables`: the Fine numbers F(0..n), then the Catalan numbers C(0..n). */
const fine = (k: MathJSON): MathJSON => at("_tables", add(k, 1));
const catalan = (r: MathJSON): MathJSON => at("_tables", add(top, 2, r));

/** C(0..n): C(k + 1) = Σ_{i ≤ k} C(i) C(k − i). */
const catalanTable: MathJSON = fold(
  lets(
    [["cc", "ct", "list<integer>"]],
    [
      "ReplaceAt",
      "ct",
      add("ck", 2),
      fold(add("cs", mul(at("cc", add("ci", 1)), at("cc", add(sub("ck", "ci"), 1)))), "cs", "ci", 0, upTo(0, "ck")),
    ],
  ),
  "ct",
  "ck",
  ["Join", ["List", 1], map(0, "cz", upTo(1, top))],
  upTo(0, sub(top, 1)),
);

/** The tables: F(0..n) from the Catalan numbers, then the Catalan numbers. */
const tables: MathJSON = lets(
  [["fc", catalanTable, "list<integer>"]],
  [
    "Join",
    fold(
      lets(
        [["ff", "ft", "list<integer>"]],
        [
          "ReplaceAt",
          "ft",
          add("fk", 1),
          fold(add("fs", mul(at("fc", "fm"), at("ff", add(sub("fk", "fm"), 1)))), "fs", "fm", 0, upTo(2, "fk")),
        ],
      ),
      "ft",
      "fk",
      ["Join", ["List", 1], map(0, "fz", upTo(1, top))],
      upTo(1, top),
    ),
    "fc",
  ],
);

/** Blocks a path of semilength n has at most: each takes at least 2. */
const blocks: MathJSON = quotient(top, 2);

// ─── unrank: state [semilength left, rank left, the path so far…] ──────────────────────────────

/** The block holding rank `kr` among the paths of semilength `kg`: [rank left, its semilength, found]. */
const find: MathJSON = fold(
  lets(
    [["kw", mul(catalan(sub("km", 1)), fine(sub("kg", "km"))), "integer"]],
    iff(
      equal(at("ka", 3), 1),
      "ka",
      iff(less(at("ka", 1), "kw"), ["List", at("ka", 1), "km", 1], ["List", sub(at("ka", 1), "kw"), "km", 0]),
    ),
  ),
  "ka",
  "km",
  ["List", "kr", 0, 0],
  upTo(2, "kg"),
);

const unrankStep = lets(
  [
    ["kg", at("ks", 1), "integer"],
    ["kr", at("ks", 2), "integer"],
    ["kf", find, "list<integer>"],
    ["kq", at("kf", 2), "integer"],
    // The paths that can follow the block.
    ["kt", fine(sub("kg", at("kf", 2))), "integer"],
    // What is inside the block: DyckPaths' unrank at semilength kq − 1.
    [
      "ki",
      lets(
        [
          ["kn", sub("kq", 1), "integer"],
          ["kd", quotient(at("kf", 1), "kt"), "integer"],
        ],
        rename(rename(dyckPaths.epsil.unrank, "_n", "kn"), "_r", "kd"),
      ),
      "list<integer>",
    ],
  ],
  ["Join", ["List", sub("kg", "kq"), ["Mod", at("kf", 1), "kt"]], ["Drop", "ks", 2], ["List", 1], "ki", ["List", 0]],
);
const unrank: MathJSON = [
  "Drop",
  fold(iff(equal(at("ks", 1), 0), "ks", unrankStep), "ks", "kb", ["List", N, "_r"], upTo(1, blocks)),
  2,
];

// ─── rank: state [semilength left, rank so far, position of the block's first step] ────────────

const path = (j: MathJSON): MathJSON => at("_x", j);
const step = (j: MathJSON): MathJSON => iff(equal(path(j), 1), 1, -1);
const rankStep = lets(
  [
    ["kg", at("ks", 1), "integer"],
    ["kp", at("ks", 3), "integer"],
    // The block ends where the height first returns to 0: [height, end].
    [
      "ke",
      fold(
        iff(
          equal(at("kh", 2), 0),
          iff(equal(add(at("kh", 1), step("kj")), 0), ["List", 0, "kj"], ["List", add(at("kh", 1), step("kj")), 0]),
          "kh",
        ),
        "kh",
        "kj",
        ["List", 0, 0],
        upTo("kp", ["Length", "_x"]),
      ),
      "list<integer>",
    ],
    ["km", quotient(add(sub(at("ke", 2), "kp"), 1), 2), "integer"],
    // What is inside the block, a path of its own.
    ["kx", ["Take", ["Drop", "_x", "kp"], sub(at("ke", 2), add("kp", 1))], "list<integer>"],
    ["kn", sub("km", 1), "integer"],
  ],
  [
    "List",
    sub("kg", "km"),
    add(
      at("ks", 2),
      fold(add("kc", mul(catalan(sub("kq", 1)), fine(sub("kg", "kq")))), "kc", "kq", 0, upTo(2, sub("km", 1))),
      mul(rename(rename(dyckPaths.epsil.rank, "_x", "kx"), "_n", "kn"), fine(sub("kg", "km"))),
    ),
    add(at("ke", 2), 1),
  ],
);
const rank: MathJSON = at(
  fold(iff(equal(at("ks", 1), 0), "ks", rankStep), "ks", "kb", ["List", N, 0, 1], upTo(1, blocks)),
  2,
);

// ─── membership: a Dyck path of semilength n none of whose ground-level up steps is followed by a
// down step. State [height, a hill was seen]. ──────────────────────────────────────────────────

const hills: MathJSON = fold(
  [
    "List",
    add(at("hs", 1), step("hj")),
    iff(
      and(equal(at("hs", 1), 0), equal(path("hj"), 1), less("hj", ["Length", "_x"])),
      iff(equal(path(add("hj", 1)), 0), 1, at("hs", 2)),
      at("hs", 2),
    ),
  ],
  "hs",
  "hj",
  ["List", 0, 0],
  upTo(1, ["Length", "_x"]),
);

export const finePaths: EpsilFamily = {
  head: "FinePaths",
  carrier: "DyckPath",
  paramCount: 1,
  kind: "ints",
  params: [N],
  epsil: {
    count: iff(less(N, 0), 0, fine(N)),
    tables,
    unrank,
    rank,
    valid: iff(dyckPaths.epsil.valid, equal(at(hills, 2), 0), "False"),
  },
};
