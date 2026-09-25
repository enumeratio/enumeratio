import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { ALL_STATISTICS } from "../src/all.ts";
import { core, cycles, headUsage, tower } from "../src/core.ts";

/**
 * The core, pinned. This is the point of the whole exercise: every statistic this package
 * defines bottoms out in exactly these compute-engine heads, and nothing else.
 *
 * A change here is a real event — either a definition reached for a new primitive (is it
 * earning its place?) or one stopped needing an old one (the core got smaller, which is the
 * direction worth celebrating). Either way it should be a deliberate edit, not a surprise.
 *
 * It has earned its keep three times. `Fold` and `List` entered when the run-length
 * statistics moved off the frontier; `Union` and `LCM` when the cycle statistics followed.
 * Both times the core grew because the frontier shrank, which is the trade worth making.
 * `Factorial` then LEFT, when StandardTableauCount turned out to be a collection
 * cardinality rather than a statistic — the core getting smaller because a name stopped
 * existing is the best direction of all. `Join` entered with the longest-subsequence
 * statistics, and it is the head that makes a fold accumulator GROW: every time the core has
 * grown it has been to close a frontier entry. `LessEqual` entered with Denert, which reads
 * non-excedances as `p(i) <= i` — no fold this time, just a same-block filtered sum.
 */
const CORE = [
  "Abs",
  "Add",
  "And",
  "At",
  "Count",
  "Divide",
  "Equal",
  "Filter",
  // Entered with the set-partition arc representation: the arcs of every block, as one list.
  "Flatten",
  "Fold",
  "Greater",
  "GreaterEqual",
  "If",
  "Join",
  "LCM",
  "Length",
  "Less",
  "LessEqual",
  "List",
  "Map",
  "Max",
  "Min",
  "Mod",
  "Multiply",
  "Or",
  "Power",
  "Product",
  "Range",
  "Subtract",
  "Sum",
  "Union",
];

test("every definition rests on exactly the core", () => {
  expect(core()).toEqual(CORE);
});

test("the core is all compute-engine's, not ours", () => {
  // If a core head were one of ours it would be a definition, not a primitive — and the
  // derivation would be lying about where the floor is.
  const ce = new ComputeEngine();
  const ours = new Set(ALL_STATISTICS.map((d) => d.head));
  for (const head of core()) {
    expect(ce.lookupDefinition(head), head).toBeTruthy();
    expect(ours.has(head), head).toBe(false);
  }
});

test("no definition is circular", () => {
  expect(cycles()).toEqual([]);
});

test("the tower is flat, which is a finding rather than a goal", () => {
  // Depth is a fact about the definitions, not a decision: a statistic sits one level above
  // the deepest head it uses. Every definition currently reduces STRAIGHT to the core, so
  // the tower has exactly one storey.
  //
  // That is worth noticing rather than celebrating. A flat tower means no definition is
  // expressed in terms of another, so shared structure is being repeated instead of named —
  // the conjugate partition, the height profile of a Dyck path and the cycle decomposition
  // are each rebuilt inline by every statistic that needs them. The one definition that DID
  // reference another head was StandardTableauCount, and it turned out to be a
  // cardinality that should not have been a statistic at all. Deepening this deliberately,
  // by promoting those shared structures to heads, is the next real piece of work.
  const levels = tower();
  expect([...levels].filter(([, level]) => level > 1).map(([signature]) => signature)).toEqual([]);
});

test("the most-used core heads are the ones you would expect", () => {
  // A sanity check on the shape of the vocabulary: this is a package about counting things
  // that satisfy a predicate, and the usage counts should say so.
  const usage = headUsage();
  for (const head of ["If", "Less", "At", "Range", "Filter", "Count"])
    expect(usage.get(head) ?? 0, head).toBeGreaterThan(40);
});
