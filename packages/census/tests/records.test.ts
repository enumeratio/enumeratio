// Every head we declare has a reference record, so it's in the provenance ledger: the
// reference's provenance test is what notices compute-engine shipping a head of ours
// (BL-62), and it only sees heads with a record.

import { recordsRoot, referenceData } from "@enumeratio/reference/node";
import { expect, test } from "vite-plus/test";
import { declaredNames } from "../src/engine.ts";

const recorded = new Set(referenceData(recordsRoot(import.meta.dirname)).heads.map(({ head }) => head));
// Heads are capitalised; the lowercase names are carrier and algebra types (namespace.test.ts).
const heads = declaredNames().filter((name) => /^[A-Z]/.test(name));

/** Heads declared before this check, still without a record. Each wants one, or to stop
 *  being a global name; the list only shrinks. */
const UNRECORDED = new Set([
  // Old numeral-system names, kept as aliases of the …Numerals heads.
  "Factoradic",
  "PrimorialRadix",
  "Zeckendorf",
  "HyperbinaryWords",
  "HypernumeraryWords",
  // Hypercomplex algebras' names and the quaternion symbol.
  "BicomplexNumbers",
  "DualNumbers",
  "Multicomplexes",
  "SplitComplexNumbers",
  "TricomplexNumbers",
  "H_doublestruck",
  // Collections and catalogue queries with no record yet.
  "DistributionMatchHits",
  "Factorizations",
  "FindStatHits",
  "Fractions",
  "GelfandTsetlinPatterns",
  "GlyphKinds",
  "PermutationInversions",
  "RootedLabeledTrees",
  "Singletons",
  "SkewTableaux",
  // Wolfram spellings bound as symbols.
  "Aborted",
]);

test("every head our packages declare has a reference record", () => {
  expect(heads.length).toBeGreaterThan(400);
  expect(heads.filter((head) => !recorded.has(head) && !UNRECORDED.has(head))).toEqual([]);
});

test("a head on the unrecorded list leaves it once it has a record", () => {
  expect([...UNRECORDED].filter((head) => recorded.has(head) || !heads.includes(head))).toEqual([]);
});
