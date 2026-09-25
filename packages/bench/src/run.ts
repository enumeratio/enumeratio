// The coordinator (design/benchmarking.md §5): one long-lived harness process per system,
// fed case by case, round-robin across systems, so a few seconds of machine noise land on
// every system alike. Every harness speaks the same line protocol: a case index on stdin,
// `<<i>>{json}` on stdout.

import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { agrees } from "./agree.ts";
import { PROTOCOL } from "./protocol.ts";
import { summarise } from "./stats.ts";
import type { BenchSystem, CaseResult, Plan, PlanCell } from "./types.ts";

/** What a harness answers for one case. */
interface Reply {
  readonly error?: string;
  readonly value?: string;
  readonly k?: number;
  readonly samplesNs?: readonly number[];
  readonly timedOut?: boolean;
}

export interface HarnessCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
}

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/** How to start each system's harness against a plan file. Systems without one are skipped. */
export const HARNESSES: Partial<Record<BenchSystem, (planPath: string) => HarnessCommand>> = {
  ts: (planPath) => ({ command: process.execPath, args: [here("./harness-ts.ts"), planPath] }),
};

/** Seconds past a case's budget before the coordinator kills its harness. */
const GRACE_SECONDS = 30;

class Harness {
  private child: ChildProcess | undefined;
  private waiting = new Map<number, (reply: Reply) => void>();
  private readonly start: HarnessCommand;

  constructor(start: HarnessCommand) {
    this.start = start;
  }

  private spawn(): ChildProcess {
    const child = spawn(this.start.command, [...this.start.args], {
      cwd: this.start.cwd,
      stdio: ["pipe", "pipe", "inherit"],
    });
    createInterface({ input: child.stdout! }).on("line", (line) => {
      const match = /^<<(\d+)>>(.*)$/.exec(line);
      if (match === null) return;
      this.waiting.get(Number(match[1]))?.(JSON.parse(match[2] as string) as Reply);
    });
    child.on("exit", () => {
      for (const resolve of this.waiting.values()) resolve({ error: "harness exited" });
      this.waiting.clear();
      if (this.child === child) this.child = undefined;
    });
    return child;
  }

  ask(index: number, timeoutSeconds: number): Promise<Reply> {
    this.child ??= this.spawn();
    const child = this.child;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiting.delete(index);
        child.kill("SIGKILL");
        resolve({ timedOut: true, error: "killed past budget" });
      }, timeoutSeconds * 1000);
      this.waiting.set(index, (reply) => {
        clearTimeout(timer);
        this.waiting.delete(index);
        resolve(reply);
      });
      child.stdin!.write(`${index}\n`);
    });
  }

  close(): void {
    this.child?.stdin?.end();
  }
}

export function excluded(name: string, cell: PlanCell | undefined): CaseResult | undefined {
  if (cell === undefined) return { name, status: "unsupported", reason: "no harness" };
  if ("sources" in cell) return undefined;
  switch (cell.reason) {
    case "unmapped":
      return { name, status: "unsupported", reason: `unmapped: ${cell.missing.join(", ")}` };
    case "precision":
      return { name, status: "precision" };
    case "denied":
      return { name, status: "denied", reason: cell.note };
  }
}

/** Turn a harness reply into a result: the correctness gate, then the protocol's floors. */
export function judge(
  name: string,
  reply: Reply,
  expected: string | undefined,
  precision: Plan["cases"][number]["precision"],
): CaseResult {
  if (reply.timedOut === true && (reply.samplesNs?.length ?? 0) === 0)
    return { name, status: "timeout", reason: reply.error };
  if (reply.error !== undefined) return { name, status: "error", reason: reply.error };
  const value = reply.value;
  if (expected !== undefined && (value === undefined || !agrees(value, expected, precision)))
    return { name, status: "wrong", value, reason: `expected ${expected}` };
  const samplesNs = reply.samplesNs ?? [];
  const summary = summarise(samplesNs);
  const status =
    reply.timedOut === true ? "timeout" : summary.median < PROTOCOL.tooFastNs ? "too-fast" : "ok";
  return { name, status, k: reply.k, samplesNs, ...summary, value };
}

export async function runPlan(
  plan: Plan,
  planPath: string,
  systems: readonly BenchSystem[],
  onResult?: (system: BenchSystem, result: CaseResult) => void,
): Promise<Map<BenchSystem, CaseResult[]>> {
  const harnesses = new Map<BenchSystem, Harness>();
  for (const system of systems) {
    const start = HARNESSES[system];
    if (start !== undefined) harnesses.set(system, new Harness(start(planPath)));
  }
  const results = new Map<BenchSystem, CaseResult[]>(systems.map((s) => [s, []]));
  try {
    for (const [index, c] of plan.cases.entries()) {
      // Rotate the order so no system always runs first after another's case.
      const order = systems.map((_, i) => systems[(i + index) % systems.length] as BenchSystem);
      for (const system of order) {
        const cell = harnesses.has(system) ? c.systems[system] : undefined;
        const result =
          excluded(c.name, cell) ??
          judge(
            c.name,
            await harnesses.get(system)!.ask(index, c.budget * 4 + GRACE_SECONDS),
            c.expected,
            c.precision,
          );
        results.get(system)!.push(result);
        onResult?.(system, result);
      }
    }
  } finally {
    for (const harness of harnesses.values()) harness.close();
  }
  return results;
}
