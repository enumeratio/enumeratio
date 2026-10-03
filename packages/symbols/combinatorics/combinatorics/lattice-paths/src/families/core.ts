// DyckPaths split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5. MotzkinPaths/SchroederPaths joined it (§4 step 5, wire-carriers lane A-90):
// their element (list<integer>) matches MotzkinPath/SchroederPath's shape exactly, same as
// DyckPaths <-> DyckPath. LatticePaths and FibonacciWords declare no carrier at all and stay in
// collections per step 5 rule 4 -- so does most of paths-partitions.ts's lattice-path block for
// the same reason (see lattice-paths/src/families/paths-partitions.ts).
//
// All three are walks defined in Epsil (./walks.ts). Their TS kernels in
// collections/src/families/kernels-extra.ts stay as the independent reading the agreement tests
// check against.
import { equal, iff, less, lets, mul, quotient, sub } from "../../../collections/src/families/tables.ts";
import { completionsOf, completionsTable, type Step, walkFamily } from "./walks.ts";

const UP: Step = { token: 1, rise: 1, width: 1 };
const DOWN: Step = { token: -1, rise: -1, width: 1 };

/** A walk whose completions are one table. Its height never passes `cap`, half its width: a
 *  walk at height y has taken y steps up and has y down to go. */
const tableWalk = (head: string, carrier: string, width: unknown, cap: unknown, steps: readonly Step[]) =>
  walkFamily({
    head,
    carrier,
    params: ["_n"],
    width,
    steps,
    tables: [completionsTable("t", steps, width, cap)],
    completions: completionsOf(cap),
  });

/** The Dyck walks of width w from height y down to 0, by the ballot formula C(w, d) − C(w, d − 1),
 *  where d = (w − y)/2 of the w steps go up. */
const ballot = (w: unknown, y: unknown): unknown =>
  lets(
    [["bd", quotient(sub(w, y), 2), "integer"]],
    iff(
      ["Or", less(w, y), equal(["Mod", sub(w, y), 2], 1)],
      0,
      sub(["Binomial", w, "bd"], iff(equal("bd", 0), 0, ["Binomial", w, sub("bd", 1)])),
    ),
  );

/** Up (1) before down (0), semilength n: Catalan(n). Its completions are closed, so it needs no table. */
export const dyckPaths = walkFamily({
  head: "DyckPaths",
  carrier: "DyckPath",
  params: ["_n"],
  width: mul(2, "_n"),
  steps: [UP, { token: 0, rise: -1, width: 1 }],
  tables: [],
  completions: ballot,
});
/** Up (1), level (0), down (−1), length n: the Motzkin numbers. */
const motzkinPaths = tableWalk("MotzkinPaths", "MotzkinPath", "_n", quotient("_n", 2), [
  UP,
  { token: 0, rise: 0, width: 1 },
  DOWN,
]);
/** Large Schröder paths of width 2n: up (1), a level step two wide (2), down (−1). */
const schroederPaths = tableWalk("SchroederPaths", "SchroederPath", mul(2, "_n"), "_n", [
  UP,
  { token: 2, rise: 0, width: 2 },
  DOWN,
]);

export const entries = [dyckPaths, motzkinPaths, schroederPaths];
