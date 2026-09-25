// Report assembly (design/benchmarking.md §7): one JSON file per system per run.

import { execFileSync } from "node:child_process";
import { machine } from "./machine.ts";
import { PROTOCOL } from "./protocol.ts";
import { CACHES } from "./registry.ts";
import { versionOf } from "./versions.ts";
import type { BenchSystem, CaseResult, Report } from "./types.ts";

export interface RunInfo {
  readonly id: string;
  readonly sha: string;
  readonly date: string;
  readonly trigger: string;
  readonly url?: string;
}

export function runInfo(env: NodeJS.ProcessEnv = process.env, date = new Date()): RunInfo {
  const sha =
    env["GITHUB_SHA"] ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const stamp = date.toISOString().slice(0, 16).replace(":", "-");
  const url =
    env["GITHUB_RUN_ID"] === undefined
      ? undefined
      : `${env["GITHUB_SERVER_URL"]}/${env["GITHUB_REPOSITORY"]}/actions/runs/${env["GITHUB_RUN_ID"]}`;
  return {
    id: `${stamp}Z-${sha.slice(0, 7)}`,
    sha,
    date: date.toISOString(),
    trigger: env["BENCH_TRIGGER"] ?? (env["GITHUB_ACTIONS"] === "true" ? "ci" : "local"),
    ...(url === undefined ? {} : { url }),
  };
}

export function report(
  run: RunInfo,
  system: Report["system"],
  results: readonly CaseResult[],
): Report {
  return { schema: 1, run, system, machine: machine(), protocol: PROTOCOL, results };
}

/** A system's version (as its harness reported it, or probed) and cache policy. */
export function systemInfo(name: BenchSystem, reported?: string): Report["system"] {
  const { version, packages } = versionOf(name);
  return {
    name,
    version: reported ?? version,
    ...(packages === undefined ? {} : { packages }),
    caches: CACHES[name] ?? "uncleared",
  };
}
