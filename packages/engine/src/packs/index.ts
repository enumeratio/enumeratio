// The single registry of every collection, grouped by theme. Each module exports `entries: PackEntry[]`
// (pure count/unrank/rank/valid kernels); `core` holds the originally hand-authored collections over the
// certified kernel library, the rest are the parallel-authored packs. library.ts consumes `allEntries`
// and nothing else — one registration mechanism for all ~90 collections.
import type { PackEntry } from "./types.js";
import { entries as core } from "./core.js";

// permutations & permutation classes
import { entries as parkingIncreasingTrees } from "./parking-increasing-trees.js";
import { entries as alternatingNoSingleton } from "./alternating-nosingleton-partitions.js";
import { entries as avoiding321132 } from "./permutations-avoiding-321-132.js";
import { entries as avoiding123213 } from "./permutations-avoiding-123-213.js";
import { entries as avoiding231312 } from "./permutations-avoiding-231-312.js";
import { entries as stirlingParts1234 } from "./stirling-perms-parts1234.js";

// compositions
import { entries as restrictedCompsA } from "./restricted-compositions-a.js";
import { entries as parts123Avoid111 } from "./parts123-avoid111-strings.js";
import { entries as boundedCompsPalindromic } from "./bounded-comps-palindromic-strings.js";
import { entries as palindromicDistinctComps } from "./palindromic-distinct-comps.js";
import { entries as carlitzSmirnov } from "./carlitz-smirnov-words.js";
import { entries as kColoredComps } from "./kcolored-comps-parts12345.js";
import { entries as nonconsecutiveAtLeast2 } from "./nonconsecutive-subsets-comps-atleast2.js";
import { entries as parts1and2RevDoor } from "./parts1and2-revolving-door.js";

// partitions & set partitions
import { entries as oddSelfConjugate } from "./odd-selfconjugate-partitions.js";
import { entries as noncrossingNonnesting } from "./noncrossing-nonnesting-partitions.js";
import { entries as triangulationsNcMatchings } from "./triangulations-nc-matchings.js";
import { entries as atMostKAvoid010 } from "./atmostk-blocks-avoid010.js";
import { entries as rgsAvoid00 } from "./rgs-avoid00-strings.js";

// lattice paths & Catalan objects
import { entries as grandDyckBalanced } from "./grand-dyck-balanced-strings.js";
import { entries as bicoloredMotzkinTrees } from "./bicolored-motzkin-unary-binary-trees.js";
import { entries as grandMotzkinDelannoy } from "./grand-motzkin-delannoy.js";
import { entries as sytLittleSchroder } from "./syt-little-schroder.js";
import { entries as fullBinaryPlaneForests } from "./full-binary-plane-forests.js";

// binary/string words
import { entries as avoid1010101 } from "./avoid-101-0101-strings.js";
import { entries as groupings } from "./groupings.js";

export * from "./types.js";

export const allEntries: PackEntry[] = [
  ...(core as PackEntry[]),
  ...(parkingIncreasingTrees as PackEntry[]),
  ...(alternatingNoSingleton as PackEntry[]),
  ...(avoiding321132 as PackEntry[]),
  ...(avoiding123213 as PackEntry[]),
  ...(avoiding231312 as PackEntry[]),
  ...(stirlingParts1234 as PackEntry[]),
  ...(restrictedCompsA as PackEntry[]),
  ...(parts123Avoid111 as PackEntry[]),
  ...(boundedCompsPalindromic as PackEntry[]),
  ...(palindromicDistinctComps as PackEntry[]),
  ...(carlitzSmirnov as PackEntry[]),
  ...(kColoredComps as PackEntry[]),
  ...(nonconsecutiveAtLeast2 as PackEntry[]),
  ...(parts1and2RevDoor as PackEntry[]),
  ...(oddSelfConjugate as PackEntry[]),
  ...(noncrossingNonnesting as PackEntry[]),
  ...(triangulationsNcMatchings as PackEntry[]),
  ...(atMostKAvoid010 as PackEntry[]),
  ...(rgsAvoid00 as PackEntry[]),
  ...(grandDyckBalanced as PackEntry[]),
  ...(bicoloredMotzkinTrees as PackEntry[]),
  ...(grandMotzkinDelannoy as PackEntry[]),
  ...(sytLittleSchroder as PackEntry[]),
  ...(fullBinaryPlaneForests as PackEntry[]),
  ...(avoid1010101 as PackEntry[]),
  ...(groupings as PackEntry[]),
];
