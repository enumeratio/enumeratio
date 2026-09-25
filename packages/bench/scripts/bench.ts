// Run the benchmark catalogue and write one report per system (design/benchmarking.md).
//
//   node packages/bench/scripts/bench.ts                        # every case, every system with a harness
//   node packages/bench/scripts/bench.ts --only Factorial,Gamma # cases whose name contains any of these
//   node packages/bench/scripts/bench.ts --systems ts --out .scratch/bench
//   node packages/bench/scripts/bench.ts --plan                 # write the support matrix and stop
//
// A full local run is a heavy job: take `$(git rev-parse --git-common-dir)/lanes/HEAVY` first.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { concretise, loadCatalogue } from "../src/catalogue.ts";
import { buildPlan, SYSTEMS } from "../src/plan.ts";
import { report, runInfo, systemInfo } from "../src/report.ts";
import { HARNESSES } from "../src/registry.ts";
import { runPlan } from "../src/run.ts";
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
  },
});

/** Megabytes of swap in use (macOS), or undefined where we can't tell. */
function swapUsedMb(): number | undefined {
  if (process.platform !== "darwin") return undefined;
  try {
    const out = execFileSync("sysctl", ["vm.swapusage"], { encoding: "utf8" });
    const used = /used = ([\d.]+)([MG])/.exec(out);
    return used === null ? undefined : Number(used[1]) * (used[2] === "G" ? 1024 : 1);
  } catch {
    return undefined;
  }
}

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

const swap = swapUsedMb();
if (swap !== undefined && swap > 8192 && !values.force) {
  console.error(`${(swap / 1024).toFixed(1)} GB of swap in use; wait for it to drop, or --force.`);
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
for (const [system, list] of results) {
  const info = systemInfo(system, versions.get(system));
  writeFileSync(join(dir, `${system}.json`), `${JSON.stringify(report(run, info, list))}\n`);
}
console.log(dir);
