// Hand-maintained (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4).
// Every carrier now has an owning area — arithmetic values (`GaussianInteger`,
// `ModularResidue`, `RationalNumber`, `Fraction`, the factorizations, `ContinuedFraction`,
// `EgyptianFraction`, `Multicomplex`, `CollatzTrajectory`, `PythagoreanTriple`,
// `SquareDecomposition`, `GoldbachPartition`) moved to the arithmetic packages that declare
// them, and `GlyphKind` to the notatio side (step 5). `FindStatHit`/`DistributionMatchHit`
// stay in combinatorics, in their own `findstat` area module rather than this file's
// LEFTOVER_DOMAINS (step 3). `LEFTOVER_DOMAINS` is kept, empty, for whatever still lacks an
// area of its own — see `DOMAINS`' own doc.

import { COMPOSITIONS_DOMAINS } from "../../compositions/src/domain-data.ts";
import { FINDSTAT_DOMAINS } from "../../findstat/src/domain-data.ts";
import { GRAPHS_DOMAINS } from "../../graphs/src/domain-data.ts";
import { LATTICE_PATHS_DOMAINS } from "../../lattice-paths/src/domain-data.ts";
import { PARTITIONS_DOMAINS } from "../../partitions/src/domain-data.ts";
import { PERMUTATIONS_DOMAINS } from "../../permutations/src/domain-data.ts";
import { SET_PARTITIONS_DOMAINS } from "../../set-partitions/src/domain-data.ts";
import { TABLEAUX_DOMAINS } from "../../tableaux/src/domain-data.ts";
import { TREES_DOMAINS } from "../../trees/src/domain-data.ts";
import { WORDS_DOMAINS } from "../../words/src/domain-data.ts";
import type { Domain } from "@enumeratio/structures";

/** Carriers with no combinatorics area of their own — none, currently; see the file comment. */
export const LEFTOVER_DOMAINS: readonly Domain[] = [];

/** Every carrier combinatorics itself owns: the areas' own data, plus its findstat tooling
 *  records. Carriers other packages own (arithmetic, GlyphKind) are declared by THOSE
 *  packages' own `declareCarriers` call instead — see each host's declare order. */
export const DOMAINS: readonly Domain[] = [
  ...PERMUTATIONS_DOMAINS,
  ...PARTITIONS_DOMAINS,
  ...COMPOSITIONS_DOMAINS,
  ...WORDS_DOMAINS,
  ...LATTICE_PATHS_DOMAINS,
  ...TREES_DOMAINS,
  ...SET_PARTITIONS_DOMAINS,
  ...TABLEAUX_DOMAINS,
  ...GRAPHS_DOMAINS,
  ...FINDSTAT_DOMAINS,
  ...LEFTOVER_DOMAINS,
];
