// What an example's role says about how the rest of the system treats it.

import type { ReferenceExample } from "./types.ts";

/** Whether `expected` is a claim the tests, scans and packs hold the example to: not an
 * aspirational target (tested the other way round) and not a row waiting in triage. */
export const isSettled = (example: Pick<ReferenceExample, "role">): boolean =>
  example.role !== "aspirational" && example.role !== "triage";
