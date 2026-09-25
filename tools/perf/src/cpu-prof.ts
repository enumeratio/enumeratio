#!/usr/bin/env node
// Captures a --cpu-prof for the slowest few files collect.ts identified (tools/perf/.data/slowest-files.json
// by default). NODE_OPTIONS carries --cpu-prof into whatever worker vitest spawns to run the file, which is
// good enough for an advisory profile — we're after "is this file's shape still what it was", not a
// courtroom-grade trace. Re-running the single file also means the profile isn't diluted by the rest of the
// suite. Each file gets a --pool=forks --poolOptions.forks.singleFork run so exactly one process profiles it.
//
//   node tools/perf/src/cpu-prof.ts --slowest tools/perf/.data/slowest-files.json --out-dir /tmp/cpu-profiles

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

interface SlowFile {
  package: string;
  file: string;
  durationMs: number;
}

function parseArgs(argv: string[]) {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    slowestFile: get("--slowest") ?? join(REPO_ROOT, "tools/perf/.data/slowest-files.json"),
    outDir: get("--out-dir") ?? join(REPO_ROOT, "tools/perf/.data/cpu-profiles"),
  };
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.slowestFile)) {
    console.log(`no slowest-files report at ${args.slowestFile} — nothing to profile`);
    return;
  }
  const slowest = JSON.parse(readFileSync(args.slowestFile, "utf8")) as SlowFile[];
  mkdirSync(args.outDir, { recursive: true });

  for (const entry of slowest) {
    const profileName = `${sanitize(entry.package)}__${sanitize(entry.file)}.cpuprofile`;
    console.log(`profiling ${entry.package}/${entry.file} -> ${profileName}`);
    try {
      execFileSync(
        "pnpm",
        [
          "--filter",
          entry.package,
          "exec",
          "vp",
          "test",
          entry.file,
          "--run",
          "--pool=forks",
          "--poolOptions.forks.singleFork",
        ],
        {
          cwd: REPO_ROOT,
          stdio: "inherit",
          env: {
            ...process.env,
            NODE_OPTIONS:
              `${process.env.NODE_OPTIONS ?? ""} --cpu-prof --cpu-prof-dir=${args.outDir} ` +
              `--cpu-prof-name=${profileName}`.trim(),
          },
        },
      );
    } catch (error) {
      // The suite failing (or being flaky under a single fork) shouldn't drop the other profiles.
      console.error(`profiling ${entry.package}/${entry.file} failed`, error);
    }
  }
}

main();
