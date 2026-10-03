// A restriction of a lex-ordered base, in the order the base gives it
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Restrictions): the k-th member is
// the k-th element of the base, in its order, that the restriction contains. The base builds
// its elements left to right; the restriction says only how many of its members start with a
// given prefix. Unranking chooses each entry in turn, smallest first, skipping past the members
// each smaller choice would have started; ranking adds those skipped counts up.
//
// The base here is the permutations of n in lex order (`SymmetricGroup`): n slots, each filled
// with a value not used before it.

import type { EpsilFamily } from "./epsil.ts";
import { add, all, and, at, equal, fold, iff, less, lets, map, sub, upTo } from "./tables.ts";
import type { FamilyShape } from "./types.ts";

type MathJSON = unknown;

export interface PermutationRestriction extends Omit<FamilyShape, "kind"> {
  /** The names the definitions give the family's params, in order; the first is n. */
  readonly params: readonly string[];
  /**
   * How many members start with the prefix `prefix`: a list whose first n slots hold a partial
   * permutation (the first `filled` set, values distinct, and the rest 0); slots past n are
   * scratch, so read it only at 1..n and never by `Length`. 0 when no member starts so. Over
   * the family's params and any `tables`.
   */
  readonly completions: MathJSON;
  /** Whether `_x`, a permutation of n, is a member. Default: its completions as a full
   *  prefix are 1. */
  readonly predicate?: MathJSON;
  /** The list `completions` and `predicate` read under the name given, computed once per params
   *  (`FamilyEpsil.tables`). */
  readonly tables?: readonly [name: string, table: MathJSON];
}

const n = "_n";

/** `completions` at the prefix `base` with `value` set at `slot`: the entries before `slot` and
 *  zeros after. A native copy of `base` beats rebuilding the n slots entry by entry. */
const completionsAt = (spec: PermutationRestriction, base: string, slot: MathJSON, value: MathJSON): MathJSON =>
  lets(
    [
      ["prefix", ["ReplaceAt", base, slot, value], "list<integer>"],
      ["filled", slot, "integer"],
    ],
    spec.completions,
  );

const zeros = (variable: string): MathJSON => map(0, variable, upTo(1, n));

/** The family's definitions, from its completion count and predicate. */
export function permutationRestriction(spec: PermutationRestriction): EpsilFamily {
  const { completions: _completions, predicate: given, tables, ...shape } = spec;
  // The kernel binds the table as `_tables`; the definitions read it under their own name.
  const withTables = (body: MathJSON): MathJSON =>
    tables === undefined ? body : lets([[tables[0], "_tables", "list<integer>"]], body);

  // Unrank: the state is the n slots, then the rank still to go, then a flag per value (1 once
  // it is placed): 2n + 1 slots. At slot j, the free values are tried in increasing order; each
  // that doesn't hold the remaining rank takes its completions off it.
  //
  // The step reads the state inside lambdas (the completions fold over the prefix), which
  // compute-engine's in-place Fold doesn't allow, so the state is copied once per slot.
  const slotFlag = (value: MathJSON): MathJSON => add(n, 1, value);
  const choose = fold(
    iff(
      ["NotEqual", at("lr_pick", 2), 0],
      "lr_pick",
      iff(
        equal(at("lr_s", slotFlag("lr_v")), 1),
        "lr_pick",
        lets(
          [["lr_c", completionsAt(spec, "lr_s", "lr_j", "lr_v"), "integer"]],
          iff(
            less(at("lr_pick", 1), "lr_c"),
            ["List", at("lr_pick", 1), "lr_v"],
            ["List", sub(at("lr_pick", 1), "lr_c"), 0],
          ),
        ),
      ),
    ),
    "lr_pick",
    "lr_v",
    ["List", at("lr_s", add(n, 1)), 0],
    upTo(1, n),
  );
  const unrankStep = lets(
    [["lr_chosen", choose, "list<integer>"]],
    [
      "ReplaceAt",
      ["ReplaceAt", ["ReplaceAt", "lr_s", "lr_j", at("lr_chosen", 2)], add(n, 1), at("lr_chosen", 1)],
      slotFlag(at("lr_chosen", 2)),
      1,
    ],
  );
  const unrank = [
    "Take",
    fold(unrankStep, "lr_s", "lr_j", ["Join", zeros("lr_y"), ["List", "_r"], zeros("lr_y2")], upTo(1, n)),
    n,
  ];

  // Rank: at each slot, the members starting with every smaller free value come first. Where
  // each value sits in the element says whether it is free past a slot, and fills in place.
  const element = (q: string): MathJSON => at("_x", q);
  const positions = fold(["ReplaceAt", "lr_at", element("lr_p"), "lr_p"], "lr_at", "lr_p", zeros("lr_y3"), upTo(1, n));
  const rank = lets(
    [["lr_where", positions, "list<integer>"]],
    fold(
      add(
        "lr_r",
        lets(
          [["lr_base", map(iff(less("lr_q", "lr_j"), element("lr_q"), 0), "lr_q", upTo(1, n)), "list<integer>"]],
          fold(
            add(
              "lr_r2",
              iff(["Greater", at("lr_where", "lr_v"), "lr_j"], completionsAt(spec, "lr_base", "lr_j", "lr_v"), 0),
            ),
            "lr_r2",
            "lr_v",
            0,
            upTo(1, sub(element("lr_j"), 1)),
          ),
        ),
      ),
      "lr_r",
      "lr_j",
      0,
      upTo(1, n),
    ),
  );

  const count = lets(
    [
      ["prefix", map(0, "lr_y", upTo(1, n)), "list<integer>"],
      ["filled", 0, "integer"],
    ],
    spec.completions,
  );

  const predicate =
    given ??
    equal(
      lets(
        [
          ["prefix", "_x", "list<integer>"],
          ["filled", n, "integer"],
        ],
        spec.completions,
      ),
      1,
    );
  // Membership needs a permutation of n before the predicate can read it.
  const valid = iff(
    equal(["Length", "_x"], n),
    iff(
      all(
        (j) =>
          and(
            ["LessEqual", 1, element(j)],
            ["LessEqual", element(j), n],
            all((i) => ["NotEqual", element(i), element(j)], upTo(1, sub(j, 1)), `${j}_i`),
          ),
        upTo(1, n),
        "lr_vj",
      ),
      predicate,
      "False",
    ),
    "False",
  );

  return {
    ...shape,
    kind: "ints",
    // Completion counting interpreted with exact integers takes minutes past 2^53.
    declinePastDoubles: true,
    epsil: {
      count: withTables(count),
      unrank: withTables(unrank),
      rank: withTables(rank),
      valid: withTables(valid),
      ...(tables === undefined ? {} : { tables: tables[1] }),
    },
  };
}
