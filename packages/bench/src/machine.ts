// The machine fingerprint (design/benchmarking.md §7): the fields that decide whether two
// timings are comparable, and a hash of them so the viewer can split series by machine.

import { createHash } from "node:crypto";
import { arch, cpus, release, totalmem, type as osType } from "node:os";
import type { Machine } from "./types.ts";

export function machine(env: NodeJS.ProcessEnv = process.env): Machine {
  const cpu = cpus()[0]?.model.trim() ?? "unknown";
  const cores = cpus().length;
  const runner =
    env["GITHUB_ACTIONS"] === "true"
      ? `${env["ImageOS"] ?? env["RUNNER_OS"] ?? "github"} ${env["ImageVersion"] ?? ""} (${env["RUNNER_ENVIRONMENT"] ?? "hosted"})`.trim()
      : "local";
  const os = `${osType()} ${release()}`;
  const key = [cpu, cores, arch(), osType(), runner.replace(/ \d[\d.]*/, "")].join("|");
  return {
    fingerprint: `sha256:${createHash("sha256").update(key).digest("hex").slice(0, 16)}`,
    os,
    arch: arch(),
    cpu,
    cores,
    memoryGB: Math.round(totalmem() / 1024 ** 3),
    runner,
    node: process.versions.node,
  };
}
