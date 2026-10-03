// Put adopted Wolfram documentation examples Wolfram doesn't agree with into triage. An
// adopted row's `expected` is only our answer, so it stands once `oracle-scan.ts wolfram
// --accept` has run over it and said `agree`. A mismatch is a symptom, not a verdict on the
// example: the row stays in its record as `role: triage`, with a first-guess bucket
// (`bucketOf`), for a lane to fix and settle -- classified, or as a regression example. Tests,
// scans and the page leave triage rows out. A particular value (`known`) was already checked
// against Wolfram's data, so it stays unless Wolfram's kernel disagrees with its own data
// (`ChebyshevT[2, Infinity]` is `Indeterminate` there, `Infinity` in MathematicalFunctionData).
//
//   node packages/reference/scripts/adopt-wolfram-examples.ts
//   node packages/reference/scripts/oracle-scan.ts wolfram --accept \
//     --ids "$(node packages/reference/scripts/prune-wolfram-examples.ts --ids)"
//   node packages/reference/scripts/prune-wolfram-examples.ts
//
// Scan the adopted rows only (`--ids`): a scan over whole heads re-answers their other
// examples too.
//
//   … --drop Shape/some-id,Unique/other-id   take these out for good (`declined.json`)
//   … --rebucket                             guess again the buckets no lane has decided
//   … --release adapt                        take a bucket's rows out, for the adopter to
//                                            write again with a fresh evaluation (after a fix)
//   … --triage-out <file>                    also write the triage set as JSON, by head
//
// Only an example that's wrong as an example is declined -- one that leaks state into the
// others (a free `f` the engine then types). The adopter doesn't write it again.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { emit } from "@enumeratio/oracle";
import { loadReferenceData, PACKAGES } from "../src/node.ts";
import { rewriteExamples, triageRows } from "./triage-records.ts";
import { ADOPTED, decline } from "./wolfram-cache.ts";
import { bucketOf } from "./wolfram-examples.ts";

const adopted: Record<string, string[]> = existsSync(ADOPTED) ? JSON.parse(readFileSync(ADOPTED, "utf8")) : {};
if (process.argv.includes("--ids")) {
  process.stdout.write(
    Object.entries(adopted)
      .flatMap(([head, ids]) => ids.map((id) => `${head}/${id}`))
      .join(","),
  );
  process.exit(0);
}
const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const byHand = new Set((flag("--drop") ?? "").split(",").filter(Boolean));
const release = flag("--release");
const rebucket = process.argv.includes("--rebucket");

/** The Wolfram source the scan used, or what we'd emit now, or the heads that stop it. */
const emitted = (expr: unknown, scanned: unknown): { in?: string; missing?: readonly string[] } => {
  if (typeof scanned === "string" && scanned !== "") return { in: scanned };
  const out = emit(expr as never, "wolfram");
  return out.ok ? { in: out.source } : { missing: out.missing };
};
const verdictOf = (wolfram: Record<string, unknown> | undefined): string =>
  wolfram === undefined ? "unscanned" : !wolfram["out"] ? "no answer" : ((wolfram["verdict"] as string) ?? "agree");

const declined: Record<string, unknown[]> = {};
const moved: Record<string, number> = {};
const released = new Set<string>();

for (const loaded of loadReferenceData(PACKAGES).heads) {
  const ids = new Set(adopted[loaded.head] ?? []);
  await rewriteExamples(loaded, (example, wolfram) => {
    const inTriage = example.role === "triage";
    const row = () => ({
      expr: example.expr,
      ours: example.expected,
      ...emitted(example.expr, wolfram?.["in"]),
      wolfram: wolfram?.["out"] as string | undefined,
      verdict: verdictOf(wolfram),
    });
    if (byHand.has(`${loaded.head}/${example.id}`)) {
      (declined[loaded.head] ??= []).push(example.expr);
      return undefined;
    }
    if (inTriage && release !== undefined && example.triage === release) {
      released.add(loaded.head);
      return undefined;
    }
    // A bucket a lane decided (it gave a reason) stands; only a first guess is guessed again.
    if (inTriage && rebucket && !wolfram?.["note"]) {
      const bucket = bucketOf(row());
      return bucket === example.triage ? "keep" : { example: { ...example, triage: bucket } };
    }
    if (inTriage || !ids.has(example.id)) return "keep";
    const verdict = verdictOf(wolfram);
    if (verdict === "agree") return "keep";
    if (example.known !== undefined && ["unscanned", "no answer", "inconclusive"].includes(verdict)) return "keep";
    moved[verdict] = (moved[verdict] ?? 0) + 1;
    return { example: { ...example, role: "triage", triage: bucketOf(row()) } };
  });
}
decline(declined);

// What's still adopted and settled: the rows prune looks at again after the next scan.
const { heads } = loadReferenceData(PACKAGES);
const kept: Record<string, string[]> = {};
for (const { head, entry } of heads) {
  const ids = new Set(adopted[head] ?? []);
  const still = entry.examples.filter((e) => ids.has(e.id) && e.role !== "triage").map((e) => e.id);
  if (still.length > 0) kept[head] = still;
}
writeFileSync(ADOPTED, `${JSON.stringify(kept, null, 1)}\n`);

const rows = triageRows(heads);
const lanes = flag("--triage-out");
if (lanes !== undefined) {
  const byHead: Record<string, unknown[]> = {};
  for (const { head, ...row } of rows) (byHead[head] ??= []).push(row);
  writeFileSync(lanes, `${JSON.stringify(byHead, null, 1)}\n`);
}
if (release !== undefined) process.stdout.write([...released].join(" "));

const buckets: Record<string, number> = {};
for (const row of rows) buckets[row.bucket] = (buckets[row.bucket] ?? 0) + 1;
const total = (o: Readonly<Record<string, readonly unknown[]>>): number =>
  Object.values(o).reduce((n, r) => n + r.length, 0);
process.stderr.write(
  `to triage ${JSON.stringify(moved)}, declined ${total(declined)}, released ${released.size} heads, ` +
    `kept ${total(kept)}; in triage ${rows.length} ${JSON.stringify(buckets)}\n`,
);
