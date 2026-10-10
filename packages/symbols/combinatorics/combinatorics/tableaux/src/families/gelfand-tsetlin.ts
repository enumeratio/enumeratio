// GelfandTsetlin(n, k) in Epsil: the interlacing triangles of n rows, entries 0..k, listed row by row,
// top row first, the rows that fit under a row in lex order (a row's entries fall left to right). A
// row's place among them is found by walking them in that order and adding up how many triangles each starts:
// the triangles under a row a of length m are counted by Weyl's dimension formula
// ∏ᵢ<ⱼ (aᵢ − aⱼ + j − i)/(j − i), and all of them by ∏ᵢ≤ⱼ (k + i + j − 1)/(i + j − 1).
//
// A row under `above` has its entry i between above[i + 1] and above[i]; the top row's lie in 0..k,
// never above the entry before. The next row in lex order raises its last raisable entry by one and
// takes the least entries after it.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  choose,
  equal,
  fold,
  iff,
  len,
  less,
  lets,
  map,
  mul,
  primeQuotient,
  quotient,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

const n = "_n";
const k = "_k";
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, count: MathJSON): MathJSON => ["Drop", xs, count];
const take = (xs: MathJSON, count: MathJSON): MathJSON => ["Take", xs, count];
const length = (xs: MathJSON): MathJSON => ["Length", xs];
const zeros = (count: MathJSON): MathJSON => map(0, "gt_z", upTo(1, count));
const constant = (value: MathJSON, count: MathJSON): MathJSON => map(value, "gt_z", upTo(1, count));

/** How many pairs i < j of 1..m satisfy `condition(i, j)`. */
const pairs = (m: MathJSON, condition: (i: MathJSON, j: MathJSON) => MathJSON, tag: string): MathJSON =>
  fold(
    add(
      `${tag}_a`,
      fold(
        add(`${tag}_b`, iff(condition(`${tag}_i`, `${tag}_j`), 1, 0)),
        `${tag}_b`,
        `${tag}_j`,
        0,
        upTo(add(`${tag}_i`, 1), m),
      ),
    ),
    `${tag}_a`,
    `${tag}_i`,
    0,
    upTo(1, m),
  );

/** The triangles under the row bound as `row` (nonincreasing, of length m). */
const weyl = (row: string, m: MathJSON): MathJSON =>
  primeQuotient(
    "gw",
    add(k, m),
    (q) => pairs(m, (i, j) => equal(["Mod", add(sub(at(row, i), at(row, j)), sub(j, i)), q], 0), "gu"),
    (q) => pairs(m, (i, j) => equal(["Mod", sub(j, i), q], 0), "gv"),
  );

/** The number of rows between `lo` and `cap` (each entry between its own bounds): the product of the widths. */
const widths = (cap: string, lo: string, m: MathJSON): MathJSON =>
  fold(mul("gt_p", add(sub(at(cap, "gt_i"), at(lo, "gt_i")), 1)), "gt_p", "gt_i", 1, upTo(1, m));

/** The row after `cur` in order, `cur` itself when it is the last. */
const next = (cur: string, cap: string, lo: string, m: MathJSON): MathJSON => {
  const room = (i: MathJSON): MathJSON => iff(equal(i, 1), at(cap, 1), ["Min", at(cap, i), at(cur, sub(i, 1))]);
  const raised = fold(iff(less(at(cur, "gn_i"), room("gn_i")), "gn_i", "gn_r"), "gn_r", "gn_i", 0, upTo(1, m));
  return lets(
    [["gn_at", raised, "integer"]],
    iff(
      equal("gn_at", 0),
      cur,
      map(
        iff(
          less("gn_j", "gn_at"),
          at(cur, "gn_j"),
          iff(equal("gn_j", "gn_at"), add(at(cur, "gn_j"), 1), at(lo, "gn_j")),
        ),
        "gn_j",
        upTo(1, m),
      ),
    ),
  );
};

/** Whether the rows `a` and `b`, both of length m, are the same. */
const same = (a: string, b: string, m: MathJSON): MathJSON =>
  equal(0, fold(add("gt_d", ["Abs", sub(at(a, "gt_i"), at(b, "gt_i"))]), "gt_d", "gt_i", 0, upTo(1, m)));

/** Where the entries of level `level` start in the n(n + 1)/2 entries of a triangle's rows. */
const offset = (level: MathJSON): MathJSON =>
  sub(mul(sub(level, 1), add(n, 1)), quotient(mul(sub(level, 1), level), 2));

/**
 * The bounds a row of level `level` lies between, given the row above it in `flat` (the rows so far)
 * or, for the top, none: cap and lo as lists of the row's length m.
 */
const bounded = (level: MathJSON, flat: MathJSON, body: MathJSON): MathJSON =>
  lets(
    [
      ["gt_m", sub(add(n, 1), level), "integer"],
      [
        "gt_cap",
        iff(
          equal(level, 1),
          constant(k, sub(add(n, 1), level)),
          take(drop(flat, offset(sub(level, 1))), sub(add(n, 1), level)),
        ),
        "list<integer>",
      ],
      [
        "gt_lo",
        iff(
          equal(level, 1),
          zeros(sub(add(n, 1), level)),
          take(drop(flat, add(offset(sub(level, 1)), 1)), sub(add(n, 1), level)),
        ),
        "list<integer>",
      ],
    ],
    body,
  );

/** The rows under a level's bounds: how many there are (the top row's are the multisets of n from 0..k). */
const rowsAt = (level: MathJSON): MathJSON =>
  iff(equal(level, 1), choose(add(n, k), n), widths("gt_cap", "gt_lo", "gt_m"));

export const gelfandTsetlin: EpsilFamily = {
  head: "GelfandTsetlin",
  paramCount: 2,
  kind: "blocks",
  params: [n, k],
  // Walking the rows under each row takes the interpreter's seconds once a count passes 2^53.
  declinePastDoubles: true,
  epsil: {
    count: primeQuotient(
      "gc",
      sub(add(k, mul(2, n)), 1),
      (q) =>
        fold(
          add(
            "gc_a",
            fold(
              add("gc_b", iff(equal(["Mod", sub(add(k, "gc_i", "gc_j"), 1), q], 0), 1, 0)),
              "gc_b",
              "gc_j",
              0,
              upTo("gc_i", n),
            ),
          ),
          "gc_a",
          "gc_i",
          0,
          upTo(1, n),
        ),
      (q) =>
        fold(
          add(
            "gc_a",
            fold(
              add("gc_b", iff(equal(["Mod", sub(add("gc_i", "gc_j"), 1), q], 0), 1, 0)),
              "gc_b",
              "gc_j",
              0,
              upTo("gc_i", n),
            ),
          ),
          "gc_a",
          "gc_i",
          0,
          upTo(1, n),
        ),
    ),
    // The state is [rank left, the entries of the rows so far, n(n + 1)/2 of them]. At each level the
    // search walks the rows in order, its state [rank left, found, the row at hand]: a row whose
    // triangles hold the rank left is the row, else the rank passes them.
    unrank: (() => {
      const level = "gu_l";
      const search: MathJSON = fold(
        iff(
          equal(at("gu_s", 2), 1),
          "gu_s",
          lets(
            [
              ["gu_row", drop("gu_s", 2), "list<integer>"],
              ["gu_w", weyl("gu_row", "gt_m"), "integer"],
            ],
            iff(
              less(at("gu_s", 1), "gu_w"),
              join(list(at("gu_s", 1), 1), "gu_row"),
              join(list(sub(at("gu_s", 1), "gu_w"), 0), next("gu_row", "gt_cap", "gt_lo", "gt_m")),
            ),
          ),
        ),
        "gu_s",
        "gu_t",
        join(list(at("gu_state", 1), 0), "gt_lo"),
        upTo(1, rowsAt(level)),
      );
      const step = lets(
        [["gu_flat", drop("gu_state", 1), "list<integer>"]],
        bounded(
          level,
          "gu_flat",
          lets(
            [["gu_found", search, "list<integer>"]],
            join(
              list(at("gu_found", 1)),
              take("gu_flat", offset(level)),
              drop("gu_found", 2),
              drop("gu_flat", add(offset(level), "gt_m")),
            ),
          ),
        ),
      );
      return lets(
        [
          [
            "gu_end",
            fold(step, "gu_state", level, join(list("_r"), zeros(quotient(mul(n, add(n, 1)), 2))), upTo(1, n)),
            "list<integer>",
          ],
        ],
        map(take(drop("gu_end", add(offset("gu_i"), 1)), sub(add(n, 1), "gu_i")), "gu_i", upTo(1, n)),
      );
    })(),
    // Rank: the same walk, adding the triangles of each row before the row at each level.
    rank: (() => {
      const level = "gr_l";
      const flat = fold(join("gr_f", at("_x", "gr_i")), "gr_f", "gr_i", list(), upTo(1, len));
      const search = (target: string): MathJSON =>
        fold(
          iff(
            equal(at("gr_s", 2), 1),
            "gr_s",
            lets(
              [["gr_row", drop("gr_s", 2), "list<integer>"]],
              iff(
                same("gr_row", target, "gt_m"),
                join(list(at("gr_s", 1), 1), "gr_row"),
                join(list(add(at("gr_s", 1), weyl("gr_row", "gt_m")), 0), next("gr_row", "gt_cap", "gt_lo", "gt_m")),
              ),
            ),
          ),
          "gr_s",
          "gr_t",
          join(list(0, 0), "gt_lo"),
          upTo(1, rowsAt(level)),
        );
      return lets(
        [["gr_flat", flat, "list<integer>"]],
        fold(
          bounded(
            level,
            "gr_flat",
            lets(
              [["gr_target", take(drop("gr_flat", offset(level)), "gt_m"), "list<integer>"]],
              add("gr_acc", at(search("gr_target"), 1)),
            ),
          ),
          "gr_acc",
          level,
          0,
          upTo(1, n),
        ),
      );
    })(),
    // Rows n, n − 1, … 1 long, entries 0..k, falling along each row, interlacing with the row above.
    valid: iff(
      equal(len, n),
      and(
        all(
          (i) =>
            lets(
              [["gv_r", at("_x", i), "list<integer>"]],
              and(
                equal(length("gv_r"), sub(add(n, 1), i)),
                all(
                  (j) => and(["GreaterEqual", at("gv_r", j), 0], ["LessEqual", at("gv_r", j), k]),
                  upTo(1, length("gv_r")),
                  "gv_j",
                ),
                all((j) => ["GreaterEqual", at("gv_r", sub(j, 1)), at("gv_r", j)], upTo(2, length("gv_r")), "gv_k"),
              ),
            ),
          upTo(1, len),
          "gv_i",
        ),
        all(
          (i) =>
            lets(
              [["gv_a", at("_x", sub(i, 1)), "list<integer>"]],
              lets(
                [["gv_b", at("_x", i), "list<integer>"]],
                all(
                  (j) =>
                    and(
                      ["GreaterEqual", at("gv_a", j), at("gv_b", j)],
                      ["GreaterEqual", at("gv_b", j), at("gv_a", add(j, 1))],
                    ),
                  upTo(1, length("gv_b")),
                  "gv_m",
                ),
              ),
            ),
          upTo(2, len),
          "gv_l",
        ),
      ),
      "False",
    ),
  },
};
