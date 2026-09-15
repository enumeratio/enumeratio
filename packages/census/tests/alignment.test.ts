// Every head of ours that shares a name with Wolfram has to have been DECIDED about.
//
// Three outcomes, and the transpiler behaves differently for each:
//
//   same function      → `HEADS`, so it emits as itself and the oracle may probe a kernel
//   different function → `FOREIGN`, so it emits into `` enumeratio` `` and cannot be mistaken
//   Wolfram has no such name → nothing to do; it falls through by name, harmlessly
//
// The failure this catches is the fourth case: a head that collides and is in neither list,
// so it falls through and a kernel answers a different question. That is not a missing
// answer, it is a wrong one, and nothing else in the suite would notice.

import { FOREIGN, HEADS, SYMBOLS, isSystemName } from "@enumeratio/wolfram/src";
import { expect, test } from "vite-plus/test";
import { declaredNames } from "../src/engine.ts";

const ours = declaredNames();

test("every head of ours that Wolfram also names is either mapped or contextualised", () => {
  // `SYMBOLS` alongside `HEADS` because a constant is not an operator: `Catalan` reaches
  // Wolfram through the symbol map, never through `applyHead`.
  const undecided = ours
    .filter((name) => isSystemName(name))
    .filter((name) => !(name in HEADS) && !(name in SYMBOLS) && !(name in FOREIGN));
  expect(undecided).toEqual([]);
});

test("the check is actually looking at the colliding heads", () => {
  // It passed vacuously for a while: the engine it ran against was missing collections,
  // domains and statistics, which is where most of the collisions live.
  const colliding = ours.filter((name) => isSystemName(name));
  expect(colliding).toContain("Area");
  expect(colliding).toContain("Subsets");
  expect(colliding.length).toBeGreaterThan(25);
});

test("nothing is claimed as both Wolfram's and foreign to it", () => {
  expect(Object.keys(FOREIGN).filter((name) => name in HEADS)).toEqual([]);
});

test("every FOREIGN entry names a symbol Wolfram actually has, and says what it means", () => {
  // An entry for a name Wolfram does NOT use is dead weight that quietly costs a head its
  // ordinary spelling in emitted source.
  for (const [name, meaning] of Object.entries(FOREIGN)) {
    expect(isSystemName(name), `${name} is not a Wolfram System\` symbol`).toBe(true);
    expect(meaning.length, name).toBeGreaterThan(15);
  }
});

test("every FOREIGN entry is a head we actually declare", () => {
  expect(Object.keys(FOREIGN).filter((name) => !ours.includes(name))).toEqual([]);
});
