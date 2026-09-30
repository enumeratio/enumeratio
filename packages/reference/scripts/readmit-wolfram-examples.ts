// Bring triaged Wolfram examples back once a lane has decided them. A decision file maps
// `Head/id` to `{ action, kind?, note }`:
//
//   classify   the row goes back as it was adopted, with Wolfram's answer and the lane's
//              kind and note (a documented divergence, not a bug)
//   fixed      our side changed: released for the adopter to evaluate again, then scan and prune
//   compare    the comparison changed: released the same way
//   gap        stays in triage, the note its reason
//   emit/adapt bounced to that bucket, stays in triage
//
//   node packages/reference/scripts/readmit-wolfram-examples.ts .git/lanes/data/farm-decisions/A-130.json …
//
// It prints the heads it released; adopt those, scan the new rows, prune (see the prune
// script's header).

import { readFileSync, writeFileSync } from "node:fs";
import { bySection, dedupeId, type ReferenceExample } from "@enumeratio/entry";
import { writeHead } from "@enumeratio/entry/node";
import { loadReferenceData, PACKAGES } from "../src/node.ts";
import { readTriage, TRIAGE, type TriageRow } from "./wolfram-cache.ts";

interface Decision {
  readonly action: "classify" | "fixed" | "compare" | "gap" | "emit" | "adapt";
  readonly kind?: string;
  readonly note: string;
}

const decisions: Record<string, Decision> = Object.assign(
  {},
  ...process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, "utf8")) as Record<string, Decision>),
);
const triage = readTriage();
const { heads } = loadReferenceData(PACKAGES);
const released = new Set<string>();
const classified: Record<string, TriageRow[]> = {};
const counts: Record<string, number> = {};

for (const [head, rows] of Object.entries(triage)) {
  const left: TriageRow[] = [];
  for (const row of rows) {
    const decision = decisions[`${head}/${row.id}`];
    if (decision === undefined) {
      left.push(row);
      continue;
    }
    counts[decision.action] = (counts[decision.action] ?? 0) + 1;
    if (decision.action === "classify") (classified[head] ??= []).push({ ...row, bucket: decision.kind ?? "classify" });
    else if (decision.action === "fixed" || decision.action === "compare") released.add(head);
    else left.push({ ...row, bucket: decision.action, reason: decision.note });
  }
  if (left.length > 0) triage[head] = left;
  else delete triage[head];
}

// A classified row goes back with its Wolfram run, and the lane's kind and note beside it.
for (const [head, rows] of Object.entries(classified)) {
  const loaded =
    heads.find((h) => h.head === head && h.entry.examples.length > 0) ?? heads.find((h) => h.head === head);
  if (loaded === undefined) continue;
  const ids = new Set(loaded.entry.examples.map((e) => e.id));
  const implementations = { ...loaded.implementations } as Record<string, Record<string, unknown>>;
  const examples: ReferenceExample[] = [];
  for (const row of rows) {
    const id = ids.has(row.id) ? dedupeId(row.id, ids) : row.id;
    ids.add(id);
    examples.push({ ...row.example, id });
    const decision = decisions[`${head}/${row.id}`]!;
    implementations[id] = {
      ...implementations[id],
      wolfram: {
        in: row.in ?? "",
        out: row.wolfram ?? "",
        verdict: row.verdict,
        kind: decision.kind,
        note: decision.note,
      },
    };
  }
  await writeHead(loaded.dir, head, {
    entry: { ...loaded.entry, examples: bySection([...loaded.entry.examples, ...examples]) },
    implementations: implementations as never,
    body: loaded.body,
  });
}

// Released rows have left the set: the adopter writes them again with a fresh evaluation.
writeFileSync(TRIAGE, `${JSON.stringify(triage, null, 1)}\n`);
process.stderr.write(`${JSON.stringify(counts)}; released ${released.size} heads\n`);
process.stdout.write([...released].join(" "));
