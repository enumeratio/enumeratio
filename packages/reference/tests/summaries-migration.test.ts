// Symbol-metadata step 6 (design/speculative/symbol-metadata.md): the `description` strings
// hand-passed to `ce.declare` in the symbol packages are gone; each declare call now reads
// `SUMMARIES.<Head>` from a generated `summaries-data.ts`
// (`packages/reference/scripts/collect-summaries.ts`), one source (`summary`) instead of two.
//
// There is no old TS table to diff against here (the old value was a string literal inline
// in each `ce.declare` call, not a shared export), so this pins the two things that matter
// instead: every generated map is current with its package's records, and the set of heads
// each package declares a summary for hasn't drifted from this test's own manifest -- a
// change to either shows up as a failure here, not silently.

import { expect, test } from "vite-plus/test";
import { SUMMARIES as ADELES } from "../../symbols/arithmetic/adeles/src/summaries-data.ts";
import { SUMMARIES as AESTIMATIO } from "../../symbols/evaluation/aestimatio/src/summaries-data.ts";
import { SUMMARIES as COLLECTIONS } from "../../symbols/combinatorics/collections/src/summaries-data.ts";
import { SUMMARIES as NUMBER_THEORY } from "../../symbols/arithmetic/number-theory/src/summaries-data.ts";
import { SUMMARIES as RESIDUES } from "../../symbols/arithmetic/residues/src/summaries-data.ts";
import { packageEntries, referenceData } from "../src/node.ts";

const PACKAGES: Record<string, Readonly<Record<string, string>>> = {
  collections: COLLECTIONS,
  residues: RESIDUES,
  "number-theory": NUMBER_THEORY,
  adeles: ADELES,
  aestimatio: AESTIMATIO,
};

// This is a manifest, not a derivation: nothing on a record says "a `ce.declare` call reads
// this as `description`", so this list is maintained by hand alongside collect-summaries.ts's
// own copy -- adding a declared head means adding it in both places.
const EXPECTED_HEADS: Record<string, readonly string[]> = {
  collections: [
    "DifferenceDelta",
    "DiscreteRatio",
    "ExponentialGeneratingFunction",
    "FindSequenceFunction",
    "GeneratingFunction",
  ],
  residues: ["IntegerMod", "IntegerModRing", "MultiplicativeOrder", "PowerMod", "PowerModList", "PrimitiveRootList"],
  "number-theory": [
    "DivisorSum",
    "EulerE",
    "FrobeniusNumber",
    "FrobeniusSolve",
    "HermiteDecomposition",
    "IntegerExponent",
    "IsCoprime",
    "IsPrimePower",
    "LiouvilleLambda",
    "MangoldtLambda",
    "MersennePrimeExponent",
    "PartitionsQ",
    "PerfectNumber",
    "PowersRepresentations",
    "Quotient",
    "RamanujanTau",
    "RationalReconstruction",
    "SquaresR",
  ],
  adeles: ["Adele", "Idele", "ProfiniteDecomposition", "ProfiniteNumber", "ProfinitePlot"],
  aestimatio: ["MemoryConstrained", "TimeConstrained", "VerificationTest"],
};

test("every package's declared head set is unchanged", () => {
  for (const [pkg, summaries] of Object.entries(PACKAGES)) {
    expect(Object.keys(summaries).sort(), pkg).toEqual([...EXPECTED_HEADS[pkg]!].sort());
  }
});

test("every summaries-data.ts is current with its package's records", { timeout: 60_000 }, () => {
  const data = referenceData();
  for (const [pkg, summaries] of Object.entries(PACKAGES)) {
    const byName = new Map(packageEntries(pkg, data).map((e) => [e.name, e.summary]));
    for (const [head, summary] of Object.entries(summaries)) {
      expect(summary, `${pkg}: ${head}`).toBe(byName.get(head));
    }
  }
});
