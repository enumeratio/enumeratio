// Copy one local run (the directory scripts/bench.ts wrote) into a checkout of the
// `bench-data` branch, rebuild its index, and report drift of our own side against the same
// job's earlier runs. The workflow commits and pushes; this only writes files.
//
//   node packages/bench/scripts/publish.ts --run .bench/<id> --data bench-data --job nightly \
//     [--drift-report drift.json]

import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { buildIndex, detectDrift, type RunMeta } from "../src/history.ts";
import type { BenchSystem, Report } from "../src/types.ts";

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    data: { type: "string" },
    job: { type: "string" },
    "drift-report": { type: "string" },
  },
});
if (values.run === undefined || values.data === undefined || values.job === undefined) {
  console.error("usage: publish.ts --run <dir> --data <bench-data checkout> --job <name>");
  process.exit(2);
}

const read = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const reports = readdirSync(values.run)
  .filter((f) => f.endsWith(".json") && f !== "plan.json")
  .map((f) => read<Report>(join(values.run!, f)));
const first = reports[0];
if (first === undefined) throw new Error(`no reports in ${values.run}`);

const id = basename(values.run);
const dest = join(values.data, "runs", id);
cpSync(values.run, dest, { recursive: true });
const meta: RunMeta = {
  id,
  sha: first.run.sha,
  date: first.run.date,
  trigger: first.run.trigger,
  ...(first.run.url === undefined ? {} : { url: first.run.url }),
  job: values.job,
  systems: reports.map((r) => r.system.name as BenchSystem).sort(),
  machine: first.machine.fingerprint,
};
writeFileSync(join(dest, "run.json"), `${JSON.stringify(meta, null, 2)}\n`);
const index = buildIndex(values.data);
writeFileSync(join(values.data, "index.json"), `${JSON.stringify(index)}\n`);
console.log(`published ${id} (${meta.systems.join(", ")}); ${index.runs.length} runs in the index`);

// Trends come from our own side in the same job only (design §6).
const current = reports.find((r) => r.system.name === "ts");
if (current !== undefined && values["drift-report"] !== undefined) {
  const prior = index.runs
    .filter((r) => r.job === values.job && r.id !== id && r.systems.includes("ts"))
    .map((r) => join(values.data!, "runs", r.id, "ts.json"))
    .filter(existsSync)
    .map((file) => read<Report>(file));
  const drift = detectDrift(current, prior);
  writeFileSync(values["drift-report"], `${JSON.stringify(drift, null, 2)}\n`);
  console.log(`${drift.length} case(s) drifted`);
}
