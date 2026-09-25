// Run an external kernel under a memory ceiling.
//
// macOS has no per-process memory cap (no cgroups; `ulimit -v` is ignored), so the ceiling
// is a watchdog: the child leads its own process group, the group's resident memory is
// polled, and the whole group is killed once it passes the cap. Per-tool limits (Julia's
// heap hint, Lean's -M) keep a kernel under the cap in the first place; this catches the
// rest — Wolfram and Sage have no such flag.

import { execFileSync, spawn } from "node:child_process";

export interface Bounds {
  /** Resident-memory ceiling for the child and everything it spawns. */
  readonly memoryMb?: number;
  readonly timeoutMs?: number;
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  /** Written to the child's stdin, which is otherwise closed at once. */
  readonly input?: string;
}

export interface BoundedResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
  /** Set when the watchdog, not the child, ended the run. */
  readonly killed?: "memory" | "timeout" | "interrupted";
  readonly peakMb: number;
}

/** The default ceiling, overridable per machine with `ORACLE_MEMORY_MB`. */
export const memoryCapMb = (): number => Number(process.env["ORACLE_MEMORY_MB"]) || 4096;

const POLL_MS = 500;

/** Resident memory of every process in a group, in MB. */
export function groupRssMb(pgid: number): number {
  let out: string;
  try {
    out = execFileSync("ps", ["-A", "-o", "pgid=,rss="], { encoding: "utf8" });
  } catch {
    return 0;
  }
  let kb = 0;
  for (const line of out.split("\n")) {
    const [group, rss] = line.trim().split(/\s+/).map(Number);
    if (group === pgid && Number.isFinite(rss)) kb += rss as number;
  }
  return kb / 1024;
}

export function runBounded(
  command: string,
  args: readonly string[],
  bounds: Bounds = {},
): Promise<BoundedResult> {
  const cap = bounds.memoryMb ?? memoryCapMb();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: bounds.cwd,
      env: bounds.env ?? process.env,
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end(bounds.input);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    let killed: BoundedResult["killed"];
    let peakMb = 0;
    const stop = (reason: NonNullable<BoundedResult["killed"]>) => {
      killed ??= reason;
      try {
        process.kill(-(child.pid as number), "SIGKILL");
      } catch {
        // already gone
      }
    };
    const poll = setInterval(() => {
      const mb = groupRssMb(child.pid as number);
      peakMb = Math.max(peakMb, mb);
      if (mb > cap) stop("memory");
    }, POLL_MS);
    const timer =
      bounds.timeoutMs === undefined
        ? undefined
        : setTimeout(() => stop("timeout"), bounds.timeoutMs);
    // An interrupted scan must not leave a kernel holding gigabytes. The child leads its own
    // group, so a Ctrl-C never reaches it: kill it, then let the signal take its default course.
    const onExit = () => stop("interrupted");
    const onSignal = (signal: NodeJS.Signals) => {
      stop("interrupted");
      if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
    };
    process.once("exit", onExit);
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);

    child.on("error", reject);
    child.on("close", (code) => {
      clearInterval(poll);
      clearTimeout(timer);
      process.off("exit", onExit);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        code,
        ...(killed === undefined ? {} : { killed }),
        peakMb: Math.round(peakMb),
      });
    });
  });
}

/** The kernel was stopped by the watchdog; its output is not an answer. */
export class KernelKilled extends Error {
  readonly result: BoundedResult;
  constructor(command: string, result: BoundedResult) {
    super(`${command}: killed (${result.killed}, peak ${result.peakMb} MB)`);
    this.result = result;
  }
}

/** `runBounded` for a script, failing as `execFileSync` would: the stdout, or a throw when
 * the kernel was killed or exited non-zero. */
export async function runKernel(
  command: string,
  args: readonly string[],
  bounds: Bounds = {},
): Promise<string> {
  const result = await runBounded(command, args, bounds);
  if (result.killed !== undefined) throw new KernelKilled(command, result);
  if (result.code !== 0) {
    throw new Error(`${command}: exit ${result.code}\n${result.stderr.slice(-2000)}`);
  }
  return result.stdout;
}
