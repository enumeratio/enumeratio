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
import { add, all, and, at, equal, fold, iff, less, lets, map, mul, sub, upTo } from "./tables.ts";
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
  /**
   * Opt in to `taken`: a list over the values 1..n, 0 for a value no slot of `prefix` holds and
   * else the slot that holds it. `At(taken, v)` reads whether v is used in O(1). Read it only at 1..n.
   */
  readonly taken?: true;
  /**
   * Opt in to a prefix state `pstate`, a list carried beside `prefix` and updated by one `step`
   * per value placed, so `completions` reads what the prefix has built up instead of walking it.
   * `pstate` is the state after the prefix's `filled` slots. `init` is the state before any
   * (a list, over the family's params); `step` is the state after placing `value` at `slot`
   * (1-based), from `pstate`, `slot` and `value`. Read it only through `At`.
   */
  readonly state?: PrefixState;
  /** Whether `_x`, a permutation of n, is a member. Default: its completions as a full
   *  prefix are 1. */
  readonly predicate?: MathJSON;
  /** The list `completions` and `predicate` read under the name given, computed once per params
   *  (`FamilyEpsil.tables`). */
  readonly tables?: readonly [name: string, table: MathJSON];
}

/** A restriction's incremental prefix state (see `PermutationRestriction.state`). */
export interface PrefixState {
  readonly init: MathJSON;
  readonly step: MathJSON;
}

const n = "_n";

/** The state `spec.state` reaches from `from` by placing `value` at `slot`. */
const stepped = (spec: PermutationRestriction, from: MathJSON, slot: MathJSON, value: MathJSON): MathJSON =>
  lets(
    [
      ["pstate", from, "list<integer>"],
      ["slot", slot, "integer"],
      ["value", value, "integer"],
    ],
    spec.state!.step,
  );

/** `completions` at the prefix `base` with `value` set at `slot`: the entries before `slot` and
 *  zeros after. A native copy of `base` beats rebuilding the n slots entry by entry. `held` and
 *  `from` are the `taken` list and prefix state before `slot`, where the spec opts in. */
const completionsAt = (
  spec: PermutationRestriction,
  base: string,
  slot: MathJSON,
  value: MathJSON,
  held: string,
  from: string,
): MathJSON =>
  lets(
    [
      ["prefix", ["ReplaceAt", base, slot, value], "list<integer>"],
      ["filled", slot, "integer"],
      ...(spec.taken ? [["taken", ["ReplaceAt", held, value, slot], "list<integer>"] as const] : []),
      ...(spec.state ? [["pstate", stepped(spec, from, slot, value), "list<integer>"] as const] : []),
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

  const { state } = spec;
  const stateInit = state === undefined ? [] : [state.init];

  // Unrank: the state is the n slots, then the rank still to go, then per value the slot that
  // holds it (0 while free), then the prefix state where there is one: 2n + 1 slots and the
  // state. At slot j, the free values are tried in increasing order; each that doesn't hold the
  // remaining rank takes its completions off it.
  //
  // The step reads the state inside lambdas (the completions over the prefix), which
  // compute-engine's in-place Fold doesn't allow, so the state is copied once per slot.
  const slotHeld = (value: MathJSON): MathJSON => add(n, 1, value);
  const choose = fold(
    iff(
      ["NotEqual", at("lr_pick", 2), 0],
      "lr_pick",
      iff(
        ["NotEqual", at("lr_s", slotHeld("lr_v")), 0],
        "lr_pick",
        lets(
          [["lr_c", completionsAt(spec, "lr_s", "lr_j", "lr_v", "lr_tk", "lr_ps"), "integer"]],
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
  const placed = [
    "ReplaceAt",
    ["ReplaceAt", ["ReplaceAt", "lr_s", "lr_j", at("lr_chosen", 2)], add(n, 1), at("lr_chosen", 1)],
    slotHeld(at("lr_chosen", 2)),
    "lr_j",
  ];
  const unrankStep = lets(
    [
      // The lists the completions read, as they stand before slot j.
      ...(spec.taken ? [["lr_tk", ["Take", ["Drop", "lr_s", add(n, 1)], n], "list<integer>"] as const] : []),
      ...(state ? [["lr_ps", ["Drop", "lr_s", add(mul(2, n), 1)], "list<integer>"] as const] : []),
      ["lr_chosen", choose, "list<integer>"],
    ],
    state === undefined
      ? placed
      : ["Join", ["Take", placed, add(mul(2, n), 1)], stepped(spec, "lr_ps", "lr_j", at("lr_chosen", 2))],
  );
  const unrank = [
    "Take",
    fold(unrankStep, "lr_s", "lr_j", ["Join", zeros("lr_y"), ["List", "_r"], zeros("lr_y2"), ...stateInit], upTo(1, n)),
    n,
  ];

  // Rank: at each slot, the members starting with every smaller free value come first. Where
  // each value sits in the element says whether it is free past a slot, and fills in place.
  const element = (q: string): MathJSON => at("_x", q);
  const positions = fold(["ReplaceAt", "lr_at", element("lr_p"), "lr_p"], "lr_at", "lr_p", zeros("lr_y3"), upTo(1, n));
  const smaller = fold(
    add(
      "lr_r2",
      iff(
        ["Greater", at("lr_where", "lr_v"), "lr_j"],
        completionsAt(spec, "lr_base", "lr_j", "lr_v", "lr_tk", "lr_ps"),
        0,
      ),
    ),
    "lr_r2",
    "lr_v",
    0,
    upTo(1, sub(element("lr_j"), 1)),
  );
  // The prefix before slot j, and the lists the completions read of it.
  const beforeSlot = (inner: MathJSON): MathJSON =>
    lets(
      [
        ["lr_base", map(iff(less("lr_q", "lr_j"), element("lr_q"), 0), "lr_q", upTo(1, n)), "list<integer>"],
        ...(spec.taken
          ? [
              [
                "lr_tk",
                map(iff(less(at("lr_where", "lr_u"), "lr_j"), at("lr_where", "lr_u"), 0), "lr_u", upTo(1, n)),
                "list<integer>",
              ] as const,
            ]
          : []),
      ],
      inner,
    );
  const rank = lets(
    [["lr_where", positions, "list<integer>"]],
    state === undefined
      ? fold(add("lr_r", beforeSlot(smaller)), "lr_r", "lr_j", 0, upTo(1, n))
      : // The fold carries the rank, then the prefix state.
        [
          "At",
          fold(
            lets(
              [["lr_ps", ["Drop", "lr_acc", 1], "list<integer>"]],
              [
                "Join",
                ["List", add(at("lr_acc", 1), beforeSlot(smaller))],
                stepped(spec, "lr_ps", "lr_j", element("lr_j")),
              ],
            ),
            "lr_acc",
            "lr_j",
            ["Join", ["List", 0], state.init],
            upTo(1, n),
          ),
          1,
        ],
  );

  // The lists `completions` reads at a whole permutation (`_x` or the empty prefix).
  const emptyLists = (): (readonly [string, MathJSON, string])[] => [
    ...(spec.taken ? [["taken", zeros("lr_t0"), "list<integer>"] as const] : []),
    ...(state ? [["pstate", state.init, "list<integer>"] as const] : []),
  ];
  const fullLists = (): (readonly [string, MathJSON, string])[] => [
    ...(spec.taken
      ? [
          [
            "taken",
            fold(["ReplaceAt", "lr_iv", element("lr_ip"), "lr_ip"], "lr_iv", "lr_ip", zeros("lr_t1"), upTo(1, n)),
            "list<integer>",
          ] as const,
        ]
      : []),
    ...(state
      ? [
          [
            "pstate",
            fold(stepped(spec, "lr_pa", "lr_pj", element("lr_pj")), "lr_pa", "lr_pj", state.init, upTo(1, n)),
            "list<integer>",
          ] as const,
        ]
      : []),
  ];

  const count = lets(
    [["prefix", map(0, "lr_y", upTo(1, n)), "list<integer>"], ["filled", 0, "integer"], ...emptyLists()],
    spec.completions,
  );

  const predicate =
    given ??
    equal(lets([["prefix", "_x", "list<integer>"], ["filled", n, "integer"], ...fullLists()], spec.completions), 1);
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
