// Plausible over the collection catalogue (design/plausible.md): every family sampled from what
// it declares — its params, the cost of each operation, a work bound where it enumerates — with
// no lists of families here. Each family runs in a heap-capped worker under a time cap, so a
// declaration that understates its cost is a finding rather than a dead run.
//
// Every property lives in `properties.ts`, the derived instance in `sampleable.ts`, one family's
// run in `run-family.ts`; each is unit-tested against deliberately broken kernels.
//
//   node packages/symbols/combinatorics/collections/scripts/plausible.ts             # everything, fresh seed
//   node packages/symbols/combinatorics/collections/scripts/plausible.ts Partitions  # one head (or every head containing it)
//   node packages/symbols/combinatorics/collections/scripts/plausible.ts perm 123456 # replay exactly
//   PLAUSIBLE_POINTS=20 PLAUSIBLE_MAX_SIZE=9 node …/plausible.ts                     # deeper

import { Worker } from "node:worker_threads";
import { allEntries } from "../src/families/index.ts";
import type { Failure } from "./properties.ts";
import type { FamilyReport, RunOptions } from "./run-family.ts";

const env = (name: string, fallback: number): number => Number(process.env[name] ?? fallback);
const POINTS = env("PLAUSIBLE_POINTS", 8);
const MAX_SIZE = env("PLAUSIBLE_MAX_SIZE", 7);
const BUDGET = BigInt(env("PLAUSIBLE_BUDGET", 200_000));
const RETRIES = env("PLAUSIBLE_RETRIES", 10);
const FAMILY_SECONDS = env("PLAUSIBLE_FAMILY_SECONDS", 60);
const WORKER_MB = env("PLAUSIBLE_WORKER_MB", 768);

const args = process.argv.slice(2);
const filter = args.find((argument) => !/^\d+$/.test(argument)) ?? "";
const seed = Number(args.find((argument) => /^\d+$/.test(argument)) ?? Date.now() % 1_000_000);

const exact = allEntries.filter((entry) => entry.head === filter);
const families =
  exact.length > 0 ? exact : allEntries.filter((entry) => entry.head.toLowerCase().includes(filter.toLowerCase()));

process.stdout.write(
  `plausible seed ${seed} — ${families.length} families, ${POINTS} points each, size to ${MAX_SIZE}\n`,
);
if (families.length === 0) {
  process.stdout.write(`no family matches ${JSON.stringify(filter)}\n`);
  process.exit(1);
}

const options: RunOptions = { seed, points: POINTS, maxSize: MAX_SIZE, budget: BUDGET, retries: RETRIES };
const spawn = (): Worker =>
  new Worker(new URL("./plausible-worker.ts", import.meta.url), {
    resourceLimits: { maxOldGenerationSizeMb: WORKER_MB },
  });

/** One family in the worker; a timeout or a dead worker is reported as a cost finding. */
function run(worker: Worker, head: string): Promise<{ report: FamilyReport; dead: boolean }> {
  return new Promise((resolve) => {
    let last = "";
    const onMessage = (message: { progress?: string; report?: FamilyReport }) => {
      if (message.progress !== undefined) last = message.progress;
      if (message.report !== undefined) finish(message.report, false);
    };
    const onError = (error: unknown) =>
      died(
        (error as { code?: string }).code === "ERR_WORKER_OUT_OF_MEMORY"
          ? `ran out of ${WORKER_MB} MB`
          : `threw: ${String(error).slice(0, 120)}`,
      );
    const onExit = (code: number) => died(`worker exited ${code}`);
    // Only our own listeners: removeAllListeners would take the Worker's internal ones too,
    // and the next family's messages would never arrive.
    const finish = (report: FamilyReport, dead: boolean) => {
      clearTimeout(timer);
      worker.off("message", onMessage).off("error", onError).off("exit", onExit);
      resolve({ report, dead });
    };
    const died = (detail: string) =>
      finish(
        {
          head,
          declared: true,
          checked: 0,
          discards: {},
          failures: [
            { family: head, property: "cost", params: [], rank: -1n, detail: `${detail}${last ? ` at ${last}` : ""}` },
          ],
        },
        true,
      );
    const timer = setTimeout(() => died(`exceeded ${FAMILY_SECONDS} s`), FAMILY_SECONDS * 1000);
    worker.on("message", onMessage).on("error", onError).on("exit", onExit);
    worker.postMessage({ head, options });
  });
}

const failures: Failure[] = [];
const undeclared: string[] = [];
const starved: string[] = [];
let checked = 0;
let worker = spawn();
const slow: string[] = [];
for (const family of families) {
  const started = performance.now();
  const { report, dead } = await run(worker, family.head);
  const seconds = (performance.now() - started) / 1000;
  if (seconds > 2) slow.push(`${family.head} ${seconds.toFixed(1)} s`);
  if (process.env["PLAUSIBLE_TRACE"]) process.stderr.write(`${family.head} ${seconds.toFixed(2)} s\n`);
  if (dead) {
    await worker.terminate();
    worker = spawn();
  }
  checked += report.checked;
  failures.push(...report.failures);
  if (!report.declared) undeclared.push(report.head);
  if (report.checked === 0 && report.failures.length === 0) {
    const why = Object.entries(report.discards)
      .map(([reason, n]) => `${reason} ×${n}`)
      .join(", ");
    starved.push(`${report.head} (${why})`);
  }
}
await worker.terminate();

process.stdout.write(`${checked} points checked, ${failures.length} families failing\n`);
if (undeclared.length > 0) process.stdout.write(`sampled conservatively, not yet declared: ${undeclared.length}\n`);
// Every draw discarded: the declared params reach nothing checkable within the budget.
if (slow.length > 0) process.stdout.write(`slow:\n  ${slow.join("\n  ")}\n`);
if (starved.length > 0) process.stdout.write(`nothing checked:\n  ${starved.join("\n  ")}\n`);
for (const failure of failures) {
  const at =
    failure.params.length > 0 || failure.rank >= 0n
      ? `(${failure.params.join(", ")})${failure.rank >= 0n ? `#${failure.rank}` : ""}`
      : "";
  process.stdout.write(
    `\n  ${failure.family}${at}\n` +
      `    ${failure.property}: ${failure.detail}\n` +
      `    replay: node packages/symbols/combinatorics/collections/scripts/plausible.ts ${failure.family} ${seed}\n`,
  );
}

// Advisory: a fresh seed each run means a red result is a finding to triage, not a broken
// build. The exit code still reports it, so a deliberate run can be gated if we want one.
process.exit(failures.length > 0 ? 1 : 0);
