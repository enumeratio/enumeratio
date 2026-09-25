// The backlog of heads to add (src/backlog.ts) is data the reference will grow into, so it
// is held to the same standard as an aspirational example: every example still evaluates,
// none is met yet, and a head leaves the backlog the moment it gets an entry.
import { runCases } from "@enumeratio/aestimatio/src/node";
import { expect, test } from "vite-plus/test";
import { backlog, entries } from "../src/index.ts";

const documented = new Set(entries.map((entry) => entry.name));

test("no backlog head is already documented", () => {
  // Documenting a head means moving its record into an entry file: its examples become the
  // entry's, flagged `aspirational` where they are still not met.
  expect(backlog.map((head) => head.name).filter((name) => documented.has(name))).toEqual([]);
});

test("every backlog head is needed by something we document, or by another backlog head", () => {
  const known = new Set([...documented, ...backlog.map((head) => head.name)]);
  expect(
    backlog.flatMap((head) =>
      head.neededBy.filter((name) => !known.has(name)).map((name) => `${head.name} ← ${name}`),
    ),
  ).toEqual([]);
});

test("no backlog head repeats an example", () => {
  expect(
    backlog.filter(
      (head) =>
        new Set(head.examples.map((example) => JSON.stringify(example.expr))).size !==
        head.examples.length,
    ),
  ).toEqual([]);
});

// Same caps and setup as entries.test.ts.
const setup = new URL("../scripts/engines.ts", import.meta.url).href;
const TIME_MS = 10_000;
const MEMORY_BYTES = 512 * 1024 * 1024;

const id = (name: string, index: number): string => `${name}#${index}`;
const results = await runCases(
  backlog.flatMap((head) =>
    head.examples.map((example, index) => ({ id: id(head.name, index), input: example.expr })),
  ),
  { setup, timeMs: TIME_MS, memoryBytes: MEMORY_BYTES, materialize: true, concurrency: 3 },
);
const resultById = new Map(results.map((result) => [result.id, result]));

for (const head of backlog) {
  for (const [index, example] of head.examples.entries()) {
    test(`backlog ${head.name} example ${index + 1}`, () => {
      const result = resultById.get(id(head.name, index));
      expect(result?.outcome, result?.outcome === "Error" ? result.reason : undefined).toBe(
        "Evaluated",
      );
      // Not met yet. When this starts matching, the head (or this call form) has arrived:
      // give it an entry and move the example there.
      expect(result?.value).not.toEqual(example.expected);
    });
  }
}
