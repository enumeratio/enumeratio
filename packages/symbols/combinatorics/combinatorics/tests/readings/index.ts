// The TS kernels retired from the runtime (BL-225): for each family, the reading that used to answer ahead
// of its Epsil definition. A family whose count stays exact past 2^53 keeps just that as `fastCount`; the
// rest are here whole. tests/fast-kernels.test.ts puts each back as the family's `fast` path to hold it to
// the definitions: count, unrank, rank and membership agree, at the edges of 2^53 too.
import type { EpsilFamily, FastKernel } from "../../collections/src/families/epsil.ts";
import { readings as collections } from "./collections.ts";
import { readings as compositions } from "./compositions.ts";
import { readings as graphs } from "./graphs.ts";
import { readings as latticePaths } from "./lattice-paths.ts";
import { readings as numeric } from "./numeric.ts";
import { readings as partitions } from "./partitions.ts";
import { readings as permutations } from "./permutations.ts";
import { readings as setPartitions } from "./set-partitions.ts";
import { readings as trees } from "./trees.ts";
import { readings as words } from "./words.ts";

export const RETIRED_FAST: Readonly<Record<string, FastKernel>> = {
  ...collections,
  ...compositions,
  ...graphs,
  ...latticePaths,
  ...numeric,
  ...partitions,
  ...permutations,
  ...setPartitions,
  ...trees,
  ...words,
  // The same Dyck paths, under another head.
  BallotSequences: latticePaths.DyckPaths,
};

/** The family with its retired reading back as its `fast` path, if it has one. */
export const withRetiredFast = (family: EpsilFamily): EpsilFamily => {
  const reading = RETIRED_FAST[family.head];
  return reading === undefined ? family : { ...family, fast: reading };
};
