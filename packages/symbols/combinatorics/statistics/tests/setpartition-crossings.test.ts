// Crossings and Nestings — the two slowest set-partition statistics (each walks every PAIR of
// arcs), split into their own file (see setpartition-crossing-nesting-total.test.ts for the
// third of the group and setpartition-helpers.ts for the shared universe and readings).
import { checkAgainstEngine } from "./setpartition-helpers.ts";

checkAgainstEngine(["Crossings", "Nestings"]);
