// Install the oracle kernels that live beside this package, one at a time, under the
// memory watchdog. Installs are the heaviest thing the oracles do (Oscar precompiles
// dozens of packages; mathlib's cache unpacks ~5 GB), so they never run in parallel.
//
//   node packages/oracle/scripts/setup.ts            # julia, oscar, rust, mathlib4
//   node packages/oracle/scripts/setup.ts julia      # just one

import { fileURLToPath } from "node:url";
import { juliaFlags, runBounded } from "../src/index.ts";

const STEPS: Record<string, () => [string, string[], { cwd?: string; env?: NodeJS.ProcessEnv }]> = {
  julia: () => ["julia", [...juliaFlags("julia"), "-e", INSTANTIATE], { env: ONE_AT_A_TIME }],
  oscar: () => ["julia", [...juliaFlags("oscar"), "-e", INSTANTIATE], { env: ONE_AT_A_TIME }],
  // Fetches and builds the pinned crates once, so a scan batch only compiles its own src/bin/batch.rs.
  rust: () => ["cargo", ["build", "--quiet"], { cwd: fileURLToPath(new URL("../rust", import.meta.url)) }],
  mathlib4: () => ["lake", ["exe", "cache", "get"], { cwd: fileURLToPath(new URL("../lean", import.meta.url)) }],
};

const INSTANTIATE = "using Pkg; Pkg.instantiate(); Pkg.precompile()";
// One precompile task unless the caller says otherwise (CI, with a raised ORACLE_MEMORY_MB).
const ONE_AT_A_TIME = {
  ...process.env,
  JULIA_NUM_PRECOMPILE_TASKS: process.env["JULIA_NUM_PRECOMPILE_TASKS"] ?? "1",
};

const requested = process.argv.slice(2);
for (const name of requested.length > 0 ? requested : Object.keys(STEPS)) {
  const step = STEPS[name];
  if (step === undefined) throw new Error(`unknown kernel ${name}; one of ${Object.keys(STEPS).join(", ")}`);
  const [command, args, options] = step();
  process.stderr.write(`${name}: ${command} ${args.join(" ")}\n`);
  const run = await runBounded(command, args, { ...options, timeoutMs: 3_600_000 });
  process.stderr.write(
    `${name}: exit ${run.code}, peak ${run.peakMb} MB${run.killed ? `, killed (${run.killed})` : ""}\n`,
  );
  if (run.code !== 0) {
    process.stderr.write(run.stderr.slice(-2000));
    process.exit(1);
  }
}
