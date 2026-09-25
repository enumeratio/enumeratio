// Rewrite every reference record through the one writer (@enumeratio/entry/node's writeYaml),
// leaving the data as it is: after a merge that took a hand-edited or older-style file.
//
//   node packages/reference/scripts/format-records.ts

import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { parseYaml } from "@enumeratio/entry";
import { isWrittenYaml, writeYaml } from "@enumeratio/entry/node";
import { loadReferenceData, PACKAGES } from "../src/node.ts";

const { heads, issues } = loadReferenceData(PACKAGES);
for (const { file, message } of issues) console.error(`${file}: ${message}`);
let rewritten = 0;
for (const { entryPath } of heads) {
  if (await isWrittenYaml(entryPath)) continue;
  const data = parseYaml(readFileSync(entryPath, "utf8"));
  await writeYaml(entryPath, data);
  if (!isDeepStrictEqual(parseYaml(readFileSync(entryPath, "utf8")), data))
    throw new Error(`${entryPath}: the rewrite changed the data`);
  rewritten++;
}
console.log(`${rewritten} of ${heads.length} records rewritten`);
