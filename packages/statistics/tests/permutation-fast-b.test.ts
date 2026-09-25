// Extremal and run-based statistics (peaks, valleys, left/right-to-left maxima/minima, runs,
// depth) — split out of permutation.test.ts (see permutation-helpers.ts) purely to give vitest
// more, smaller files to parallelise across workers alongside the slow cycle-structure group.
import { checkAgainstEngine } from "./permutation-helpers.ts";

checkAgainstEngine([
  "Peaks",
  "Valleys",
  "LeftToRightMaxima",
  "LeftToRightMinima",
  "RightToLeftMaxima",
  "RightToLeftMinima",
  "FirstDescent",
  "LastDescent",
  "Runs",
  "Depth",
  "CyclicDescents",
  "LongestRun",
  "LargestRunLength",
]);
