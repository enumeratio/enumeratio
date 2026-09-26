// Publish a run made on this machine to the bench-data branch, the way CI's bench-run action
// does: for the systems CI can't run (Wolfram without an on-demand license). The run lands
// as its own job, so trends compare it only with earlier runs from the same place.
//
//   node packages/bench/scripts/bench.ts --systems ts,wolfram --out .scratch/bench
//   node packages/bench/scripts/publish-local.ts .scratch/bench/<run> --job wolfram-local

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { job: { type: "string" } },
});
const run = positionals[0];
if (run === undefined || values.job === undefined) {
  console.error("usage: publish-local.ts <run dir> --job <name>");
  process.exit(2);
}

const git = (args: readonly string[], cwd?: string): string =>
  execFileSync("git", [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
const remote = git(["remote", "get-url", "origin"]);
// The clone sits outside this checkout, where its identity config doesn't reach: commit as it.
const identity = [
  "-c",
  `user.name=${git(["config", "user.name"])}`,
  "-c",
  `user.email=${git(["config", "user.email"])}`,
];
const publish = fileURLToPath(new URL("./publish.ts", import.meta.url));

// Start from the branch's tip each attempt: a CI job may publish at the same moment.
for (let attempt = 1; ; attempt++) {
  const data = mkdtempSync(join(tmpdir(), "bench-data-"));
  try {
    git(["clone", "--quiet", "--single-branch", "--branch", "bench-data", "--depth", "50", remote, data]);
    execFileSync(process.execPath, [publish, "--run", resolve(run), "--data", data, "--job", values.job], {
      stdio: "inherit",
    });
    git(["add", "-A"], data);
    git([...identity, "commit", "--quiet", "-m", `bench: ${values.job} ${basename(resolve(run))}`], data);
    git(["push", "--quiet", "origin", "bench-data"], data);
    console.log(`pushed ${basename(resolve(run))} to bench-data as ${values.job}`);
    break;
  } catch (error) {
    if (attempt >= 3) throw error;
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
}
