// Run the benchmark catalogue and write one report per system (design/benchmarking.md).
//
//   node packages/bench/scripts/bench.ts                        # every case, every system with a harness
//   node packages/bench/scripts/bench.ts --only Factorial,Gamma # cases whose name contains any of these
//   node packages/bench/scripts/bench.ts --systems ts --out .scratch/bench
//   node packages/bench/scripts/bench.ts --plan                 # write the support matrix and stop
//   node packages/bench/scripts/bench.ts --suite deep           # every tier (default: standard)
//
// A full local run is a heavy job: take `$(git rev-parse --git-common-dir)/lanes/HEAVY` first.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { concretise, loadCatalogue } from "../src/catalogue.ts";
import { conditions } from "../src/machine.ts";
import { buildPlan, SYSTEMS } from "../src/plan.ts";
import { report, runInfo, systemInfo } from "../src/report.ts";
import { HARNESSES } from "../src/registry.ts";
import { runPlan } from "../src/run.ts";
import { inSuite, isSuite, SUITES } from "../src/suites.ts";
import type { BenchSystem } from "../src/types.ts";

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    systems: { type: "string" },
    out: { type: "string", default: ".data" },
    plan: { type: "boolean", default: false },
    // Interleave only on a machine of its own: every kernel stays resident for the whole run.
    interleave: { type: "boolean", default: process.env["GITHUB_ACTIONS"] === "true" },
    force: { type: "boolean", default: false },
    suite: { type: "string", default: "standard" },
  },
});

const suite = values.suite;
if (!isSuite(suite)) {
  console.error(`--suite must be one of ${Object.keys(SUITES).join(", ")}`);
  process.exit(2);
}

const only = values.only?.split(",").filter(Boolean);
const cases = loadCatalogue()
  .filter((c) => inSuite(c, suite))
  .map(concretise)
  .filter((c) => only === undefined || only.some((o) => c.name.includes(o)));
const plan = buildPlan(cases, { suite });
const systems = (values.systems?.split(",") ?? SYSTEMS).filter(
  (s): s is BenchSystem => HARNESSES[s as BenchSystem] !== undefined,
);

const run = runInfo(process.env, new Date(), suite);
const dir = resolve(values.out, run.id);
mkdirSync(dir, { recursive: true });
const planPath = join(dir, "plan.json");
writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
if (values.plan) {
  console.log(planPath);
  process.exit(0);
}

const start = conditions();
if ((start.swapUsedGB ?? 0) > 8 && !values.force) {
  console.error(`${start.swapUsedGB} GB of swap in use; wait for it to drop, or --force.`);
  process.exit(1);
}

const ms = (ns: number | undefined): string => (ns === undefined ? "" : `${(ns / 1e6).toFixed(3)} ms`);
const versions = new Map<BenchSystem, string>();
const results = await runPlan(plan, systems, {
  interleave: values.interleave,
  onResult: (system, r) =>
    console.log(`${system.padEnd(8)} ${r.name.padEnd(48)} ${r.status.padEnd(11)} ${ms(r.median)} ${r.reason ?? ""}`),
  onVersion: (system, version) => versions.set(system, version),
});
const during = { start, end: conditions() };
for (const [system, list] of results) {
  const info = systemInfo(system, versions.get(system));
  writeFileSync(join(dir, `${system}.json`), `${JSON.stringify(report(run, info, list, during))}\n`);
}
console.log(dir);
