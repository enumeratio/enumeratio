// LukasiewiczPaths in Epsil. The words are the preorder child counts (less one) of the plane
// trees on n edges, in the order of the trees' Dyck paths (the depth-first contour, up before
// down), so unrank and rank are the DyckPaths ones around a conversion between a word and its
// contour. A word is not a walk in that order: which of two words comes first depends on the
// open ancestors, so the walks framework doesn't take it. The word of a contour is one pass; the contour of a word an O(n²) fold.

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
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { put } from "../../../collections/src/families/nested.ts";
import { dyckPaths } from "./core.ts";

type MathJSON = unknown;

/** `expr` with the symbol `from` renamed `to`. */
const rename = (expr: MathJSON, from: string, to: string): MathJSON =>
  Array.isArray(expr) ? expr.map((e) => rename(e, from, to)) : expr === from ? to : expr;
const length = (list: MathJSON): MathJSON => ["Length", list];
const last = (list: MathJSON): MathJSON => at(list, length(list));
const downTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, -1];
/** The list of `f(x)` for x = from..to, `x` a bound name. */
const tabulate = (body: MathJSON, x: string, from: MathJSON, to: MathJSON): MathJSON => map(body, x, upTo(from, to));

/** The contour (a 1 up, 0 down list `path`) as a word: a node is the start (the root) or an up
 *  step, and has as many children as the up steps that leave it. One pass, an open node at each
 *  height: an up step gives the node below it a child and opens a new node (numbered in preorder),
 *  a down step closes the node it leaves and writes its children less one at its number.
 *  State: [height, nodes opened, children so far by height, the open node's number by height,
 *  the word (entry i + 1 the node numbered i)]. */
function wordOfContour(path: string): MathJSON {
  const rows = add("_n", 1);
  const state = "wc_s";
  const s = "wc_t";
  const [height, opened] = [at(s, 1), at(s, 2)];
  const childrenAt = (d: MathJSON): MathJSON => add(3, d);
  const numberAt = (d: MathJSON): MathJSON => add(3, rows, d);
  const wordAt = (node: MathJSON): MathJSON => add(3, mul(2, rows), node);
  const up = put(
    s,
    [1, add(height, 1)],
    [2, add(opened, 1)],
    [childrenAt(height), add(at(s, childrenAt(height)), 1)],
    [childrenAt(add(height, 1)), 0],
    [numberAt(add(height, 1)), add(opened, 1)],
  );
  const down = put(s, [1, sub(height, 1)], [wordAt(at(s, numberAt(height))), sub(at(s, childrenAt(height)), 1)]);
  const done = "wc_f";
  return lets(
    [
      [
        done,
        fold(
          lets([[s, state, "list<integer>"]], iff(equal("wc_u", 1), up, down)),
          state,
          "wc_u",
          ["Join", ["List", 0, 0], map(0, "wc_z", upTo(1, mul(3, rows)))],
          path,
        ),
        "list<integer>",
      ],
    ],
    // The root is still open at the end: its children are the first height's.
    ["Join", ["List", sub(at(done, 3), 1)], ["Drop", done, add(3, mul(2, rows))]],
  );
}

/** The contour of the word `_x`. Node i has depth d_i, the number of j < i whose subtree holds it:
 *  those with the prefix sum before j no more than every one from j to i − 1, counted backwards
 *  from i − 1 against the running least. Its up step is the (2i − d_i)-th of the path. */
const contourOfWord = (n: MathJSON): MathJSON => {
  const sums = "cw_q";
  const depths = "cw_d";
  const depth = (i: MathJSON): MathJSON =>
    at(
      fold(
        iff(["LessEqual", at(sums, "cw_m"), at("cw_s", 1)], ["List", at(sums, "cw_m"), add(at("cw_s", 2), 1)], "cw_s"),
        "cw_s",
        "cw_m",
        ["List", at(sums, add(i, 1)), 0],
        downTo(i, 1),
      ),
      2,
    );
  const isUp = (t: string): MathJSON =>
    fold(add("cw_c", iff(equal(sub(mul(2, "cw_i"), at(depths, "cw_i")), t), 1, 0)), "cw_c", "cw_i", 0, upTo(1, n));
  return lets(
    [
      // The prefix sums of the word, one before its first entry.
      [
        sums,
        fold(["Join", "cw_p", ["List", add(last("cw_p"), "cw_a")]], "cw_p", "cw_a", ["List", 0], "_x"),
        "list<integer>",
      ],
      [depths, tabulate(depth("cw_k"), "cw_k", 1, n), "list<integer>"],
    ],
    tabulate(isUp("cw_t"), "cw_t", 1, mul(2, n)),
  );
};

/** Membership: the slots still to fill start at 1; each entry fills one and opens a + 1 more. */
const validWord = (n: MathJSON): MathJSON =>
  and(
    equal(length("_x"), add(n, 1)),
    equal(
      fold(iff(["Or", ["LessEqual", "lv_s", 0], less("lv_a", -1)], -1, add("lv_s", "lv_a")), "lv_s", "lv_a", 1, "_x"),
      0,
    ),
  );

export const lukasiewiczPaths: EpsilFamily = {
  head: "LukasiewiczPaths",
  carrier: "LukasiewiczPath",
  paramCount: 1,
  kind: "ints",
  params: ["_n"],
  epsil: {
    count: dyckPaths.epsil.count,
    unrank: lets([["lu_p", dyckPaths.epsil.unrank, "list<integer>"]], wordOfContour("lu_p")),
    rank: lets([["lr_x", contourOfWord("_n"), "list<integer>"]], rename(dyckPaths.epsil.rank, "_x", "lr_x")),
    valid: validWord("_n"),
  },
};
