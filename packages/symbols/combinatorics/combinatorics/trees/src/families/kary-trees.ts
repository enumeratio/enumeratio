// BinaryTrees and FullKAryTrees in Epsil: the trees as nested lists (a leaf 0, a node the list of its
// k children), listed in the order of their preorder arity words (./kary-words.ts). Unrank builds the
// tree from the word and rank and membership read it back into one (./nested.ts).

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { and, at, equal, iff, less, lets } from "../../../collections/src/families/tables.ts";
import { karyWord } from "./kary-words.ts";
import { ANY, buildFromWord, readKAry, rename } from "../../../collections/src/families/nested.ts";

type MathJSON = unknown;

/** The family of full k-ary trees with n internal nodes: `params` name n (and k, unless fixed). */
function karyTrees(head: string, carrier: string, params: readonly string[], k: MathJSON): EpsilFamily {
  const word = karyWord(k);
  const length = word.wordLength;
  // No tree has fewer than one child per node.
  const noArity = less(k, 1);
  return {
    head,
    carrier,
    paramCount: params.length as 1 | 2,
    kind: "nested",
    params,
    // Interpreting the stack walks takes seconds a call past 2^53, so unrank and rank decline there.
    declinePastDoubles: true,
    epsil: {
      count: iff(noArity, 0, word.count),
      tables: word.tables,
      unrank: lets([["kw", word.unrank, "list<integer>"]], buildFromWord("kw", length, 0)),
      rank: lets(
        [
          ["kr", readKAry("_x", k, length), ANY],
          ["kw", ["Take", ["Drop", "kr", 3], length], "list<integer>"],
        ],
        rename(word.rank, "_x", "kw"),
      ),
      valid: iff(
        noArity,
        "False",
        lets(
          [["kr", readKAry("_x", k, length), ANY]],
          and(equal(at("kr", 1), 0), equal(at("kr", 2), length), equal(at("kr", 3), 0)),
        ),
      ),
    },
  };
}

/** Binary trees with n internal nodes: the full 2-ary trees. */
export const binaryTrees = karyTrees("BinaryTrees", "BinaryTree", ["_n"], 2);
export const fullKAryTrees = karyTrees("FullKAryTrees", "FullKAryTree", ["_n", "_k"], "_k");
