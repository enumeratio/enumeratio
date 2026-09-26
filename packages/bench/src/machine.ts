// The machine a run was on (design/benchmarking.md §7): the fields that decide whether two
// timings are comparable, a hash of them so the viewer can split series by machine, and how
// loaded it was when the run started and ended.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { arch, cpus, freemem, loadavg, release, totalmem, type as osType, version } from "node:os";
import type { Conditions, Machine } from "./types.ts";

const gb = (bytes: number): number => Math.round((bytes / 1024 ** 3) * 100) / 100;

/** Swap in use, in bytes: `sysctl vm.swapusage` on macOS, /proc/meminfo on Linux. */
function swapUsed(): number | undefined {
  try {
    if (process.platform === "darwin") {
      const out = execFileSync("sysctl", ["vm.swapusage"], { encoding: "utf8" });
      const used = /used = ([\d.]+)([MG])/.exec(out);
      return used === null ? undefined : Number(used[1]) * 1024 ** (used[2] === "G" ? 3 : 2);
    }
    if (process.platform === "linux") {
      const info = readFileSync("/proc/meminfo", "utf8");
      const kb = (key: string): number => Number(new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(info)?.[1] ?? 0);
      return (kb("SwapTotal") - kb("SwapFree")) * 1024;
    }
  } catch {
    // not reported
  }
  return undefined;
}

export function conditions(now = new Date()): Conditions {
  const swap = swapUsed();
  return {
    at: now.toISOString(),
    loadavg: loadavg().map((x) => Math.round(x * 100) / 100),
    freeMemoryGB: gb(freemem()),
    ...(swap === undefined ? {} : { swapUsedGB: gb(swap) }),
  };
}

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
    osVersion: version(),
    arch: arch(),
    cpu,
    cpuMHz: cpus()[0]?.speed ?? 0,
    cores,
    memoryGB: Math.round(totalmem() / 1024 ** 3),
    runner,
    node: process.versions.node,
  };
}
