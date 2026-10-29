// What every area's `scripts/compile-definitions.ts` does: compile the area's statistics to
// JavaScript ahead of time, cross-checked against the interpreter (step 6b), the checks split
// across processes (shards.ts).

import { fileURLToPath } from "node:url";
import {
  type CompiledDefinition,
  compiledDefinitionsFor,
  renderCompiled,
} from "../src/statistics/generate-compiled.ts";
import type { Definition } from "../src/statistics/types.ts";
import { smallElements } from "./samples.ts";
import { sharded } from "./shards.ts";
import { checkers } from "./verdicts.ts";
import { writeGenerated } from "./write-generated.ts";

const bySignature = (a: { signature: string }, b: { signature: string }): number =>
  a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0;

/** Compiles `definitions` (over subjects of `shape`) into `output`, a path relative to `script`. */
export async function compileArea(
  script: string,
  step: string,
  definitions: readonly Definition[],
  shape: string,
  output: string,
): Promise<void> {
  const run = await sharded(script, step, checkers.statistics, (verdicts, mine) =>
    compiledDefinitionsFor(definitions, shape, smallElements, verdicts, mine),
  );
  if (run === undefined) return;
  const entries: CompiledDefinition[] = run.results.flatMap((r) => r.compiled).toSorted(bySignature);
  const disagreed = run.results.flatMap((r) => r.disagreed).toSorted();
  writeGenerated(fileURLToPath(new URL(output, script)), renderCompiled(entries));
  run.verdicts.save();
  console.log(`${entries.length} of ${definitions.length} definitions compiled`);
  for (const signature of disagreed)
    console.log(`${signature}: compiled code disagreed with the interpreter; left interpreted`);
}
