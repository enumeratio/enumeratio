import { EXAMPLE_ID, EXAMPLE_ID_MAX } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { referenceData } from "../src/node.ts";

// Every example is addressed by `<Head>/<id>`: the page anchor `#example/<id>`, the test
// name, the oracle row. One id space per head, across every package documenting it.
const HOW =
  "give it an `id` (lowercase words joined by `-`, at most 48 characters), unique within its head; once published, keep an id when you edit the example";

test("every example has a well-formed id, unique within its head", () => {
  const seen = new Map<string, Set<string>>();
  const problems: string[] = [];
  for (const { entry } of referenceData().heads) {
    const ids = seen.get(entry.name) ?? new Set<string>();
    seen.set(entry.name, ids);
    entry.examples.forEach((example, i) => {
      const { id } = example as { id?: unknown };
      const where = `${entry.name} example ${i + 1}`;
      if (typeof id !== "string" || !EXAMPLE_ID.test(id) || id.length > EXAMPLE_ID_MAX)
        problems.push(`${where}: bad id ${JSON.stringify(id)}`);
      else if (ids.has(id)) problems.push(`${where}: duplicate id "${id}"`);
      else ids.add(id);
    });
  }
  expect(problems, HOW).toEqual([]);
});
