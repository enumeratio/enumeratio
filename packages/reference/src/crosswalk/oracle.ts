// What the oracle scans established about a head, per system.
//
// `@enumeratio/oracle` already does the hard part: emit every documented example into
// another system's syntax, run it in that system's kernel, and compare the answers. The
// result is each head's implementations record — exactly the evidence a crosswalk chip
// wants: "this is the same function over there" is a claim, and the record is a check of
// it. So the chip
// carries the count, and a head whose examples DISAGREE says that instead.
//
// The scan needs a kernel, so it is not a gate; a head with no scanned example simply gets
// no mark. The classification of each disagreement lives on its row in the record.

import AGREEMENTS from "./oracle-agreements.json" with { type: "json" };
import type { CrosswalkSystem } from "./sources.ts";

/** How a head's examples fared in one system's kernel. */
export interface OracleAgreement {
  readonly system: CrosswalkSystem;
  readonly agree: number;
  readonly disagree: number;
  /** The kernel the scan ran against, as it identifies itself. */
  readonly kernel: string;
}

/** Every system that has run this head's examples, with how they came out. Tallied from the
 * records by `oracleAgreementsOf` (node.ts) into oracle-agreements.json, which the scan
 * rewrites and a test keeps fresh -- so the browser never loads the examples to count them. */
export const oracleAgreements = (head: string): OracleAgreement[] =>
  ((AGREEMENTS as Record<string, OracleAgreement[]>)[head] ?? []).slice();
