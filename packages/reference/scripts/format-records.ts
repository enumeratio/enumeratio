// Rewrite every head's record through the one writer (@enumeratio/entry/node's writeHead),
// leaving the data as it is: after a merge, or a hand edit that left a file in another style.
// The writer puts each section's rows together, in page order, keeping their order within it.
//
//   node packages/reference/scripts/format-records.ts

import { headNames, isWrittenHead, readHead, recordDirs, writeHead } from "@enumeratio/entry/node";
import { PACKAGES } from "../src/node.ts";

let rewritten = 0;
let heads = 0;
// An installed library's records are its own repository's to format.
for (const { dir } of recordDirs(PACKAGES).filter((p) => p.installed !== true))
  for (const head of headNames(dir)) {
    heads++;
    if ((await isWrittenHead(dir, head)).length === 0) continue;
    await writeHead(dir, head, readHead(dir, head));
    rewritten++;
  }
console.log(`${rewritten} of ${heads} records rewritten`);
