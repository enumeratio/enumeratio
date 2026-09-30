// Cycle-structure statistics, part 2 — see permutation-cycles-a.test.ts for why this group is
// split out on its own, and permutation-helpers.ts for the shared universe and readings.
import { checkAgainstEngine } from "./permutation-helpers.ts";

checkAgainstEngine(["DistinctCycleLengths", "TwoCycleCount", "ThreeCycleCount", "Order"]);
