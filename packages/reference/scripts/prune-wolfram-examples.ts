// Take adopted Wolfram documentation examples out of the records until Wolfram agrees with
// them. An adopted row's `expected` is only our answer, so it stays once `oracle-scan.ts
// wolfram --accept` has run over it and said `agree`. A mismatch is a symptom, not a verdict
// on the example: it goes to the triage set (`triage.json`), with its Wolfram input and
// answer and a first-guess bucket (`bucketOf`), for a lane to fix and bring back classified
// or as a regression example. A particular value (`known`) was already checked against
// Wolfram's data, so it stays unless Wolfram's kernel disagrees with its own data
// (`ChebyshevT[2, Infinity]` is `Indeterminate` there, `Infinity` in MathematicalFunctionData).
//
//   node packages/reference/scripts/adopt-wolfram-examples.ts
//   node packages/reference/scripts/oracle-scan.ts wolfram --accept \
//     --ids "$(node packages/reference/scripts/prune-wolfram-examples.ts --ids)"
//   node packages/reference/scripts/prune-wolfram-examples.ts [--triage-out <file>]
//
// Scan the adopted rows only (`--ids`): a scan over whole heads re-answers their other
// examples too.
//
//   … --drop Shape/some-id,Unique/other-id   take these back for good (`declined.json`)
//   … --rebucket                             re-read the triage set's buckets (after a fix)
//   … --release adapt                        hand a bucket back to the adopter (after its fix)
//
// Only an example that's wrong as an example is declined -- one that leaks state into the
// others (a free `f` the engine then types). The adopter writes neither set again.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { writeHead } from "@enumeratio/entry/node";
import { emit } from "@enumeratio/oracle/src";
import { loadReferenceData, PACKAGES } from "../src/node.ts";
import { ADOPTED, decline, readTriage, TRIAGE, type TriageRow } from "./wolfram-cache.ts";
import { bucketOf } from "./wolfram-examples.ts";

if (!existsSync(ADOPTED)) throw new Error(`nothing adopted yet: ${ADOPTED} is missing`);
const adopted = JSON.parse(readFileSync(ADOPTED, "utf8")) as Record<string, string[]>;
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

/** The Wolfram source the scan used, or what we'd emit now, or the heads that stop it. */
const emitted = (expr: unknown, scanned: string | undefined): { in?: string; missing?: readonly string[] } => {
  if (scanned) return { in: scanned };
  const out = emit(expr as never, "wolfram");
  return out.ok ? { in: out.source } : { missing: out.missing };
};

const { heads } = loadReferenceData(PACKAGES);
const triage = readTriage();
// Out of the triage set, for the adopter to write again with a fresh evaluation (after a fix
// to that bucket's cause); prints the heads to adopt.
const release = flag("--release");
if (release !== undefined) {
  const heads: string[] = [];
  for (const [head, rows] of Object.entries(triage)) {
    const left = rows.filter((r) => r.bucket !== release);
    if (left.length < rows.length) heads.push(head);
    if (left.length > 0) triage[head] = left;
    else delete triage[head];
  }
  writeFileSync(TRIAGE, `${JSON.stringify(triage, null, 1)}\n`);
  process.stdout.write(heads.join(" "));
  process.exit(0);
}
// Re-read every row in the set against the current transpiler and buckets.
if (process.argv.includes("--rebucket"))
  for (const [head, rows] of Object.entries(triage))
    triage[head] = rows.map((r) => {
      const { in: _in, missing: _missing, ...rest } = r;
      const row = { ...rest, ...emitted(r.expr, r.wolfram === undefined ? undefined : r.in) };
      // A lane's decision (it gave a reason) stands; only a first guess is guessed again.
      return { ...row, bucket: r.reason === undefined ? bucketOf(row) : r.bucket };
    });
const declined: Record<string, unknown[]> = {};
const kept: Record<string, string[]> = {};
const moved: Record<string, number> = {};
for (const [head, ids] of Object.entries(adopted)) {
  const loaded = heads.find((h) => h.head === head && h.entry.examples.some((e) => ids.includes(e.id)));
  if (loaded === undefined) continue;
  const { dir, entry, body, implementations = {} } = loaded;
  const out = new Set<string>();
  for (const example of entry.examples) {
    if (!ids.includes(example.id)) continue;
    if (byHand.has(`${head}/${example.id}`)) {
      out.add(example.id);
      (declined[head] ??= []).push(example.expr);
      continue;
    }
    const wolfram = implementations[example.id]?.wolfram;
    const verdict = wolfram === undefined ? "unscanned" : !wolfram.out ? "no answer" : (wolfram.verdict ?? "agree");
    if (verdict === "agree") continue;
    if (example.known !== undefined && ["unscanned", "no answer", "inconclusive"].includes(verdict)) continue;
    out.add(example.id);
    const row = {
      expr: example.expr,
      ours: example.expected,
      ...emitted(example.expr, wolfram?.in),
      wolfram: wolfram?.out,
      verdict,
    };
    triage[head] = [
      ...(triage[head] ?? []).filter((r) => JSON.stringify(r.expr) !== JSON.stringify(example.expr)),
      { id: example.id, ...row, bucket: bucketOf(row), example },
    ];
    moved[verdict] = (moved[verdict] ?? 0) + 1;
  }
  kept[head] = ids.filter((id) => !out.has(id));
  if (out.size === 0) continue;
  const rows = Object.fromEntries(Object.entries(implementations).filter(([id]) => !out.has(id)));
  await writeHead(dir, head, {
    entry: { ...entry, examples: entry.examples.filter((e) => !out.has(e.id)) },
    implementations: Object.keys(rows).length > 0 ? rows : undefined,
    body,
  });
}
decline(declined);
writeFileSync(TRIAGE, `${JSON.stringify(triage, null, 1)}\n`);
writeFileSync(ADOPTED, `${JSON.stringify(kept, null, 1)}\n`);

// For the lanes: the triage set without the example rows it would be written back from.
const lanes = flag("--triage-out");
if (lanes !== undefined) {
  const slim = Object.fromEntries(
    Object.entries(triage).map(([head, rows]) => [head, rows.map(({ example: _example, ...row }) => row)]),
  );
  writeFileSync(lanes, `${JSON.stringify(slim, null, 1)}\n`);
}

const count = (o: Readonly<Record<string, readonly unknown[]>>): number =>
  Object.values(o).reduce((n, r) => n + r.length, 0);
const buckets: Record<string, number> = {};
for (const row of Object.values(triage).flat() as TriageRow[]) buckets[row.bucket] = (buckets[row.bucket] ?? 0) + 1;
process.stderr.write(
  `to triage ${JSON.stringify(moved)}, declined ${count(declined)}, kept ${count(kept)}; ` +
    `triage set ${count(triage)} ${JSON.stringify(buckets)}\n`,
);
