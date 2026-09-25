// Position-comparison statistics (descents, ascents, inversions, fixed points and their
// relatives) — split out of permutation.test.ts (see permutation-helpers.ts) purely to give
// vitest more, smaller files to parallelise across workers alongside the slow cycle-structure
// group.
import { checkAgainstEngine } from "./permutation-helpers.ts";

checkAgainstEngine([
  "Descents",
  "Ascents",
  "MajorIndex",
  "MinorIndex",
  "Inversions",
  "Sign",
  "FixedPoints",
  "Excedances",
  "WeakExceedances",
  "Antiexcedances",
]);
