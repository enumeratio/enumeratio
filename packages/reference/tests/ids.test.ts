import { entries as collectionsEntries } from "@enumeratio/collections/reference";
import { entries as domainsEntries } from "@enumeratio/domains/reference";
import { EXAMPLE_ID, EXAMPLE_ID_MAX } from "@enumeratio/entry";
import { entries as statisticsEntries } from "@enumeratio/statistics/reference";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/index.ts";

// Every example is addressed by `<Head>/<id>`: the page anchor `#example/<id>`, the test
// name, the oracle row. One id space per head, across every package documenting it.
const HOW =
  "give it an `id` (lowercase words joined by `-`, at most 48 characters), unique within its head, or run `node packages/reference/scripts/migrate/add-ids.ts --write` to assign the missing ones; once published, keep an id when you edit the example";

test("every example has a well-formed id, unique within its head", () => {
  const seen = new Map<string, Set<string>>();
  const problems: string[] = [];
  for (const entry of [
    ...entries,
    ...collectionsEntries,
    ...statisticsEntries,
    ...domainsEntries,
  ]) {
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
