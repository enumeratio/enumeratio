// A family of runs of positive parts adding up to a total, listed by the first part that differs:
// the parts smallest first (compositions) or largest first (partitions). A part is chosen with
// the number of ways what is left can finish, read from a table of completions over the sum left
// and a context, a small integer carrying what the next part depends on (a cap, the last part,
// parts to go). Unranking places each part in turn, skipping past the runs each smaller choice
// would have started; ranking adds those skipped counts up.
//
// Shared by the partition and composition families that are completion counts of this shape.

import type { EpsilFamily } from "./epsil.ts";
import { add, all, and, at, cell, equal, fold, iff, less, lets, mul, quotient, rowTable, sub, upTo } from "./tables.ts";
import type { FamilyShape } from "./types.ts";

type MathJSON = unknown;

export interface PartWalk extends Omit<FamilyShape, "kind"> {
  /** The names the definitions give the family's params, in order. */
  readonly params: readonly string[];
  /** The sum the parts add up to. */
  readonly total: MathJSON;
  /** Parts come smallest first, or largest first. */
  readonly order: "smallest first" | "largest first";
  /** The contexts are 0..width − 1 (default 1: just 0); the walk starts at `start` (default 0). */
  readonly width?: MathJSON;
  readonly start?: MathJSON;
  /** Whether the parts may stop at context c with nothing left to place (default: always). */
  readonly ends?: (c: MathJSON) => MathJSON;
  /** The largest part at context c (default: whatever sum is left). */
  readonly limit?: (c: MathJSON) => MathJSON;
  /** Whether part p, within the limit and the sum left, may come at context c (default: always). */
  readonly allows?: (c: MathJSON, p: MathJSON) => MathJSON;
  /** Whether part p is in the family's set of parts, whatever the context, in place of `allows`. The test
   *  is run once per part, not once per cell, and the members ride on the end of the table. Smallest first only. */
  readonly parts?: (p: MathJSON) => MathJSON;
  /** The context after part p at context c (default: the same one). */
  readonly next?: (c: MathJSON, p: MathJSON) => MathJSON;
  /** The table's cell at sum m ≥ 1 and context c, where a recurrence is cheaper than the sum over
   *  the next part (default: that sum): `read` takes the cells of earlier sums, `here` those of
   *  this sum at earlier contexts, so the contexts are numbered with each cell after the ones it reads. */
  readonly recurrence?: (
    read: (m: MathJSON, c: MathJSON) => MathJSON,
    here: (c: MathJSON) => MathJSON,
    m: MathJSON,
    c: MathJSON,
  ) => MathJSON;
}

const integer = "integer";
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];

/** The family's definitions, from its context and the parts it allows. */
export function partWalk(spec: PartWalk): EpsilFamily {
  const { total, order, width = 1, start = 0, ends, limit, allows: given, parts, next, recurrence, ...shape } = spec;
  const allows = parts === undefined ? given : (_c: MathJSON, p: MathJSON): MathJSON => parts(p);
  const room = (m: MathJSON, c: MathJSON): MathJSON => (limit === undefined ? m : ["Min", m, limit(c)]);
  const ok = (c: MathJSON, p: MathJSON): MathJSON => (allows === undefined ? "True" : allows(c, p));
  const after = (c: MathJSON, p: MathJSON): MathJSON => (next === undefined ? c : next(c, p));
  const stops = (c: MathJSON): MathJSON => (ends === undefined ? 1 : iff(ends(c), 1, 0));
  const T = cell("_tables", width);

  // A set of parts is tested once per part (1 … total); its members, ascending and counted, ride on the
  // end of the table, where the operations that read it find them. The table's cells and every search
  // then try the members alone, not every size up to the sum left.
  const set = "pw_set";
  const offset = mul(add(total, 1), width);
  const members: MathJSON = at("_tables", add(offset, 1));
  const member = (j: MathJSON): MathJSON => at("_tables", add(offset, 1, j));
  if (parts !== undefined && order !== "smallest first") throw new Error("a set of parts is read smallest first");

  // T(m, c): the ways to place parts adding up to m from context c. Row 0 is whether to stop.
  const cells = rowTable("pw", add(total, 1), width, stops, (prev, m, c, here) => {
    if (recurrence !== undefined) return recurrence(prev, here, m, c);
    if (parts === undefined)
      return fold(
        add("pw_a", iff(ok(c, "pw_p"), prev(sub(m, "pw_p"), after(c, "pw_p")), 0)),
        "pw_a",
        "pw_p",
        0,
        upTo(1, room(m, c)),
      );
    const part = at(set, "pw_j");
    return fold(
      add("pw_a", iff(["LessEqual", part, room(m, c)], prev(sub(m, part), after(c, part)), 0)),
      "pw_a",
      "pw_j",
      0,
      upTo(1, ["Length", set]),
    );
  });
  const tables =
    parts === undefined
      ? cells
      : lets(
          [
            [
              set,
              fold(
                iff(parts("pw_x"), ["Join", "pw_l", ["List", "pw_x"]], "pw_l"),
                "pw_l",
                "pw_x",
                ["List"],
                upTo(1, total),
              ),
              "list<integer>",
            ],
          ],
          ["Join", cells, ["List", ["Length", set]], set],
        );

  /** The parts that sort before `p` at (m, c): those tried first, within the room. */
  const before = (m: MathJSON, c: MathJSON, p: MathJSON): MathJSON =>
    order === "smallest first" ? upTo(1, sub(p, 1)) : upTo(add(p, 1), room(m, c));
  const skipped = (m: MathJSON, c: MathJSON, p: MathJSON): MathJSON =>
    parts === undefined
      ? fold(
          add("pw_s", iff(ok(c, "pw_q"), T(sub(m, "pw_q"), after(c, "pw_q")), 0)),
          "pw_s",
          "pw_q",
          0,
          before(m, c, p),
        )
      : fold(
          add("pw_s", iff(less(member("pw_j"), p), T(sub(m, member("pw_j")), after(c, member("pw_j"))), 0)),
          "pw_s",
          "pw_j",
          0,
          upTo(1, members),
        );

  // Unrank: the state is [sum left, context, rank left, the parts so far…]. Each part is the
  // first, in order, whose completions pass the rank left; the search carries [rank left, part].
  const candidates =
    parts !== undefined
      ? upTo(1, members)
      : order === "smallest first"
        ? upTo(1, room("pw_m", "pw_c"))
        : ["Range", room("pw_m", "pw_c"), 1, -1];
  // The candidate part, and whether it may come: a member of the set that fits, or an allowed size.
  const candidate = parts === undefined ? "pw_p" : member("pw_j");
  const fits = parts === undefined ? ok("pw_c", "pw_p") : ["LessEqual", candidate, room("pw_m", "pw_c")];
  const choice = fold(
    iff(
      ["NotEqual", at("pw_pick", 2), 0],
      "pw_pick",
      iff(
        fits,
        lets(
          [["pw_k", T(sub("pw_m", candidate), after("pw_c", candidate)), integer]],
          iff(
            less(at("pw_pick", 1), "pw_k"),
            list(at("pw_pick", 1), candidate),
            list(sub(at("pw_pick", 1), "pw_k"), 0),
          ),
        ),
        "pw_pick",
      ),
    ),
    "pw_pick",
    parts === undefined ? "pw_p" : "pw_j",
    list("pw_r", 0),
    candidates,
  );
  const unrankStep = lets(
    [
      ["pw_m", at("pw_u", 1), integer],
      ["pw_c", at("pw_u", 2), integer],
      ["pw_r", at("pw_u", 3), integer],
    ],
    iff(
      equal("pw_m", 0),
      "pw_u",
      lets(
        [["pw_chosen", choice, "list<integer>"]],
        [
          "Join",
          list(sub("pw_m", at("pw_chosen", 2)), after("pw_c", at("pw_chosen", 2)), at("pw_chosen", 1)),
          ["Drop", "pw_u", 3],
          list(at("pw_chosen", 2)),
        ],
      ),
    ),
  );
  const unrank = ["Drop", fold(unrankStep, "pw_u", "pw_i", list(total, start, "_r"), upTo(1, total)), 3];

  // Rank: the state is [rank so far, sum left, context]; each part adds up the runs that start
  // with a part that sorts before it.
  const rankStep = lets(
    [
      ["pw_r", at("pw_a", 1), integer],
      ["pw_m", at("pw_a", 2), integer],
      ["pw_c", at("pw_a", 3), integer],
    ],
    list(add("pw_r", skipped("pw_m", "pw_c", "pw_x")), sub("pw_m", "pw_x"), after("pw_c", "pw_x")),
  );
  const rank = at(fold(rankStep, "pw_a", "pw_x", list(0, total, start), "_x"), 1);

  // Valid: the state is [every part so far fits, sum left, context]; a run is a member when it
  // fits, uses up the sum and may stop where it is.
  const validStep = lets(
    [
      ["pw_f", at("pw_v", 1), integer],
      ["pw_m", at("pw_v", 2), integer],
      ["pw_c", at("pw_v", 3), integer],
    ],
    iff(
      and(
        equal("pw_f", 1),
        ["GreaterEqual", "pw_y", 1],
        ["LessEqual", "pw_y", room("pw_m", "pw_c")],
        ok("pw_c", "pw_y"),
      ),
      list(1, sub("pw_m", "pw_y"), after("pw_c", "pw_y")),
      list(0, 0, 0),
    ),
  );
  const valid = lets(
    [["pw_end", fold(validStep, "pw_v", "pw_y", list(1, total, start), "_x"), "list<integer>"]],
    and(equal(at("pw_end", 1), 1), equal(at("pw_end", 2), 0), ["NotEqual", stops(at("pw_end", 3)), 0]),
  );

  return {
    ...shape,
    kind: "ints",
    epsil: { tables, count: T(total, start), unrank, rank, valid },
  };
}

/** Sets of parts, as a test of a part `p` (the name of a variable, at least 1): each reads `p`
 *  with a search up to it, so these are for a table built once, not for every cell of a big one. */
const exists = (condition: (k: string) => MathJSON, tag: string, p: MathJSON): MathJSON =>
  fold(["Or", `${tag}_f`, condition(`${tag}_k`)], `${tag}_f`, `${tag}_k`, "False", upTo(1, p));
export const partSets = {
  odd: (p: MathJSON): MathJSON => equal(["Mod", p, 2], 1),
  square: (p: MathJSON): MathJSON => exists((k) => equal(mul(k, k), p), "sq", p),
  triangular: (p: MathJSON): MathJSON => exists((k) => equal(mul(k, add(k, 1)), mul(2, p)), "tr", p),
  prime: (p: MathJSON): MathJSON =>
    and(
      ["GreaterEqual", p, 2],
      all((d) => ["NotEqual", ["Mod", p, d], 0], upTo(2, sub(p, 1)), "pr_d"),
    ),
  /** Halving while even leaves 1. */
  powerOfTwo: (p: MathJSON): MathJSON =>
    equal(fold(iff(equal(["Mod", "pt_s", 2], 0), quotient("pt_s", 2), "pt_s"), "pt_s", "pt_k", p, upTo(1, p)), 1),
} as const;
