// What the oracle scans established about a head, per system.
//
// `@enumeratio/oracle` already does the hard part: emit every documented example into
// another system's syntax, run it in that system's kernel, and compare the answers. The
// result is committed as a golden sweep, and it is exactly the evidence a crosswalk chip
// wants -- "this is the same function over there" is a claim, and the sweep is a check of
// it. So the chip carries the count, and a head whose examples DISAGREE says that instead.
//
// The scan needs a kernel, so it is not a gate; a head with no case in the sweep simply
// gets no mark. The catalogue of classified disagreements lives beside the sweep.

import sweep from "../../golden/oracle/wolfram-sweep.json" with { type: "json" };
import type { CrosswalkSystem } from "./sources.ts";

/** How a head's examples fared in one system's kernel. */
export interface OracleAgreement {
  readonly system: CrosswalkSystem;
  readonly agree: number;
  readonly disagree: number;
  /** The kernel the scan ran against, as it identifies itself. */
  readonly kernel: string;
}

interface SweepCase {
  readonly id: string;
  readonly verdict: string;
}

const tally = (
  system: CrosswalkSystem,
  kernel: string,
  cases: readonly SweepCase[],
): Map<string, OracleAgreement> => {
  const byHead = new Map<string, { agree: number; disagree: number }>();
  for (const one of cases) {
    const head = one.id.slice(0, one.id.lastIndexOf("#"));
    const row = byHead.get(head) ?? { agree: 0, disagree: 0 };
    if (one.verdict === "agree") row.agree += 1;
    if (one.verdict === "disagree") row.disagree += 1;
    byHead.set(head, row);
  }
  return new Map(
    [...byHead]
      .filter(([, row]) => row.agree || row.disagree)
      .map(([head, row]) => [head, { system, kernel, ...row }]),
  );
};

// One sweep so far. A second system's golden joins the same shape.
const SWEEPS: readonly ReadonlyMap<string, OracleAgreement>[] = [
  tally("wolfram", sweep.kernel, sweep.cases as readonly SweepCase[]),
];

/** Every system that has run this head's examples, with how they came out. */
export const oracleAgreements = (head: string): OracleAgreement[] =>
  SWEEPS.flatMap((s) => {
    const row = s.get(head);
    return row ? [row] : [];
  });
