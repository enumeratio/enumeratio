// Settle triage rows (`role: triage`) once a lane has decided them. A decision file maps
// `Head/id` to `{ action, kind?, note }`:
//
//   classify   the row becomes an example like any other, its Wolfram row carrying the lane's
//              kind and note (a documented divergence, not a bug)
//   fixed      our side changed: taken out, for the adopter to evaluate again, then scan and prune
//   compare    the comparison changed: taken out the same way
//   gap        stays in triage, the note its reason
//   emit/adapt stays in triage in that bucket, the note its reason
//
//   node packages/reference/scripts/readmit-wolfram-examples.ts .git/lanes/data/farm-decisions/A-130.json …
//
// It prints the heads it took rows out of; adopt those, scan the new rows, prune (see the
// prune script's header).

import { readFileSync } from "node:fs";
import type { TriageBucket } from "@enumeratio/entry";
import { loadReferenceData, PACKAGES } from "../src/node.ts";
import { rewriteExamples, settle } from "./triage-records.ts";

interface Decision {
  readonly action: "classify" | "fixed" | "compare" | "gap" | "emit" | "adapt";
  readonly kind?: string;
  readonly note: string;
}

const decisions: Record<string, Decision> = Object.assign(
  {},
  ...process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, "utf8")) as Record<string, Decision>),
);
const released = new Set<string>();
const counts: Record<string, number> = {};

for (const loaded of loadReferenceData(PACKAGES).heads) {
  await rewriteExamples(loaded, (example, wolfram) => {
    const decision = example.role === "triage" ? decisions[`${loaded.head}/${example.id}`] : undefined;
    if (decision === undefined) return "keep";
    counts[decision.action] = (counts[decision.action] ?? 0) + 1;
    switch (decision.action) {
      case "classify":
        return { example: settle(example), wolfram: { ...wolfram, kind: decision.kind, note: decision.note } };
      case "fixed":
      case "compare":
        released.add(loaded.head);
        return undefined;
      default:
        return {
          example: { ...example, triage: decision.action as TriageBucket },
          wolfram: { ...wolfram, note: decision.note },
        };
    }
  });
}
process.stderr.write(`${JSON.stringify(counts)}; released ${released.size} heads\n`);
process.stdout.write([...released].join(" "));
