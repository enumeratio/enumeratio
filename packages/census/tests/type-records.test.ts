// The typed rows in the records are written by scripts/type-records.ts; a package that changes
// what it does to a head leaves its row stale until the script is run again.

import { headNames, readEntry, recordDirs } from "@enumeratio/entry/node";
import { expect, test } from "vite-plus/test";
import { contributions, ENGINE } from "../src/contributions.ts";

const PACKAGES = new URL("../../", import.meta.url).pathname;
const packageOf = (library: string | undefined): string =>
  library === undefined ? ENGINE : library.replace(/^@enumeratio\//, "").replace(/^enumeratio-/, "");
const libraryOf = (pkg: string): string => (pkg === ENGINE ? ENGINE : `enumeratio-${pkg}`);

test("each record's typed rows say what its package does to the head", () => {
  const records = new Map<string, ReturnType<typeof readEntry>>();
  // reference's own copy is the canonical one, as in the script.
  const dirs = recordDirs(PACKAGES).toSorted(
    (a, b) => Number(b.package === "reference") - Number(a.package === "reference"),
  );
  for (const { dir } of dirs)
    for (const head of headNames(dir)) {
      const entry = readEntry(dir, head);
      if (!records.has(entry.name)) records.set(entry.name, entry);
    }

  const stale: string[] = [];
  for (const [head, list] of contributions()) {
    const rows = records.get(head)?.signatures ?? [];
    for (const c of list) {
      const row = rows.find((r) => packageOf(r.library) === c.pkg) as
        | { type?: string; overrides?: string; on?: string[]; symbols?: string[]; types?: string[] }
        | undefined;
      const same =
        row !== undefined &&
        row.type === c.type &&
        row.overrides === (c.previous === undefined ? undefined : libraryOf(c.previous)) &&
        JSON.stringify(row.on) === JSON.stringify(c.on) &&
        JSON.stringify(row.symbols) === JSON.stringify(c.symbols) &&
        JSON.stringify(row.types) === JSON.stringify(c.types);
      if (!same) stale.push(`${head} (${c.pkg})`);
    }
  }
  // Fix with `vp node packages/census/scripts/type-records.ts`.
  expect(stale).toEqual([]);
}, 60_000); // declares every package, several seconds on a CI runner
