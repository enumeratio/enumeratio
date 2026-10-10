// Nested elements in Epsil. A tree written as nested lists is built and read with the explicit
// stacks the flat tree families walk with (./stack.ts), since nothing recurses in Epsil: a tree is
// built from its preorder arity word by reading the word backwards with a stack of finished
// subtrees, and read into a word by expanding a stack of subtrees from the root. Each machine is a
// fold over a state list whose first entries are scalars and whose cells hold subtrees, so the
// state is bound with the type `list<any>`: an untyped lambda applied to a list maps over it.

import { add, at, equal, fold, iff, lets, map, mul, sub, upTo } from "./tables.ts";

type MathJSON = unknown;

/** A list of `count` zeros. */
export const zeros = (count: MathJSON): MathJSON => map(0, "nz", upTo(1, count));

export const ANY = "list<any>";
export const downTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, -1];
/** Whether the nested value `x` is a leaf, an integer: `Equal` of a list threads over its entries. */
export const isInteger = (x: MathJSON): MathJSON => ["Element", x, "Integers"];

/** `state` with each (position, value) written, in order. */
export const put = (state: MathJSON, ...cells: readonly (readonly [MathJSON, MathJSON])[]): MathJSON =>
  cells.reduce<MathJSON>((s, [position, value]) => ["ReplaceAt", s, position, value], state);

/** `expr` with the symbol `from` renamed `to`. */
export const rename = (expr: MathJSON, from: string, to: string): MathJSON =>
  Array.isArray(expr) ? expr.map((e) => rename(e, from, to)) : expr === from ? to : expr;

/**
 * The tree whose preorder arity word is `word` (a bound list of `length` entries, an entry the
 * number of its node's children). The word is read from its end: a node takes the top `arity`
 * subtrees of the stack, the first child on top, and is itself pushed as one, `leaf` when it has
 * none. State: [height, the stack's cells…]; the tree is the first cell.
 */
export function buildFromWord(word: string, length: MathJSON, leaf: MathJSON): MathJSON {
  const height = at("bt", 1);
  const state = fold(
    lets(
      [
        ["bt", "bs", ANY],
        ["ba", at(word, "bj"), "integer"],
      ],
      put(
        "bs",
        [1, add(sub(height, "ba"), 1)],
        [
          add(sub(height, "ba"), 2),
          iff(
            equal("ba", 0),
            leaf,
            // The i-th child is i cells below the top; cells start at position 2.
            map(at("bt", sub(add(height, 2), "bi")), "bi", upTo(1, "ba")),
          ),
        ],
      ),
    ),
    "bs",
    "bj",
    ["Join", ["List", 0], zeros(length)],
    downTo(length, 1),
  );
  return at(state, 2);
}

/**
 * The preorder arity word of the nested full `k`-ary tree `tree` (a leaf 0, a node the list of its
 * k children), read from `length` nodes: a stack of subtrees starting at the root, each step popping
 * one and pushing a node's children with the first on top. State: [height, words written, bad,
 * the word's `length` slots, the stack's cells…]. A tree that is not full k-ary, or has other
 * than `length` nodes, ends with `bad` 1, a height above 0 or fewer than `length` words.
 */
export function readKAry(tree: MathJSON, k: MathJSON, length: MathJSON): MathJSON {
  const cell = (c: MathJSON): MathJSON => add(length, 3, c);
  const height = at("ft", 1);
  const written = at("ft", 2);
  const item = at("ft", cell(at("ft", 1)));
  const slot = add(written, 4);
  const done = (arity: MathJSON, newHeight: MathJSON, bad: MathJSON): MathJSON =>
    put("ft", [1, newHeight], [2, add(written, 1)], [3, bad], [slot, arity]);
  return fold(
    lets(
      [["ft", "fs", ANY]],
      iff(
        equal(height, 0),
        "ft",
        iff(
          isInteger(item),
          done(0, sub(height, 1), iff(equal(item, 0), at("ft", 3), 1)),
          iff(
            equal(["Length", item], k),
            fold(
              ["ReplaceAt", "fa", cell(sub(add(height, "fi"), 1)), at(item, sub(add(k, 1), "fi"))],
              "fa",
              "fi",
              done(k, sub(add(height, k), 1), at("ft", 3)),
              upTo(1, k),
            ),
            done(k, sub(height, 1), 1),
          ),
        ),
      ),
    ),
    "fs",
    "fj",
    ["Join", ["List", 1, 0, 0], zeros(length), ["List", tree], zeros(mul(k, length))],
    upTo(1, length),
  );
}

/**
 * The ordered tree of the Dyck path `path` (a bound list of `length` entries, 1 up and 0 down): a
 * stack of the child lists being built, an up step opening an empty one and a down step closing the
 * top one and appending it to the one below. State: [height, the stack's cells…]; the tree, the
 * root's children, is the first cell.
 */
export function buildFromDyck(path: string, length: MathJSON): MathJSON {
  const height = at("ot", 1);
  const state = fold(
    lets(
      [["ot", "os", ANY]],
      iff(
        equal(at(path, "oj"), 1),
        put("os", [1, add(height, 1)], [add(height, 2), ["List"]]),
        put("os", [1, sub(height, 1)], [height, ["Join", at("ot", height), ["List", at("ot", add(height, 1))]]]),
      ),
    ),
    "os",
    "oj",
    ["Join", ["List", 1, ["List"]], zeros(length)],
    upTo(1, length),
  );
  return at(state, 2);
}

/**
 * The Dyck path of the ordered tree `tree` with `edges` edges, a node being the list of its
 * children and a leaf the empty list. The tree sits under a root of its own, so the walk writes the
 * path of 2 (edges + 1) steps and the tree's is what lies between its first and last. A stack of
 * items, each a subtree still to open (kind 1) or the down step its parent owes (kind 0); opening
 * one writes an up step and replaces it by its down step with its children above, the first on top.
 * State: [height, steps written, bad, the path's slots, the kinds, the cells]; the walk is sound
 * when it ends at height 0 with every slot written and bad 0.
 */
export function readOrdered(tree: MathJSON, edges: MathJSON): MathJSON {
  const steps = mul(2, add(edges, 1));
  const room = add(mul(2, edges), 4);
  const kindAt = (c: MathJSON): MathJSON => add(steps, 3, c);
  const cellAt = (c: MathJSON): MathJSON => add(steps, 3, room, c);
  const height = at("ft", 1);
  const written = at("ft", 2);
  const slot = add(written, 4);
  const item = at("ft", cellAt(height));
  const children = ["Length", item];
  const open = (a: MathJSON): MathJSON =>
    fold(
      put("fa", [cellAt(add(height, "fi")), at(item, sub(add(a, 1), "fi"))], [kindAt(add(height, "fi")), 1]),
      "fa",
      "fi",
      put("ft", [1, add(height, a)], [2, add(written, 1)], [slot, 1], [kindAt(height), 0]),
      upTo(1, a),
    );
  return fold(
    lets(
      [["ft", "fs", ANY]],
      iff(
        equal(height, 0),
        "ft",
        iff(
          equal(at("ft", kindAt(height)), 0),
          put("ft", [1, sub(height, 1)], [2, add(written, 1)], [slot, 0]),
          iff(
            isInteger(item),
            put("ft", [1, sub(height, 1)], [3, 1]),
            iff(["Greater", add(height, children), room], put("ft", [1, sub(height, 1)], [3, 1]), open(children)),
          ),
        ),
      ),
    ),
    "fs",
    "fj",
    ["Join", ["List", 1, 0, 0], zeros(steps), ["List", 1], zeros(sub(room, 1)), ["List", tree], zeros(sub(room, 1))],
    upTo(1, steps),
  );
}
