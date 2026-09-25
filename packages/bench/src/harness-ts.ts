// Our side of the benchmark, as a harness like every generated one (design/benchmarking.md
// §4.2): reads case indices on stdin, answers `<<i>>{json}` on stdout. The engine is
// configured once; each case is boxed once, outside the timing, and only `evaluate()` (or
// `N()` for a numeric precision) is timed.
//
//   node packages/bench/src/harness-ts.ts <plan.json>

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import type { ComputeEngine } from "@cortex-js/compute-engine";
// The reference engine's library set; engines.ts is shared setup, not a script with effects.
import { declaredEngine } from "../../reference/scripts/engines.ts";
import { answerText } from "./agree.ts";
import { measure } from "./protocol.ts";
import type { Plan } from "./types.ts";

const plan = JSON.parse(readFileSync(process.argv[2] as string, "utf8")) as Plan;
const ce: ComputeEngine = declaredEngine();

function run(index: number): object {
  const c = plan.cases[index];
  if (c === undefined) return { error: `no case ${index}` };
  const cell = c.systems.ts;
  if (cell === undefined || !("sources" in cell)) return { error: "not planned for ts" };
  ce.precision = typeof c.precision === "number" ? c.precision : "machine";
  const boxed = cell.sources.map((source) => ce.box(JSON.parse(source)));
  const numeric = c.precision !== "exact";
  const once = (i: number): unknown => (numeric ? boxed[i]!.N() : boxed[i]!.evaluate());
  const value = answerText((once(0) as { json: unknown }).json);
  let next = 0;
  const timed = measure(() => once(next++ % boxed.length), { budgetMs: c.budget * 1000 });
  return { value, ...timed };
}

const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  const index = Number(line.trim());
  let out: object;
  try {
    out = run(index);
  } catch (error) {
    out = { error: error instanceof Error ? error.message : String(error) };
  }
  process.stdout.write(`<<${index}>>${JSON.stringify(out)}\n`);
}
