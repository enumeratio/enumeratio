// ParkingFunctions in Epsil: a_1..a_n in 1..n, listed in lex order, with at least k entries at most k
// for each k. After a prefix with h[k] entries at most k, the m = n − i entries still to place must
// have at least d_k = k − h[k] at most k. Counting how many ways to give values to s of them with
// values at most k, f_k(s) = [s ≥ d_k] Σ_c C(s, c) f_{k−1}(s − c) (c of the s take the value k, and
// f_0 is 1 at s = 0), the completions are f_n(m); unrank and rank add them up over the smaller
// values at each position, as the lex order asks.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  equal,
  fold,
  iff,
  len,
  less,
  lets,
  map,
  mul,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

const N = "_n";
const x = (j: MathJSON): MathJSON => at("_x", j);
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, n: MathJSON): MathJSON => ["Drop", xs, n];
/** A list of `count` zeros. */
const zeros = (count: MathJSON): MathJSON => map(0, "pz", upTo(1, count));

/** The completions of a prefix with `held(k)` entries at most k, `m` entries still to place. */
const completions = (held: (k: MathJSON) => MathJSON, m: MathJSON): MathJSON =>
  at(
    fold(
      lets(
        [["pq", "pf", "list<integer>"]],
        // The next row, filled a cell at a time in place: the interpreter keeps a `Map` lazy.
        fold(
          [
            "ReplaceAt",
            "pn",
            add("ps", 1),
            iff(
              less("ps", sub("pk", held("pk"))),
              0,
              fold(
                add("pa", mul(["Binomial", "ps", "pc"], at("pq", add(sub("ps", "pc"), 1)))),
                "pa",
                "pc",
                0,
                upTo(0, "ps"),
              ),
            ),
          ],
          "pn",
          "ps",
          zeros(add(m, 1)),
          upTo(0, m),
        ),
      ),
      "pf",
      "pk",
      join(list(1), zeros(m)),
      upTo(1, N),
    ),
    add(m, 1),
  );

/** How many entries at most k a prefix holding `value` as well has, k given, where `held` is the
 *  list of those counts without it. */
const holding =
  (held: MathJSON, value: MathJSON) =>
  (k: MathJSON): MathJSON =>
    add(at(held, k), iff(["GreaterEqual", k, value], 1, 0));
/** `held` with an entry `value` added. */
const addEntry = (held: MathJSON, value: MathJSON): MathJSON =>
  fold(["ReplaceAt", "pe", "pj", holding(held, value)("pj")], "pe", "pj", held, upTo(1, N));

export const parkingFunctions: EpsilFamily = {
  head: "ParkingFunctions",
  carrier: "ParkingFunction",
  paramCount: 1,
  kind: "ints",
  params: [N],
  // The completions are counted in doubles below 2^53, but interpreting them past it takes seconds a call.
  declinePastDoubles: true,
  epsil: {
    count: iff(less(N, 0), 0, iff(equal(N, 0), 1, ["Power", add(N, 1), sub(N, 1)])),
    // The state is [rank left, entries at most k for k = 1..n, the entries so far…]: at position i the
    // smallest value whose completions hold the rank is taken.
    unrank: drop(
      fold(
        lets(
          [
            ["uh", ["Take", drop("us", 1), N], "list<integer>"],
            [
              "uv",
              fold(
                iff(
                  equal(at("ua", 2), 1),
                  "ua",
                  lets(
                    [["uc", completions(holding("uh", "uw"), sub(N, "ui")), "integer"]],
                    iff(less(at("ua", 1), "uc"), list(at("ua", 1), 1, "uw"), list(sub(at("ua", 1), "uc"), 0, 0)),
                  ),
                ),
                "ua",
                "uw",
                list(at("us", 1), 0, 0),
                upTo(1, N),
              ),
              "list<integer>",
            ],
          ],
          join(list(at("uv", 1)), addEntry("uh", at("uv", 3)), drop("us", add(N, 1)), list(at("uv", 3))),
        ),
        "us",
        "ui",
        join(list("_r"), zeros(N)),
        upTo(1, N),
      ),
      add(N, 1),
    ),
    // The state is [rank so far, entries at most k for k = 1..n].
    rank: at(
      fold(
        lets(
          [
            ["rh", drop("rs", 1), "list<integer>"],
            [
              "rt",
              fold(add("rc", completions(holding("rh", "rw"), sub(N, "ri"))), "rc", "rw", 0, upTo(1, sub(x("ri"), 1))),
              "integer",
            ],
          ],
          join(list(add(at("rs", 1), "rt")), addEntry("rh", x("ri"))),
        ),
        "rs",
        "ri",
        join(list(0), zeros(N)),
        upTo(1, N),
      ),
      1,
    ),
    valid: and(
      equal(len, N),
      all((j) => and(["LessEqual", 1, x(j)], ["LessEqual", x(j), N]), upTo(1, len), "vj"),
      // At least k entries are at most k.
      all(
        (k) => ["GreaterEqual", fold(add("vc", iff(["LessEqual", x("vi"), k], 1, 0)), "vc", "vi", 0, upTo(1, len)), k],
        upTo(1, N),
        "vk",
      ),
    ),
  },
};
