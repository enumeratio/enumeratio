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
for (const path of heads.flatMap((h) => (h.examplesPath ? [h.entryPath, h.examplesPath] : [h.entryPath]))) {
  if (await isWrittenYaml(path)) continue;
  const data = parseYaml(readFileSync(path, "utf8"));
  await writeYaml(path, data);
  if (!isDeepStrictEqual(parseYaml(readFileSync(path, "utf8")), data))
    throw new Error(`${path}: the rewrite changed the data`);
  rewritten++;
}
console.log(`${rewritten} files rewritten`);
