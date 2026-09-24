// What the oracle scans established about a head, per system.
//
// `@enumeratio/oracle` already does the hard part: emit every documented example into
// another system's syntax, run it in that system's kernel, and compare the answers. The
// result is attached to each example as `others` (entries.ts, from the per-entry-file
// `<stem>.oracle.json` sidecars) — exactly the evidence a crosswalk chip wants: "this is
// the same function over there" is a claim, and the sidecar is a check of it. So the chip
// carries the count, and a head whose examples DISAGREE says that instead.
//
// The scan needs a kernel, so it is not a gate; a head with no scanned example simply gets
// no mark. The classification of each disagreement lives on its row in the sidecar.

import { entries, oracleKernels } from "../entries.ts";
import type { CrosswalkSystem } from "./sources.ts";
import { isCrosswalkSystem } from "./sources.ts";

/** How a head's examples fared in one system's kernel. */
export interface OracleAgreement {
  readonly system: CrosswalkSystem;
  readonly agree: number;
  readonly disagree: number;
  /** The kernel the scan ran against, as it identifies itself. */
  readonly kernel: string;
}

// head -> system -> tally
const BY_HEAD = new Map<string, Map<CrosswalkSystem, { agree: number; disagree: number }>>();
for (const entry of entries) {
  for (const example of entry.examples) {
    for (const [system, run] of Object.entries(example.others ?? {})) {
      if (!isCrosswalkSystem(system)) continue;
      const bySystem = BY_HEAD.get(entry.name) ?? new Map();
      const row = bySystem.get(system) ?? { agree: 0, disagree: 0 };
      if (run.verdict === "agree") row.agree += 1;
      if (run.verdict === "disagree") row.disagree += 1;
      bySystem.set(system, row);
      BY_HEAD.set(entry.name, bySystem);
    }
  }
}

/** Every system that has run this head's examples, with how they came out. */
export const oracleAgreements = (head: string): OracleAgreement[] => {
  const bySystem = BY_HEAD.get(head);
  if (bySystem === undefined) return [];
  return [...bySystem]
    .filter(([, row]) => row.agree || row.disagree)
    .flatMap(([system, row]) => {
      const kernel = oracleKernels[system];
      return kernel === undefined ? [] : [{ system, kernel, ...row }];
    });
};
