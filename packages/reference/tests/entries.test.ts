// Buildless src subpath: the reference tests must run without a prior `vp pack` of
// @enumeratio/analytic (CI runs tests before builds).
import { runCases } from "@enumeratio/aestimatio/src/node";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/index.ts";

/** Blank the values of rules keyed by one of `keys`, wherever they sit in the tree. */
const masked = (node: unknown, keys: ReadonlySet<string>): unknown => {
  if (!Array.isArray(node)) return node;
  const key = typeof node[1] === "string" ? node[1].replace(/^'|'$/g, "") : undefined;
  if ((node[0] === "Tuple" || node[0] === "KeyValuePair") && key !== undefined && keys.has(key)) {
    return [node[0], node[1], "…"];
  }
  return node.map((child) => masked(child, keys));
};

// `@enumeratio/aestimatio/node`'s `runCases` `setup` module — declares every library the
// reference engine declares (see scripts/engines.ts's own comment on why it's not
// `DECLARATIONS` verbatim: the worker's engine already has `@enumeratio/aestimatio`).
const setup = new URL("../scripts/engines.ts", import.meta.url).href;

/** Per-example caps: generous for a real reference example, tight enough that a runaway
 * one fails fast instead of hanging the suite or eating the machine's memory (this box
 * OOM'd once already — see design/aestimatio.md §3). */
const TIME_MS = 10_000;
const MEMORY_BYTES = 512 * 1024 * 1024;
// Modest on purpose: several examples can still exceed their own cap independently
// without piling up enough worker memory at once to matter.
const CONCURRENCY = 3;

const id = (entryName: string, index: number): string => `${entryName}#${index}`;

// Re-evaluate every documented example, each in its own worker with its own time/memory
// cap, and pin it to `expected`. A change in compute-engine's behaviour (or a bad example)
// fails here instead of shipping a wrong reference page; a runaway example fails as
// "Aborted" instead of hanging the whole suite.
const cases = entries.flatMap((entry) =>
  entry.examples.map((example, index) => ({ id: id(entry.name, index), input: example.expr })),
);
const results = await runCases(cases, {
  setup,
  timeMs: TIME_MS,
  memoryBytes: MEMORY_BYTES,
  concurrency: CONCURRENCY,
});
const resultById = new Map(results.map((result) => [result.id, result]));

for (const entry of entries) {
  for (const [index, example] of entry.examples.entries()) {
    const label = example.aspirational ? " (gap)" : "";
    test(`${entry.name} example ${index + 1}${label}`, () => {
      const result = resultById.get(id(entry.name, index));
      if (result === undefined) {
        throw new Error(`runCases: no result for ${entry.name} example ${index + 1}`);
      }
      if (result.outcome === "Error") {
        throw new Error(`evaluation raised: ${result.reason}`);
      }
      if (result.outcome === "Aborted") {
        throw new Error(
          `exceeded the ${TIME_MS}ms/${MEMORY_BYTES}-byte cap — tighten the example or raise the cap`,
        );
      }

      const volatile = new Set(example.volatile ?? []);
      const output = masked(result.value, volatile);
      const expected = masked(example.expected, volatile);
      if (example.aspirational) {
        // A documented capability gap: CE should NOT yet match the borrowed
        // target. If this starts matching, promote it (drop `aspirational`).
        expect(output).not.toEqual(expected);
      } else {
        expect(output).toEqual(expected);
      }
    });
  }
}
