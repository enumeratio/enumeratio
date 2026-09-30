// A-94 guard (§4 step 5): on a fully declared engine, every family whose data names a carrier
// must yield a value OF that carrier's type -- the property `carrierTypes` used to guarantee by
// construction (a host passed the carrier's minted type straight into `declareFamilies`), and
// which each area's own `declareFamilies` call now guarantees by reading the carrier back off
// `ce`'s registry instead (see collections/src/families/declare.ts). This sweeps every area's
// entries, not just the handful `declare-combinatorics.test.ts` spot-checks.
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../src/index.ts";
import { numberKernel } from "../collections/src/families/types.ts";
import type { FamilyKernel } from "../collections/src/families/types.ts";
import { collectionsEntries } from "../collections/src/families/index.ts";
import {
  bigintEntries as permutationsBigintEntries,
  coreEntries as permutationsCoreEntries,
  permutationClassesEntries,
  permutationsEntries,
} from "../permutations/src/families/index.ts";
import {
  coreEntries as partitionsCoreEntries,
  partitionsEntries,
  tableauxPlaneEntries as partitionsTableauxPlaneEntries,
} from "../partitions/src/families/index.ts";
import { compositionsEntries, coreEntries as compositionsCoreEntries } from "../compositions/src/families/index.ts";
import {
  binaryWordFamiliesEntries as wordsBinaryWordFamiliesEntries,
  coreEntries as wordsCoreEntries,
  tableauxTreesEntries as wordsTableauxTreesEntries,
  wordsEntries,
} from "../words/src/families/index.ts";
import {
  coreEntries as latticePathsCoreEntries,
  pathsPartitionsBeforeDyckPathsByHeightEntries as latticePathsPathsPartitionsBeforeDyckPathsByHeightEntries,
  pathsPartitionsEntries as latticePathsPathsPartitionsEntries,
} from "../lattice-paths/src/families/index.ts";
import {
  coreEntries as treesCoreEntries,
  labeledEntries as treesLabeledEntries,
  pruferSequencesEntries as treesPruferSequencesEntries,
  rootedForestsEntries as treesRootedForestsEntries,
  unlabeledTreesEntries as treesUnlabeledTreesEntries,
} from "../trees/src/families/index.ts";
import { coreEntries as graphsCoreEntries } from "../graphs/src/families/index.ts";
import {
  coreEntries as setPartitionsCoreEntries,
  coreSurjectionsEntries as setPartitionsSurjectionsEntries,
  matchingsEntries as setPartitionsMatchingsEntries,
  pathsPartitionsEntries as setPartitionsPathsPartitionsEntries,
} from "../set-partitions/src/families/index.ts";
import {
  standardTableauPairsEntries,
  tableauxPlaneBeforeSkewStandardTableauxEntries,
  tableauxPlanePlanePartitionsEntries,
  tableauxPlaneShiftedStandardTableauxEntries,
  tableauxPlaneSkewStandardTableauxEntries,
} from "../tableaux/src/families/index.ts";

// Every family declared by `declareCombinatorics`, exactly as each area's own declare.ts
// assembles it (see that file), so this list is the union `declareCombinatorics` actually runs.
// Each area maps its own NumberKernel entries into the bigint contract exactly as that area's
// own declare.ts does (permutationsBigintEntries and collectionsEntries are FamilyKernel
// already) -- see each `declare<Area>` for the grouping this mirrors.
const allFamilies: readonly FamilyKernel[] = [
  ...permutationsBigintEntries,
  ...[...permutationsCoreEntries, ...permutationsEntries, ...permutationClassesEntries].map(numberKernel),
  ...[...partitionsCoreEntries, ...partitionsEntries, ...partitionsTableauxPlaneEntries].map(numberKernel),
  ...[...compositionsCoreEntries, ...compositionsEntries].map(numberKernel),
  ...[...wordsCoreEntries, ...wordsEntries, ...wordsBinaryWordFamiliesEntries, ...wordsTableauxTreesEntries].map(
    numberKernel,
  ),
  ...[
    ...latticePathsCoreEntries,
    ...latticePathsPathsPartitionsBeforeDyckPathsByHeightEntries,
    ...latticePathsPathsPartitionsEntries,
  ].map(numberKernel),
  ...[
    ...treesLabeledEntries,
    ...treesRootedForestsEntries,
    ...treesCoreEntries,
    ...treesPruferSequencesEntries,
    ...treesUnlabeledTreesEntries,
  ].map(numberKernel),
  ...[
    ...setPartitionsSurjectionsEntries,
    ...setPartitionsCoreEntries,
    ...setPartitionsPathsPartitionsEntries,
    ...setPartitionsMatchingsEntries,
  ].map(numberKernel),
  ...[
    ...tableauxPlaneBeforeSkewStandardTableauxEntries,
    ...tableauxPlaneSkewStandardTableauxEntries,
    ...tableauxPlaneShiftedStandardTableauxEntries,
    ...standardTableauPairsEntries,
    ...tableauxPlanePlanePartitionsEntries,
  ].map(numberKernel),
  ...graphsCoreEntries.map(numberKernel),
  ...collectionsEntries,
];

const carrierFamilies = allFamilies.filter((f) => f.carrier !== undefined);

test("declareCombinatorics's area declares cover every carrier-bearing family this test knows", () => {
  // A sanity floor on the list above, not a duplicate of carriers-area-split.test.ts: catches
  // this file's own import list falling out of sync with an area's families/index.ts.
  expect(carrierFamilies.length).toBeGreaterThan(50);
});

/** The smallest params (each axis walked 0..8 from 0) at which `family` is non-empty, or
 *  undefined if none in that range answers (a family this search isn't suited to). */
function smallestNonEmptyParams(family: FamilyKernel): number[] | undefined {
  const axes = family.paramCount;
  const tryAt = (p: number[]): boolean => {
    try {
      const c = family.count(p);
      return (typeof c === "bigint" ? c > 0n : c > 0) === true;
    } catch {
      return false;
    }
  };
  if (axes === 0) return tryAt([]) ? [] : undefined;
  if (axes === 1) {
    for (let n = 0; n <= 8; n++) if (tryAt([n])) return [n];
    return undefined;
  }
  // 2 or 3 axes: walk by increasing sum, small enough to stay cheap (max sum 16).
  const maxSum = axes === 2 ? 12 : 9;
  for (let sum = 0; sum <= maxSum; sum++) {
    for (let a = 0; a <= sum; a++) {
      if (axes === 2) {
        const p = [a, sum - a];
        if (p.every((x) => x >= 0) && tryAt(p)) return p;
      } else {
        for (let b = 0; b <= sum - a; b++) {
          const p = [a, b, sum - a - b];
          if (p.every((x) => x >= 0) && tryAt(p)) return p;
        }
      }
    }
  }
  return undefined;
}

// A-107 (§4 step 7): this is the guard that replaces the two retired bridges -- #389's
// `collectionCarrierOf` wrap in the collection table, and `laws.ts`'s kernel-to-carrier table.
// Both existed only because a family could still yield a bare kernel element; now every route a
// caller reaches an element through -- unranking (`At`), `Random`, and plain iteration -- has to
// answer with the carrier's own type, not just the one this file used to spot-check.
test("every carrier-bearing family yields its carrier's type through At, Random and iteration", () => {
  const ce = new ComputeEngine();
  declareCombinatorics(ce);
  const skipped: string[] = [];
  for (const family of carrierFamilies) {
    const p = smallestNonEmptyParams(family);
    if (p === undefined) {
      // A family this brute-force search can't find a non-empty instance for (e.g. one whose
      // smallest cases are all empty past this search's range) -- reported, not silently green.
      skipped.push(family.head);
      continue;
    }
    const call = p.length === 0 ? family.head : [family.head, ...p];
    const label = `${family.head}(${p.join(", ")})`;

    const at = ce.box(["At", call, 1] as never).evaluate();
    expect(at.operator, `At(${label}, 1)`).toEqual(family.carrier);

    const random = ce.box(["Random", call] as never).evaluate();
    expect(random.operator, `Random(${label})`).toEqual(family.carrier);

    const first = ce
      .box(call as never)
      .each()
      .next().value;
    expect(first?.operator, `first element of ${label}`).toEqual(family.carrier);
  }
  expect(skipped, "families this search found no non-empty instance for").toEqual([]);
});
