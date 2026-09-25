// cpu-profile our side of chosen cases (design/benchmarking.md §9): one TS harness process
// per case under V8's sampling profiler. The .cpuprofile files open in Chrome DevTools or
// speedscope.
//
//   node packages/bench/scripts/profile.ts Factorial/factorial-10-to-the-5 --out .scratch/profiles
//   node packages/bench/scripts/profile.ts --from .bench/<run> --top 5 [--drift drift.json] --out profiles
//
// `--from` picks the cases where we trail the field most: our median over the fastest other
// system's, among cases everyone answered correctly. Drifted cases from `--drift` join them.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { QUIT } from "../src/protocol.ts";
import type { Report } from "../src/types.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    from: { type: "string" },
    top: { type: "string", default: "5" },
    drift: { type: "string" },
    out: { type: "string", default: ".data/profiles" },
  },
});

function trailing(runDir: string, top: number): string[] {
  const reports = readdirSync(runDir)
    .filter((f) => f.endsWith(".json") && f !== "plan.json" && f !== "run.json")
    .map((f) => JSON.parse(readFileSync(join(runDir, f), "utf8")) as Report);
  const ours = reports.find((r) => r.system.name === "ts");
  if (ours === undefined) return [];
  const ratios: [string, number][] = [];
  for (const r of ours.results) {
    if (r.status !== "ok" || r.median === undefined) continue;
    const others = reports
      .filter((o) => o !== ours)
      .map((o) => o.results.find((x) => x.name === r.name))
      .filter((x) => x?.status === "ok" && x.median !== undefined)
      .map((x) => x!.median!);
    if (others.length > 0) ratios.push([r.name, r.median / Math.min(...others)]);
  }
  return ratios
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name]) => name);
}

const names = new Set(positionals);
if (values.from !== undefined) for (const n of trailing(values.from, Number(values.top))) names.add(n);
if (values.drift !== undefined && existsSync(values.drift)) {
  for (const d of JSON.parse(readFileSync(values.drift, "utf8")) as { name: string }[]) names.add(d.name);
}

const harness = fileURLToPath(new URL("../src/harness-ts.ts", import.meta.url));
for (const name of names) {
  const dir = resolve(values.out, name.replace(/\//g, "__"));
  mkdirSync(dir, { recursive: true });
  const run = spawnSync(process.execPath, ["--cpu-prof", `--cpu-prof-dir=${dir}`, harness], {
    input: `${name}\n${QUIT}\n`,
    encoding: "utf8",
  });
  const status = /"error":/.test(run.stdout) ? "error" : run.status === 0 ? "ok" : `exit ${run.status}`;
  console.log(`${status.padEnd(6)} ${name} → ${dir}`);
}
