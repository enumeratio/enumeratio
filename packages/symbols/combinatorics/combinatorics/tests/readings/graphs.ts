// The graphs families' TS kernels, read in the order their Epsil definitions list. They answered ahead of
// Epsil until compiled Epsil made that unnecessary (BL-225); tests/fast-kernels.test.ts holds them to the
// definitions.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import { IsLabeledGraphOf, IsTournamentOf } from "../../graphs/src/families/core.ts";
import {
  LabeledGraphCount,
  LabeledGraphRank,
  LabeledGraphUnrank,
  TournamentCount,
  TournamentRank,
  TournamentUnrank,
} from "./kernels/graphs-core.ts";

export const readings: Record<string, FastKernel> = {
  Tournaments: {
    count: ([n]) => TournamentCount(n),
    unrank: ([n], r) => TournamentUnrank(n, r),
    rank: (e, [n]) => TournamentRank(e as number[][], n),
    valid: (e, [n]) => IsTournamentOf(e, n),
  },
  LabeledGraphs: {
    count: ([n]) => LabeledGraphCount(n),
    unrank: ([n], r) => LabeledGraphUnrank(n, r),
    rank: (e, [n]) => LabeledGraphRank(e as number[][], n),
    valid: (e, [n]) => IsLabeledGraphOf(e, n),
  },
};
