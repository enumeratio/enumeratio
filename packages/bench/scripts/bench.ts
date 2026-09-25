// Run the benchmark catalogue and write one report per system (design/benchmarking.md).
//
//   node packages/bench/scripts/bench.ts                        # every case, every system with a harness
//   node packages/bench/scripts/bench.ts --only Factorial,Gamma # cases whose name contains any of these
//   node packages/bench/scripts/bench.ts --systems ts --out .scratch/bench
//   node packages/bench/scripts/bench.ts --plan                 # write the support matrix and stop
//
// A full local run is a heavy job: take `$(git rev-parse --git-common-dir)/lanes/HEAVY` first.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { concretise, loadCatalogue } from "../src/catalogue.ts";
import { buildPlan, SYSTEMS } from "../src/plan.ts";
import { report, runInfo, systemInfo } from "../src/report.ts";
import { HARNESSES, runPlan } from "../src/run.ts";
import type { BenchSystem } from "../src/types.ts";

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    systems: { type: "string" },
    out: { type: "string", default: ".data" },
    plan: { type: "boolean", default: false },
  },
});

const only = values.only?.split(",").filter(Boolean);
const cases = loadCatalogue()
  .map(concretise)
  .filter((c) => only === undefined || only.some((o) => c.name.includes(o)));
const plan = buildPlan(cases);
const systems = (values.systems?.split(",") ?? SYSTEMS).filter(
  (s): s is BenchSystem => HARNESSES[s as BenchSystem] !== undefined,
);

const run = runInfo();
const dir = resolve(values.out, run.id);
mkdirSync(dir, { recursive: true });
const planPath = join(dir, "plan.json");
writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
if (values.plan) {
  console.log(planPath);
  process.exit(0);
}

const ms = (ns: number | undefined): string =>
  ns === undefined ? "" : `${(ns / 1e6).toFixed(3)} ms`;
const results = await runPlan(plan, planPath, systems, (system, r) =>
  console.log(
    `${system.padEnd(8)} ${r.name.padEnd(48)} ${r.status.padEnd(11)} ${ms(r.median)} ${r.reason ?? ""}`,
  ),
);
for (const [system, list] of results) {
  writeFileSync(
    join(dir, `${system}.json`),
    `${JSON.stringify(report(run, systemInfo(system), list))}\n`,
  );
}
console.log(dir);
