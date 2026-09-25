// Native harness generation (design/benchmarking.md §4). Each generator turns the plan for the
// whole catalogue into one self-contained script for its system, committed under
// `generated/<system>/`, so a mappings or catalogue change shows up as a script diff and the
// kernel side needs no Node to run.
//
// Every generated harness implements the same contract as `harness-ts.ts`:
// - reads a case name per line on stdin; answers one line `<<name>>{json}` on stdout;
// - `{json}` is `{ value, k, samplesNs, timedOut }`, or `{ error }` for an unknown case, an
//   unsupported one or an exception;
// - `value` renders the first input's answer once, before any timing, the way the oracle scan
//   renders that system's values;
// - the timing is `measure()` in protocol.ts, from the `PROTOCOL` numbers the generator embeds,
//   with the system's caches cleared before each sample where it has a way to.

import { concretise, loadCatalogue } from "./catalogue.ts";
import { buildPlan } from "./plan.ts";
import type { BenchSystem, Plan, PlanCell } from "./types.ts";

/** Relative path under `generated/<system>/` → file contents. */
export type Generator = (plan: Plan) => Readonly<Record<string, string>>;

/** The plan every generated harness is built from: the whole catalogue. */
export const catalogPlan = (): Plan => buildPlan(loadCatalogue().map(concretise));

/** The cases a system can run, with their sources. */
export function planned(
  plan: Plan,
  system: BenchSystem,
): {
  readonly name: string;
  readonly case: Plan["cases"][number];
  readonly sources: readonly string[];
}[] {
  return plan.cases.flatMap((c) => {
    const cell: PlanCell | undefined = c.systems[system];
    return cell !== undefined && "sources" in cell ? [{ name: c.name, case: c, sources: cell.sources }] : [];
  });
}
