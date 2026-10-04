// A package's slice of the manifest (src/assemble.ts's `PackageIndex`), from its records: what
// packing writes for a library that leaves this repository, and what the build assembles from.
// Reads records only; loads no package's code.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeHead, EXAMPLES_FILE, headNames, INDEX_FILE, parseIndex } from "@enumeratio/entry/node";
import type { IndexedRecord, PackageIndex } from "../src/assemble.ts";

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** `pkg`'s index from the records in `dir` (its `reference/`), with its notation entry's specifier. */
export function packageIndexOf(pkg: string, dir: string | undefined, notation?: string): PackageIndex {
  const records = (dir === undefined || !existsSync(dir) ? [] : headNames(dir).toSorted(cmp)).map((head) => {
    const index = readFileSync(join(dir!, head, INDEX_FILE), "utf8");
    const tsv = join(dir!, head, EXAMPLES_FILE);
    const files = new Map([
      [INDEX_FILE, index],
      ...(existsSync(tsv) ? [[EXAMPLES_FILE, readFileSync(tsv, "utf8")] as const] : []),
    ]);
    // The examples its page shows and holds it to: not a bulk `test` row, nor one in triage.
    const examples = decodeHead(files).entry.examples.filter((e) => e.role !== "test" && e.role !== "triage").length;
    return { record: parseIndex(index).fields as unknown as IndexedRecord, examples };
  });
  return { package: pkg, ...(notation === undefined ? {} : { notation }), records };
}
