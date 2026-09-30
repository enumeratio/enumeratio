// The Wolfram triage backlog: examples with `role: triage`, by bucket and by head, as markdown.
// The nightly fixup routine posts it to one rolling issue and picks the next batch from it.
//
//   node packages/reference/scripts/triage-report.ts            the report
//   node packages/reference/scripts/triage-report.ts --json     the rows, for a lane

import { loadReferenceData, PACKAGES } from "../src/node.ts";
import { triageRows } from "./triage-records.ts";

const rows = triageRows(loadReferenceData(PACKAGES).heads);
if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(rows, null, 1)}\n`);
  process.exit(0);
}

const tally = (key: (row: (typeof rows)[number]) => string): [string, number][] => {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts].toSorted(([a, x], [b, y]) => y - x || a.localeCompare(b));
};
const byBucket = tally((r) => r.bucket);
const byHead = tally((r) => r.head);
const decided = rows.filter((r) => r.reason !== undefined).length;

const lines = [
  `## Triage backlog: ${rows.length} rows`,
  "",
  `Examples Wolfram disagrees with, waiting in their records as \`role: triage\` (${decided} with a lane's reason, ${rows.length - decided} first guesses).`,
  "",
  "| bucket | rows |",
  "| --- | ---: |",
  ...byBucket.map(([bucket, n]) => `| \`${bucket}\` | ${n} |`),
  "",
  "| head | rows | buckets |",
  "| --- | ---: | --- |",
  ...byHead.map(([head, n]) => {
    const buckets = tally((r) => (r.head === head ? r.bucket : ""))
      .filter(([b]) => b !== "")
      .map(([b, m]) => `${b} ${m}`)
      .join(", ");
    return `| ${head} | ${n} | ${buckets} |`;
  }),
];
process.stdout.write(`${lines.join("\n")}\n`);
