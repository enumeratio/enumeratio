// Our side of the benchmark, as a harness like every generated one (design/benchmarking.md
// §4.2): reads case names on stdin, answers `<<name>>{json}` on stdout. The engine is
// configured once; each case is boxed once, outside the timing, and only `evaluate()` (or
// `N()` for a numeric precision) is timed.
//
//   node packages/bench/src/harness-ts.ts

import { createInterface } from "node:readline";
import type { ComputeEngine } from "@cortex-js/compute-engine";
// The reference engine's library set; engines.ts is shared setup, not a script with effects.
import { declaredEngine } from "../../reference/scripts/engines.ts";
import { answerText } from "./agree.ts";
import { catalogPlan } from "./generate.ts";
import { measure, QUIT } from "./protocol.ts";

// The whole catalogue, like every generated harness; the coordinator asks for cases by name.
const plan = catalogPlan();
const ce: ComputeEngine = declaredEngine();

const byName = new Map(plan.cases.map((c) => [c.name, c]));

function run(name: string): object {
  const c = byName.get(name);
  if (c === undefined) return { error: `no case ${name}` };
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
  const name = line.trim();
  if (name === QUIT) break;
  let out: object;
  try {
    out = run(name);
  } catch (error) {
    out = { error: error instanceof Error ? error.message : String(error) };
  }
  process.stdout.write(`<<${name}>>${JSON.stringify(out)}\n`);
}
