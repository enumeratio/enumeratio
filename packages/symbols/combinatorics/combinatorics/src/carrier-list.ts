// Every carrier combinatorics owns, as data: what the declare (carriers.ts) and the notation
// entry (notation.ts) both read. Light: the areas' carrier data and a type.

import type { Carrier } from "@enumeratio/structures";
import { COMPOSITIONS_CARRIERS } from "../compositions/src/carrier-data.ts";
import { FINDSTAT_CARRIERS } from "../findstat/src/carrier-data.ts";
import { GRAPHS_CARRIERS } from "../graphs/src/carrier-data.ts";
import { LATTICE_PATHS_CARRIERS } from "../lattice-paths/src/carrier-data.ts";
import { PARTITIONS_CARRIERS } from "../partitions/src/carrier-data.ts";
import { PERMUTATIONS_CARRIERS } from "../permutations/src/carrier-data.ts";
import { SET_PARTITIONS_CARRIERS } from "../set-partitions/src/carrier-data.ts";
import { TABLEAUX_CARRIERS } from "../tableaux/src/carrier-data.ts";
import { TREES_CARRIERS } from "../trees/src/carrier-data.ts";
import { WORDS_CARRIERS } from "../words/src/carrier-data.ts";

/** Carriers with no combinatorics area of their own — none, currently; see `CARRIERS`' own doc. */
export const LEFTOVER_CARRIERS: readonly Carrier[] = [];

/** Every carrier combinatorics itself owns: the areas' own data, plus its findstat tooling
 *  records. Carriers other packages own (arithmetic, GlyphKind) are declared by THOSE
 *  packages' own `declareCarriers` call instead — see each host's declare order. */
export const CARRIERS: readonly Carrier[] = [
  ...PERMUTATIONS_CARRIERS,
  ...PARTITIONS_CARRIERS,
  ...COMPOSITIONS_CARRIERS,
  ...WORDS_CARRIERS,
  ...LATTICE_PATHS_CARRIERS,
  ...TREES_CARRIERS,
  ...SET_PARTITIONS_CARRIERS,
  ...TABLEAUX_CARRIERS,
  ...GRAPHS_CARRIERS,
  ...FINDSTAT_CARRIERS,
  ...LEFTOVER_CARRIERS,
];
