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
   * How many members start with the prefix `prefix`: a list of n slots whose first `filled`
   * are set (a partial permutation, values distinct) and the rest 0. 0 when no member starts
   * so. Over the family's params and any `tables`.
   */
  readonly completions: MathJSON;
  /** Whether `_x`, a permutation of n, is a member. Default: its completions as a full
   *  prefix are 1. */
  readonly predicate?: MathJSON;
  /** Lists bound once around every operation, which `completions` and `predicate` may read. */
  readonly tables?: readonly (readonly [string, MathJSON])[];
}

const n = "_n";

/** `completions` at the prefix: slots before `slot` from `entry`, `value` at `slot`. */
const completionsAt = (
  spec: PermutationRestriction,
  entry: (q: string) => MathJSON,
  slot: MathJSON,
  value: MathJSON,
): MathJSON =>
  lets(
    [
      [
        "prefix",
        map(iff(equal("lr_q", slot), value, iff(less("lr_q", slot), entry("lr_q"), 0)), "lr_q", upTo(1, n)),
        "list<integer>",
      ],
      ["filled", slot, "integer"],
    ],
    spec.completions,
  );

/** Whether `value` is among `entry(1..slot − 1)`. */
const usedBefore = (entry: (q: string) => MathJSON, slot: MathJSON, value: MathJSON): MathJSON =>
  fold(["Or", "lr_seen", equal(entry("lr_t"), value)], "lr_seen", "lr_t", "False", upTo(1, sub(slot, 1)));

/** The family's definitions, from its completion count and predicate. */
export function permutationRestriction(spec: PermutationRestriction): EpsilFamily {
  const { completions: _completions, predicate: given, tables = [], ...shape } = spec;
  const withTables = (body: MathJSON): MathJSON =>
    lets(
      tables.map(([name, value]) => [name, value, "list<integer>"] as const),
      body,
    );

  // Unrank: the state is the n slots, then the rank still to go. At slot j, the free values are
  // tried in increasing order; each that doesn't hold the remaining rank takes its completions
  // off it.
  const state = (q: string): MathJSON => at("lr_s", q);
  const choose = fold(
    iff(
      ["NotEqual", at("lr_pick", 2), 0],
      "lr_pick",
      iff(
        usedBefore(state, "lr_j", "lr_v"),
        "lr_pick",
        lets(
          [["lr_c", completionsAt(spec, state, "lr_j", "lr_v"), "integer"]],
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
    map(
      iff(
        equal("lr_slot", "lr_j"),
        at("lr_chosen", 2),
        iff(equal("lr_slot", add(n, 1)), at("lr_chosen", 1), at("lr_s", "lr_slot")),
      ),
      "lr_slot",
      upTo(1, add(n, 1)),
    ),
  );
  const unrank = ["Most", fold(unrankStep, "lr_s", "lr_j", ["Append", map(0, "lr_y", upTo(1, n)), "_r"], upTo(1, n))];

  // Rank: at each slot, the members starting with every smaller free value come first.
  const element = (q: string): MathJSON => at("_x", q);
  const rank = fold(
    add(
      "lr_r",
      fold(
        add(
          "lr_r2",
          iff(
            and(less("lr_v", element("lr_j")), ["Not", usedBefore(element, "lr_j", "lr_v")]),
            completionsAt(spec, element, "lr_j", "lr_v"),
            0,
          ),
        ),
        "lr_r2",
        "lr_v",
        0,
        upTo(1, n),
      ),
    ),
    "lr_r",
    "lr_j",
    0,
    upTo(1, n),
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
    epsil: {
      count: withTables(count),
      unrank: withTables(unrank),
      rank: withTables(rank),
      valid: withTables(valid),
    },
  };
}
