// What every consumer sees of the entries, as JSON: the flip's before/after check.
//   node packages/reference/scripts/migrate/dump.ts <out.json>
import { writeFileSync } from "node:fs";
import { entries as collections } from "@enumeratio/collections/reference";
import { entries as domains } from "@enumeratio/domains/reference";
import { entries as statistics } from "@enumeratio/statistics/reference";
import { entries, entryFiles, oracleKernels } from "../../src/entries.ts";

writeFileSync(
  process.argv[2]!,
  JSON.stringify({ entries, entryFiles, oracleKernels, collections, statistics, domains }),
);
