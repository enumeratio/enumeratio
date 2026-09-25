// The coordinator (design/benchmarking.md §5): one long-lived harness process per system,
// fed case by case, round-robin across systems, so a few seconds of machine noise land on
// every system alike. Every harness speaks the same line protocol: a case name
// (`<Head>/<id>`) on stdin, `<<name>>{json}` on stdout. Names, not positions, so a
// generated harness holding the whole catalogue serves any filtered plan.

import { type ChildProcess, spawn } from "node:child_process";
import { type AddressInfo, createServer } from "node:net";
import { createInterface } from "node:readline";
import { agrees } from "./agree.ts";
import { PROTOCOL, QUIT } from "./protocol.ts";
import { HARNESSES } from "./registry.ts";

export { HARNESSES };
import { summarise } from "./stats.ts";
import type { BenchSystem, CaseResult, Plan, PlanCell } from "./types.ts";

/** What a harness answers for one case. */
interface Reply {
  readonly error?: string;
  /** A harness may name its kernel's version, when that's cheaper there than probing. */
  readonly version?: string;
  readonly value?: string;
  readonly k?: number;
  readonly samplesNs?: readonly number[];
  readonly timedOut?: boolean;
}

export interface HarnessCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  /**
   * Talk over a TCP connection instead of stdin/stdout: the coordinator listens on
   * 127.0.0.1, appends the port to `args`, and the harness connects back. For kernels that
   * can't see our stdin (wolframscript runs its kernel over a link).
   */
  readonly socket?: boolean;
}

/** Seconds past a case's budget before the coordinator kills its harness. */
const GRACE_SECONDS = 30;
/** Seconds a socket harness may take to start its kernel and connect. */
const CONNECT_SECONDS = 120;

interface Channel {
  readonly child: ChildProcess;
  readonly write: (line: string) => void;
}

class Harness {
  private channel: Promise<Channel> | undefined;
  private waiting = new Map<string, (reply: Reply) => void>();
  private readonly start: HarnessCommand;

  constructor(start: HarnessCommand) {
    this.start = start;
  }

  private onLine = (line: string): void => {
    const match = /^<<([^>]+)>>(.*)$/.exec(line);
    if (match === null) return;
    this.waiting.get(match[1] as string)?.(JSON.parse(match[2] as string) as Reply);
  };

  private launch(extra: readonly string[], stdio: "pipe" | "inherit"): ChildProcess {
    const child = spawn(this.start.command, [...this.start.args, ...extra], {
      cwd: this.start.cwd,
      stdio: ["pipe", stdio, "inherit"],
    });
    // "close", not "exit": a process can exit before its last line is read.
    child.on("close", () => {
      for (const resolve of this.waiting.values()) resolve({ error: "harness exited" });
      this.waiting.clear();
      this.channel = undefined;
    });
    return child;
  }

  private open(): Promise<Channel> {
    if (this.start.socket !== true) {
      const child = this.launch([], "pipe");
      createInterface({ input: child.stdout! }).on("line", this.onLine);
      return Promise.resolve({ child, write: (line) => child.stdin!.write(`${line}\n`) });
    }
    return new Promise((resolve, reject) => {
      const server = createServer((socket) => {
        server.close();
        clearTimeout(timer);
        socket.setEncoding("utf8");
        createInterface({ input: socket }).on("line", this.onLine);
        socket.on("error", () => child.kill("SIGKILL"));
        resolve({ child, write: (line) => socket.write(`${line}\n`) });
      });
      let child: ChildProcess;
      const timer = setTimeout(() => {
        server.close();
        child?.kill("SIGKILL");
        reject(new Error("harness never connected"));
      }, CONNECT_SECONDS * 1000);
      server.listen(0, "127.0.0.1", () => {
        child = this.launch([String((server.address() as AddressInfo).port)], "inherit");
        child.on("close", () => {
          server.close();
          clearTimeout(timer);
          reject(new Error("harness exited before connecting"));
        });
      });
    });
  }

  async ask(name: string, timeoutSeconds: number): Promise<Reply> {
    let channel: Channel;
    try {
      channel = await (this.channel ??= this.open());
    } catch (error) {
      this.channel = undefined;
      return { error: error instanceof Error ? error.message : String(error) };
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiting.delete(name);
        channel.child.kill("SIGKILL");
        resolve({ timedOut: true, error: "killed past budget" });
      }, timeoutSeconds * 1000);
      this.waiting.set(name, (reply) => {
        clearTimeout(timer);
        this.waiting.delete(name);
        resolve(reply);
      });
      channel.write(name);
    });
  }

  /** Ask the harness to quit (a socket read never sees end-of-file), then make sure. */
  async close(): Promise<void> {
    const channel = await this.channel?.catch(() => undefined);
    if (channel === undefined) return;
    channel.write(QUIT);
    channel.child.stdin?.end();
    const timer = setTimeout(() => channel.child.kill("SIGKILL"), 5000);
    await new Promise((resolve) => channel.child.once("close", resolve));
    clearTimeout(timer);
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
  systems: readonly BenchSystem[],
  onResult?: (system: BenchSystem, result: CaseResult) => void,
  onVersion?: (system: BenchSystem, version: string) => void,
): Promise<Map<BenchSystem, CaseResult[]>> {
  const harnesses = new Map<BenchSystem, Harness>();
  for (const system of systems) {
    const start = HARNESSES[system];
    if (start !== undefined) harnesses.set(system, new Harness(start()));
  }
  const results = new Map<BenchSystem, CaseResult[]>(systems.map((s) => [s, []]));
  try {
    for (const [index, c] of plan.cases.entries()) {
      // Rotate the order so no system always runs first after another's case.
      const order = systems.map((_, i) => systems[(i + index) % systems.length] as BenchSystem);
      for (const system of order) {
        const cell = harnesses.has(system) ? c.systems[system] : undefined;
        let result = excluded(c.name, cell);
        if (result === undefined) {
          const reply = await harnesses.get(system)!.ask(c.name, c.budget * 4 + GRACE_SECONDS);
          if (reply.version !== undefined) onVersion?.(system, reply.version);
          result = judge(c.name, reply, c.expected, c.precision);
        }
        results.get(system)!.push(result);
        onResult?.(system, result);
      }
    }
  } finally {
    await Promise.all([...harnesses.values()].map((harness) => harness.close()));
  }
  return results;
}
