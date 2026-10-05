// Lattice paths as walks in Epsil: a path is a word of steps, each a token with a rise (−1, 0 or
// +1) and a width, staying at height ≥ 0 and ending at 0 once its widths sum to the total. Paths
// are ordered by trying the steps in the order given, so a step's rank contribution is the
// completions of the steps tried before it; the completions T(w, y) (width w left, height y) are
// a table built once per params (`FamilyEpsil.tables`). Unrank and rank walk the path with the
// table; membership is the walk alone.

import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import {
  add,
  and,
  at,
  cell,
  equal,
  fold,
  iff,
  less,
  lets,
  mul,
  rowTable,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

export interface Step {
  readonly token: number;
  readonly rise: -1 | 0 | 1;
  readonly width: 1 | 2;
  /** Taken only above the ground: a level step at height 0 is not a step of the walk. */
  readonly aboveGround?: true;
}

/** The ways to finish from width `w` and height `y`, `reached` (0 or 1) the walk's flag. */
export type Completions = (w: MathJSON, y: MathJSON, reached: MathJSON) => MathJSON;

export interface Walk {
  readonly head: string;
  readonly carrier: string;
  readonly params: readonly string[];
  /** The total width. */
  readonly width: MathJSON;
  readonly steps: readonly Step[];
  /** The tables `completions` reads. `FamilyEpsil.tables` is one list, so they are joined end to
   *  end; `completions` reads each as `_tables` at the offset of the cells before it. */
  readonly tables: readonly MathJSON[];
  readonly completions: Completions;
  /** The flag at the start, and after a step of `rise` lands at height y; 1 throughout when omitted. */
  readonly flag?: {
    readonly initial: MathJSON;
    readonly after: (reached: MathJSON, y: MathJSON, rise: -1 | 0 | 1) => MathJSON;
  };
  /** A condition on the highest height a member reaches. */
  readonly top?: (top: MathJSON) => MathJSON;
  /** A condition on the flag a member ends with; membership then walks the flag too. */
  readonly final?: (flag: MathJSON) => MathJSON;
  /** For tables the interpreter takes minutes to build past 2^53: unrank and rank decline there. */
  readonly declinePastDoubles?: true;
  readonly fast?: FastKernel;
}

const flagAfter = (walk: Walk, reached: MathJSON, y: MathJSON, rise: -1 | 0 | 1): MathJSON =>
  walk.flag === undefined ? 1 : walk.flag.after(reached, y, rise);

/** The completions of step i from (w, y): 0 where it doesn't fit or dips below 0. */
function choice(walk: Walk, i: number, w: MathJSON, y: MathJSON, reached: MathJSON): MathJSON {
  const { rise, width, aboveGround } = walk.steps[i];
  const landing = add(y, rise);
  const fits = and(
    ["LessEqual", width, w],
    ["GreaterEqual", landing, 0],
    ...(aboveGround ? [["GreaterEqual", y, 1]] : []),
  );
  return iff(fits, walk.completions(sub(w, width), landing, flagAfter(walk, reached, landing, rise)), 0);
}

/**
 * The step a walk takes from (w, y): step i when `taken(i, through)` holds, `through` the
 * completions of steps 0..i, giving `pick(i, before)`, `before` those of the steps before it.
 * A step's completions are found only once the steps before it are passed over, and the last
 * step's never.
 */
function stepFrom(
  walk: Walk,
  tag: string,
  [w, y, reached]: readonly MathJSON[],
  taken: (i: number, through: MathJSON) => MathJSON,
  pick: (i: number, before: MathJSON) => MathJSON,
): MathJSON {
  const from = (i: number, before: MathJSON): MathJSON => {
    if (i === walk.steps.length - 1) return pick(i, before);
    const count = `${tag}${i}`;
    const through = i === 0 ? count : add(before, count);
    return lets(
      [[count, choice(walk, i, w, y, reached), "integer"]],
      iff(taken(i, through), pick(i, before), from(i + 1, through)),
    );
  };
  return from(0, 0);
}

/** Unrank: the state is [r, y, w, reached, tokens…]; a step with no width left changes nothing. */
function unrank(walk: Walk): MathJSON {
  const state = "us";
  const [r, y, w, reached] = [1, 2, 3, 4].map((i) => at(state, i));
  const step = iff(
    equal(w, 0),
    state,
    stepFrom(
      walk,
      "uc",
      [w, y, reached],
      (_, through) => less(r, through),
      (i, before) => {
        const { token, rise, width } = walk.steps[i];
        return [
          "Join",
          ["List", sub(r, before), add(y, rise), sub(w, width), flagAfter(walk, reached, add(y, rise), rise)],
          ["Drop", state, 4],
          ["List", token],
        ];
      },
    ),
  );
  return [
    "Drop",
    fold(step, state, "ui", ["List", "_r", 0, walk.width, walk.flag?.initial ?? 1], upTo(1, walk.width)),
    4,
  ];
}

/** Rank: a fold over the path itself, the state [r, y, w, reached]. */
function rank(walk: Walk): MathJSON {
  const state = "rs";
  const [r, y, w, reached] = [1, 2, 3, 4].map((i) => at(state, i));
  const step = stepFrom(
    walk,
    "rc",
    [w, y, reached],
    (i) => equal("rx", walk.steps[i].token),
    (i, before) => {
      const { rise, width } = walk.steps[i];
      return ["List", add(r, before), add(y, rise), sub(w, width), flagAfter(walk, reached, add(y, rise), rise)];
    },
  );
  return at(fold(step, state, "rx", ["List", 0, 0, walk.width, walk.flag?.initial ?? 1], "_x"), 1);
}

/** Membership: the walk over the path, the state [y, w, top, flag?]; a step off the walk sets y to −1.
 *  The flag is walked only when the walk puts a condition on its end. */
function valid(walk: Walk): MathJSON {
  const state = "vs";
  const tracked = walk.final !== undefined;
  const byToken = (i: number): MathJSON => {
    if (i === walk.steps.length) return ["List", -1, 0, 0, ...(tracked ? [0] : [])];
    const { token, rise, width, aboveGround } = walk.steps[i];
    const landing = add(at(state, 1), rise);
    const y = aboveGround ? iff(equal(at(state, 1), 0), -1, landing) : landing;
    const next = [
      y,
      add(at(state, 2), width),
      ["Max", at(state, 3), y],
      ...(tracked ? [flagAfter(walk, at(state, 4), y, rise)] : []),
    ];
    return iff(equal("vx", token), ["List", ...next], byToken(i + 1));
  };
  const start = ["List", 0, 0, 0, ...(tracked ? [walk.flag?.initial ?? 1] : [])];
  const end = fold(iff(less(at(state, 1), 0), state, byToken(0)), state, "vx", start, "_x");
  return lets(
    [["ve", end, "list<integer>"]],
    and(
      equal(at("ve", 1), 0),
      equal(at("ve", 2), walk.width),
      ...(walk.top === undefined ? [] : [walk.top(at("ve", 3))]),
      ...(walk.final === undefined ? [] : [walk.final(at("ve", 4))]),
    ),
  );
}

/** A walk family's definitions; its count is the completions from the start. */
export const walkFamily = (walk: Walk): EpsilFamily => ({
  head: walk.head,
  carrier: walk.carrier,
  paramCount: walk.params.length as 1 | 2,
  kind: "ints",
  params: walk.params,
  ...(walk.declinePastDoubles === undefined ? {} : { declinePastDoubles: true as const }),
  ...(walk.fast === undefined ? {} : { fast: walk.fast }),
  epsil: {
    count: walk.completions(walk.width, 0, walk.flag?.initial ?? 1),
    ...(walk.tables.length === 0
      ? {}
      : { tables: walk.tables.length === 1 ? walk.tables[0] : ["Join", ...walk.tables] }),
    unrank: unrank(walk),
    rank: rank(walk),
    valid: valid(walk),
  },
});

/**
 * T(w, y) for w = 0..total and y = 0..cap: the walks of width w from height y down to 0 with
 * these steps, never above `cap`. T(0, y) is 1 at y = 0; past that a walk can't come down from
 * above its width.
 */
export function completionsTable(tag: string, steps: readonly Step[], total: MathJSON, cap: MathJSON): MathJSON {
  return rowTable(
    tag,
    add(total, 1),
    add(cap, 1),
    (y) => iff(equal(y, 0), 1, 0),
    (prev, w, y) =>
      iff(
        less(w, y),
        0,
        add(
          ...steps.map(({ rise, width, aboveGround }) => {
            const landing = add(y, rise);
            const fits = [
              ...(width === 2 ? [["GreaterEqual", w, 2]] : []),
              ...(aboveGround ? [["GreaterEqual", y, 1]] : []),
              ...(rise < 0 ? [["GreaterEqual", landing, 0]] : []),
              ...(rise > 0 ? [["LessEqual", landing, cap]] : []),
            ];
            const read = prev(sub(w, width), landing);
            return fits.length === 0 ? read : iff(and(...fits), read, 0);
          }),
        ),
      ),
  );
}

/** The cells of `completionsTable`: the offset of the table after it. */
export const completionsSize = (total: MathJSON, cap: MathJSON): MathJSON => mul(add(total, 1), add(cap, 1));

/** T(w, y) from the `completionsTable` that begins `offset` cells into `_tables`, 0 above `cap`
 *  (a walk can't be there). */
export const completionsOf =
  (cap: MathJSON, offset?: MathJSON) =>
  (w: MathJSON, y: MathJSON): MathJSON =>
    iff(["Greater", y, cap], 0, cell("_tables", add(cap, 1), offset)(w, y));
