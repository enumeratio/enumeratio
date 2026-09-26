// Run every documented example through every wired system, and write its implementations record.
//
// The report is a work queue, not a verdict. Five outcomes per (example, system):
//
//   agree         the system got what we got — a candidate golden
//   disagree      it got something else. A formatter bug, a convention difference, or ours
//                 is wrong. All three have happened; none can be told apart automatically.
//   inconclusive  one side stayed symbolic where the other has a value
//   unmapped      no signature mapping yet. Says nothing about the mathematics, and is the
//                 cheapest thing to fix — the report ranks heads by how much they cost.
//   error         the system has the name but rejected the call, which usually means the
//                 mapping is there but its SHAPE is wrong.
//
// Wolfram answers as `FullForm`, which is parsed back to MathJSON and compared by value
// (structural.ts); the Python-family systems are compared as text (compare.ts), with a
// structural fallback (`comparePythonStructured`) for a Python literal against a shape we'd
// otherwise call a false disagreement.
//
// Nothing here is a gate: it needs external kernels. Run it, read it, classify any new
// `unclassified` rows the records pick up, commit the records.
//
//   vp node packages/reference/scripts/oracle-scan.ts --accept           # everything wired, written
//   vp node packages/reference/scripts/oracle-scan.ts wolfram sage       # some systems
//   vp node packages/reference/scripts/oracle-scan.ts --head PowerModList  # one head, fast iteration
//   vp node packages/reference/scripts/oracle-scan.ts --digest            # rebuild the digest only

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import {
  emit,
  type MathJSON,
  runIn,
  runKernel,
  SYSTEMS,
  type System,
  type Verdict,
  wiredSystems,
} from "@enumeratio/oracle/src";
import { orderImplementations, type SystemImplementation } from "@enumeratio/entry";
import { writeYaml } from "@enumeratio/entry/node";
import { referenceData, referenceEntries } from "../src/node.ts";
import { asksForDigits, show, verdictOf } from "./oracle-verdict.ts";

const data = referenceData();

interface Case {
  readonly id: string;
  readonly head: string;
  readonly key: string;
  readonly expr: MathJSON;
  readonly expected: MathJSON;
}

/** Keep a table cell readable, and never let a backtick break the markdown. */
const trim = (text: string): string => text.replace(/`/g, "'").replace(/\|/g, "/").slice(0, 90);

const args = process.argv.slice(2);
const headIndex = args.indexOf("--head");
const headFilter = headIndex >= 0 ? args[headIndex + 1] : undefined;
const requested = args.filter((argument, index) => !argument.startsWith("-") && args[index - 1] !== "--head");
// `--digest` scans nothing: it rebuilds `disagreements.md` from the committed records.
const digestOnly = args.includes("--digest");
// Without `--accept` a scan only reports (report.json, stderr); with it, what the kernels said
// goes into the records, and the digest follows. The explicit write is what a fixup PR carries.
const accept = args.includes("--accept");
const systems = (digestOnly ? [] : requested.length > 0 ? requested : wiredSystems()) as System[];

const cases: Case[] = referenceEntries(data).flatMap((entry) =>
  entry.examples
    .filter((example) => example.aspirational !== true)
    .map((example) => ({
      id: `${entry.name}/${example.id}`,
      head: entry.name,
      key: example.id,
      expr: example.expr as MathJSON,
      expected: example.expected as MathJSON,
    }))
    .filter((item) => headFilter === undefined || item.head === headFilter),
);

type Outcome = {
  readonly id: string;
  readonly source: string;
  readonly verdict: Verdict | "unmapped" | "error";
  readonly theirs: string;
  /** A reader-facing form of `theirs` — Wolfram's InputForm, or the Python `str(...)`. */
  readonly display: string;
  /** Wolfram's displayed digits, for an arbitrary-precision value. */
  readonly shown?: string;
  /** Wolfram's `TeXForm` of the input as written and of its value. */
  readonly tex?: { readonly input: string; readonly output: string };
};

const report: Record<string, Outcome[]> = {};
const missingBySystem: Record<string, Record<string, number>> = {};

// ── the implementations records ─────────────────────────────────────────────────
//
// One `<Head>.implementations.yaml` beside each `<Head>.yaml`, keyed by example id then
// system. A scan of a system rewrites only that system's rows (`in`, `out`, `tex`, `shown`,
// `verdict`) for the heads touched this run, keeps every other system's, carries the hand
// classification (`kind`, `note`, `issue`, `tolerance`) forward while the verdict holds, and
// drops rows for examples that no longer exist. A row with only a note (prose about a system
// the scan can't reach) stays until someone removes it.

type Record_ = Record<string, Record<string, SystemImplementation>>;
const recordPathOf = new Map<string, string>();
const records = new Map<string, Record_>();
const exampleIdsOf = new Map<string, string[]>();
for (const h of data.heads) {
  if (data.packageOf.get(h.head) !== h.package) continue;
  exampleIdsOf.set(
    h.head,
    h.entry.examples.map((e) => e.id),
  );
  recordPathOf.set(h.head, h.implementationsPath ?? join(dirname(h.entryPath), `${h.head}.implementations.yaml`));
  records.set(h.head, structuredClone((h.implementations ?? {}) as Record_));
}
const loaded = new Map([...records].map(([head, record]) => [head, structuredClone(record)]));

for (const system of systems) {
  const emitted = cases.map((item) => ({ item, out: emit(item.expr, system) }));
  const runnable = emitted.filter((row) => row.out.ok);
  const sources = runnable.map((row) => (row.out as { source: string }).source);
  process.stderr.write(`${system}: ${runnable.length}/${cases.length} emit — running…\n`);
  const results = await runIn(system, sources);

  const outcomes: Outcome[] = [];
  const missing: Record<string, number> = {};
  for (const row of emitted) {
    if (!row.out.ok) {
      for (const head of row.out.missing) missing[head] = (missing[head] ?? 0) + 1;
      outcomes.push({ id: row.item.id, source: "", verdict: "unmapped", theirs: "", display: "" });
    }
  }
  runnable.forEach((row, index) => {
    const source = sources[index] as string;
    const result = results[index] as {
      value?: string;
      display?: string;
      numeric?: string;
      shown?: string;
      tex?: { input: string; output: string };
      error?: string;
    };
    if (result.error !== undefined) {
      outcomes.push({
        id: row.item.id,
        source,
        verdict: "error",
        theirs: result.error,
        display: result.error,
      });
      return;
    }
    const theirs = result.value ?? "";
    const tolerance = records.get(row.item.head)?.[row.item.key]?.[system]?.tolerance;
    const verdict = verdictOf(system, row.item.expected, result, tolerance, asksForDigits(row.item.expr));
    outcomes.push({
      id: row.item.id,
      source,
      verdict,
      theirs,
      display: result.display ?? theirs,
      ...(result.shown === undefined ? {} : { shown: result.shown }),
      ...(result.tex === undefined ? {} : { tex: result.tex }),
    });
  });
  report[system] = outcomes;
  missingBySystem[system] = missing;

  const tally = new Map<string, number>();
  for (const outcome of outcomes) tally.set(outcome.verdict, (tally.get(outcome.verdict) ?? 0) + 1);
  process.stderr.write(`${system}: ${[...tally].map(([verdict, n]) => `${verdict} ${n}`).join(", ")}\n`);
}

// The heads costing the most coverage, across all systems — the queue, in priority order.
const cost = new Map<string, number>();
for (const missing of Object.values(missingBySystem)) {
  for (const [head, count] of Object.entries(missing)) {
    cost.set(head, (cost.get(head) ?? 0) + count);
  }
}
const queue = [...cost].sort((a, b) => b[1] - a[1]).slice(0, 30);

if (!digestOnly)
  writeFileSync(
    new URL("../golden/oracle/report.json", import.meta.url),
    `${JSON.stringify({ generated: new Date().toISOString(), systems, report, queue }, null, 2)}\n`,
  );

const kernelOf: Partial<Record<System, string>> = {};
if (systems.includes("wolfram")) {
  kernelOf.wolfram = (await runKernel("wolframscript", ["-code", "$Version"])).trim();
}
if (systems.includes("sage")) {
  kernelOf.sage = (await runKernel("sage", ["-c", "print(version())"])).trim();
}

const KERNELS = new URL("../../oracle/kernels.json", import.meta.url);
const kernels: Record<string, string> = { ...data.kernels };
for (const [system, version] of Object.entries(kernelOf)) kernels[system] = version as string;

const headsThisRun = new Set(cases.map((c) => c.head));
for (const system of systems) {
  const outcomeByCaseId = new Map((report[system] ?? []).map((o) => [o.id, o]));
  for (const head of headsThisRun) {
    const record = records.get(head) ?? {};
    const ofHead = cases.filter((c) => c.head === head);
    const current = new Set(ofHead.map((c) => c.key));
    const put = (id: string, row: SystemImplementation | undefined): void => {
      const { [system]: _old, ...rest } = record[id] ?? {};
      const next = row === undefined ? rest : { ...rest, [system]: row };
      if (Object.keys(next).length === 0) delete record[id];
      else record[id] = next;
    };
    // A row for an example that's gone, or aspirational now, goes.
    for (const id of Object.keys(record)) if (!current.has(id) && record[id]?.[system]) put(id, undefined);
    for (const item of ofHead) {
      const outcome = outcomeByCaseId.get(item.id);
      const prior = record[item.key]?.[system];
      if (outcome === undefined || outcome.verdict === "unmapped") {
        // Unmapped this run: the scanned part goes; a hand note stays.
        put(item.key, prior?.note ? { in: prior.in, note: prior.note } : undefined);
        continue;
      }
      // Anything but agreement needs a classification: one carries forward while the verdict
      // holds, and a verdict that moves is reviewed afresh. A tolerance is a property of the
      // example, so it carries forward regardless.
      const verdict = outcome.verdict;
      const same = prior?.out !== undefined && (prior.verdict ?? "agree") === verdict;
      put(item.key, {
        in: outcome.source,
        out: outcome.display,
        ...(outcome.shown === undefined ? {} : { shown: outcome.shown }),
        ...(outcome.tex === undefined ? {} : { tex: { in: outcome.tex.input, out: outcome.tex.output } }),
        ...(verdict === "agree" ? {} : { verdict }),
        ...(verdict === "agree"
          ? same && prior?.note
            ? { note: prior.note }
            : {}
          : {
              kind: same ? (prior?.kind ?? "unclassified") : "unclassified",
              note: same ? (prior?.note ?? "") : "",
              ...(same && prior?.issue !== undefined ? { issue: prior.issue } : {}),
            }),
        ...(prior?.tolerance === undefined ? {} : { tolerance: prior.tolerance, note: prior.note ?? "" }),
      });
    }
    records.set(head, record);
  }
}

// An unchanged record is left as it is on disk, so a rescan that finds nothing new leaves the
// tree clean (the nightly lanes fail on drift).
const written: string[] = [];
if (accept)
  for (const [head, record] of records) {
    if (isDeepStrictEqual(record, loaded.get(head))) continue;
    const path = recordPathOf.get(head)!;
    if (Object.keys(record).length === 0) {
      if (existsSync(path)) rmSync(path);
    } else
      await writeYaml(
        path,
        orderImplementations(
          record,
          exampleIdsOf.get(head) ?? [],
          SYSTEMS.map((s) => s.name),
        ),
      );
  }
if (accept && !isDeepStrictEqual(kernels, data.kernels))
  writeFileSync(
    KERNELS,
    `${JSON.stringify(
      Object.fromEntries(Object.entries(kernels).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
      null,
      2,
    )}\n`,
  );

const fresh = [...records].flatMap(([head, record]) =>
  Object.values(record).flatMap((bySystem) =>
    Object.entries(bySystem)
      .filter(([, row]) => row.kind === "unclassified")
      .map(([system]) => `${head} (${system})`),
  ),
);
if (fresh.length > 0) {
  process.stderr.write(`\nunclassified divergences: ${[...new Set(fresh)].join(", ")}\n`);
}

// A readable digest of the disagreements, COMMITTED — the records are regenerated per
// kernel version and are not worth diffing wholesale, but the disagreements are exactly the
// thing to review and to watch move over time. Built from every record rather than this
// run, so it covers every system scanned so far and a rescan that changes nothing leaves it
// identical — which is what lets the nightly lanes fail on drift.
const exampleAt = new Map(
  referenceEntries(data).flatMap((entry) =>
    entry.examples
      .filter((example) => example.aspirational !== true)
      .map((example) => [
        `${entry.name}\0${example.id}`,
        { id: `${entry.name}/${example.id}`, expected: example.expected as MathJSON },
      ]),
  ),
);
interface DigestRow {
  readonly id: string;
  readonly expected: MathJSON;
  readonly verdict: string;
  readonly kind?: string;
  readonly output: string;
}
const rowsBySystem = new Map<string, DigestRow[]>();
for (const [head, record] of records) {
  for (const [id, bySystem] of Object.entries(record)) {
    const example = exampleAt.get(`${head}\0${id}`);
    if (example === undefined) continue;
    for (const [system, row] of Object.entries(bySystem)) {
      if (row.out === undefined) continue;
      const rows = rowsBySystem.get(system) ?? [];
      rows.push({ ...example, verdict: row.verdict ?? "agree", kind: row.kind, output: row.out });
      rowsBySystem.set(system, rows);
    }
  }
}
const scanned = SYSTEMS.map((spec) => spec.name).filter((name) => rowsBySystem.has(name));

const lines: string[] = [
  "# Oracle disagreements",
  "",
  "Generated by `vp node packages/reference/scripts/oracle-scan.ts` from the implementations records. Each",
  "row is an example where an external system returned something other than our pinned",
  "`expected`. A row is NOT a bug report — it is one of three things, and telling them apart is",
  "the review:",
  "",
  "- **a formatter bug** — we emitted the wrong source, so the system answered a different question",
  "- **a convention difference** — both are right under their own definitions (rounding mode,",
  "  branch cut, signed versus unsigned Stirling numbers of the first kind)",
  "- **our bug** — the interesting case, and the reason this exists",
  "",
  "Classifications live in each head's `<Head>.implementations.yaml`, on the disagreeing row.",
  "Counts cover mapped examples only; unmapped ones have no row.",
  "",
];
for (const system of scanned) {
  const rows = (rowsBySystem.get(system) ?? []).sort((a, b) => a.id.localeCompare(b.id));
  const bad = rows.filter((row) => row.verdict === "disagree");
  const broken = rows.filter((row) => row.verdict === "error");
  const tally = (verdict: string) => rows.filter((row) => row.verdict === verdict).length;
  lines.push(
    `## ${system} — agree ${tally("agree")}, disagree ${bad.length}, inconclusive ${tally("inconclusive")}, error ${broken.length}`,
    "",
  );
  if (bad.length > 0) {
    lines.push("| example | kind | ours | theirs |", "| --- | --- | --- | --- |");
    for (const row of bad) {
      lines.push(`| \`${row.id}\` | ${row.kind ?? ""} | \`${trim(show(row.expected))}\` | \`${trim(row.output)}\` |`);
    }
    lines.push("");
  }
  if (broken.length > 0) {
    lines.push("<details><summary>errors — usually a mapping whose SHAPE is wrong</summary>", "");
    lines.push("| example | message |", "| --- | --- |");
    for (const row of broken) lines.push(`| \`${row.id}\` | \`${trim(row.output)}\` |`);
    lines.push("", "</details>", "");
  }
}
const digestUrl = new URL("../golden/oracle/disagreements.md", import.meta.url);
if (accept || digestOnly) {
  writeFileSync(digestUrl, `${lines.join("\n")}\n`);
  written.push(fileURLToPath(digestUrl));
  execFileSync("pnpm", ["exec", "vp", "fmt", ...written], { stdio: "inherit" });
} else if (systems.length > 0) {
  process.stderr.write("\nreport only: rerun with --accept to write the records\n");
}

process.stderr.write(`\nmost-wanted mappings:\n`);
for (const [head, count] of queue.slice(0, 12)) {
  process.stderr.write(`  ${head} — blocks ${count}\n`);
}
