#!/usr/bin/env node
// The nightly perf-drift collector (see tools/perf/README.md). For each workspace package with
// a `test` script, runs its suite through vitest's JSON reporter — one at a time, so packages
// don't contend for the same CPU cores and skew each other's numbers — records per-test and
// per-file durations, appends the run to the rolling history, and flags any test that drifted
// past its trailing median. Pure output: this script owns all the I/O; every decision it makes
// is delegated to the pure functions in history.ts and vitest-report.ts.
//
//   node tools/perf/src/collect.ts --history tools/perf/.data/history.json
//   node tools/perf/src/collect.ts --packages boxed,utils --history /tmp/history.json --dry-run
//
// --dry-run skips the actual test runs and fabricates nothing — it's for wiring checks, not data.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { appendRun, detectDrift, slowestFiles, type History, type PackageRun, type RunRecord } from "./history.ts";
import { toPackageRun, type VitestJsonReport } from "./vitest-report.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

interface Args {
  historyFile: string;
  driftReportFile: string;
  slowestFile: string;
  packages?: string[];
  sha: string;
  date: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    historyFile: get("--history") ?? join(REPO_ROOT, "tools/perf/.data/history.json"),
    driftReportFile: get("--drift-report") ?? join(REPO_ROOT, "tools/perf/.data/drift-report.json"),
    slowestFile: get("--slowest-out") ?? join(REPO_ROOT, "tools/perf/.data/slowest-files.json"),
    packages: get("--packages")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    sha: get("--sha") ?? gitShaOrUnknown(),
    date: get("--date") ?? new Date().toISOString(),
    dryRun: argv.includes("--dry-run"),
  };
}

function gitShaOrUnknown(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT }).toString().trim();
  } catch {
    return "unknown";
  }
}

function loadHistory(path: string): History {
  if (!existsSync(path)) return { runs: [] };
  return JSON.parse(readFileSync(path, "utf8")) as History;
}

/** Packages under packages/* that declare a `test` script — that's the whole vp-test surface. */
function discoverPackages(root: string): Array<{ name: string; dir: string }> {
  const packagesDir = join(root, "packages");
  const out: Array<{ name: string; dir: string }> = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(packagesDir, entry.name);
    const pkgJsonPath = join(dir, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    if (pkgJson.scripts?.test) out.push({ name: pkgJson.name, dir });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function runPackageSuite(pkgName: string, outputFile: string): VitestJsonReport | undefined {
  try {
    execFileSync("pnpm", ["--filter", pkgName, "exec", "vp", "test", "--reporter=json", `--outputFile=${outputFile}`], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // A failing suite still writes the JSON report (vitest exits non-zero, not silently) — a red
    // test isn't this job's business, only its timing is. Fall through and try to read it.
    void error;
  }
  if (!existsSync(outputFile)) {
    console.error(`no JSON report for ${pkgName} — suite likely crashed before vitest could report`);
    return undefined;
  }
  return JSON.parse(readFileSync(outputFile, "utf8")) as VitestJsonReport;
}

function ensureDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const targets = args.packages
    ? args.packages.map((name) => ({
        name: `@enumeratio/${name}`,
        dir: join(REPO_ROOT, "packages", name),
      }))
    : discoverPackages(REPO_ROOT);

  const priorHistory = loadHistory(args.historyFile);
  const packages: Record<string, PackageRun> = {};

  if (args.dryRun) {
    console.log(`dry run — would collect: ${targets.map((t) => t.name).join(", ")}`);
    return;
  }

  const scratchDir = mkdtempSync(join(tmpdir(), "perf-collect-"));
  for (const target of targets) {
    console.log(`collecting ${target.name}…`);
    const outputFile = join(scratchDir, `${target.name.replace("/", "__")}.json`);
    const report = runPackageSuite(target.name, outputFile);
    if (!report) continue;
    packages[target.name] = toPackageRun(report, target.dir);
  }

  const run: RunRecord = { sha: args.sha, date: args.date, packages };
  const drift = detectDrift(run, priorHistory);
  const slowest = slowestFiles(run, 3);

  const history = appendRun(priorHistory, run, 60);
  ensureDir(args.historyFile);
  writeFileSync(args.historyFile, `${JSON.stringify(history, null, 2)}\n`);
  ensureDir(args.driftReportFile);
  writeFileSync(args.driftReportFile, `${JSON.stringify(drift, null, 2)}\n`);
  ensureDir(args.slowestFile);
  writeFileSync(args.slowestFile, `${JSON.stringify(slowest, null, 2)}\n`);

  console.log(`history: ${history.runs.length} run(s) kept at ${args.historyFile}`);
  if (drift.length === 0) {
    console.log("no drift detected");
  } else {
    console.log(`${drift.length} test(s) drifted:`);
    for (const flag of drift) {
      console.log(
        `  ${flag.package} ${flag.file} :: ${flag.test} — ${flag.currentMs.toFixed(1)}ms vs median ` +
          `${flag.medianMs.toFixed(1)}ms (×${flag.ratio.toFixed(2)}, +${flag.absDiffMs.toFixed(1)}ms, ` +
          `${flag.priorRuns} prior runs)`,
      );
    }
  }
  console.log(`slowest files: ${slowest.map((s) => `${s.package}/${s.file}`).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
