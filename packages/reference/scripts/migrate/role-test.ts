// design/examples-as-data.md §5: `hidden: true` becomes `role: test`, in place. The field says
// what the example is for; the page skips a test example because of that.
//
//   node packages/reference/scripts/migrate/role-test.ts

import { readFileSync } from "node:fs";
import { parseYaml } from "@enumeratio/entry";
import { writeYaml } from "@enumeratio/entry/node";
import { loadReferenceData, PACKAGES } from "../../src/node.ts";

const { heads } = loadReferenceData(PACKAGES);
let moved = 0;
for (const { entryPath } of heads) {
  const entry = parseYaml(readFileSync(entryPath, "utf8")) as { examples: Record<string, unknown>[] };
  if (!entry.examples.some((e) => "hidden" in e)) continue;
  entry.examples = entry.examples.map((example) =>
    Object.fromEntries(
      Object.entries(example).flatMap(([key, value]) => {
        if (key !== "hidden") return [[key, value]];
        if (value !== true) return [];
        moved++;
        return [["role", "test"]];
      }),
    ),
  );
  await writeYaml(entryPath, entry);
}
console.log(`${moved} examples are role: test`);
