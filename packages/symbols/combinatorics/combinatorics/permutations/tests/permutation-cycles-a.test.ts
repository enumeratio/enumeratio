// Cycle-structure statistics, part 1 — split out of permutation.test.ts (see
// permutation-helpers.ts) because these are among the slowest statistics in the package: each
// walks orbits over every permutation of 1..6. Splitting the cycle statistics across two files
// lets vitest run them on separate workers instead of serializing the whole group.
import { checkAgainstEngine } from "./permutation-helpers.ts";

checkAgainstEngine(["CycleCount", "ReflectionLength", "LargestCycleLength", "LongestCycleLength"]);
