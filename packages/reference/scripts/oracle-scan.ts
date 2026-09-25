// Run every documented example through every wired system, and write the oracle sidecars.
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
// `unclassified` rows the sidecars pick up, commit the sidecars.
//
//   vp node packages/reference/scripts/oracle-scan.ts                    # everything wired
//   vp node packages/reference/scripts/oracle-scan.ts wolfram sage       # some systems
//   vp node packages/reference/scripts/oracle-scan.ts --head PowerModList  # one head, fast iteration
//   vp node packages/reference/scripts/oracle-scan.ts --digest            # rebuild the digest only

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
import { entryFiles } from "../src/entries.ts";
import { show, verdictOf } from "./oracle-verdict.ts";

interface Case {
  readonly id: string;
  readonly stem: string;
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
const requested = args.filter(
  (argument, index) => !argument.startsWith("-") && args[index - 1] !== "--head",
);
// `--digest` scans nothing: it rebuilds `disagreements.md` from the committed sidecars.
const digestOnly = args.includes("--digest");
const systems = (digestOnly ? [] : requested.length > 0 ? requested : wiredSystems()) as System[];

const cases: Case[] = entryFiles.flatMap(({ stem, entries }) =>
  entries.flatMap((entry) =>
    entry.examples
      .filter((example) => example.aspirational !== true)
      .map((example) => ({
        id: `${entry.name}/${example.id}`,
        stem,
        head: entry.name,
        key: example.id,
        expr: example.expr as MathJSON,
        expected: example.expected as MathJSON,
      }))
      .filter((item) => headFilter === undefined || item.head === headFilter),
  ),
);

type Outcome = {
  readonly id: string;
  readonly source: string;
  readonly verdict: Verdict | "unmapped" | "error";
  readonly theirs: string;
  /** A reader-facing form of `theirs` — Wolfram's InputForm, or the Python `str(...)`. */
  readonly display: string;
  /** Wolfram's `TeXForm` of the input as written and of its value. */
  readonly tex?: { readonly input: string; readonly output: string };
};

const report: Record<string, Outcome[]> = {};
const missingBySystem: Record<string, Record<string, number>> = {};

/** A committed row's `tolerance`, read before the sidecars are loaded for rewriting. */
const toleranceOf = (() => {
  const cache = new Map<
    string,
    Record<string, Record<string, Record<string, { tolerance?: number }>>>
  >();
  return (item: Case, system: string): number | undefined => {
    if (!cache.has(item.stem)) {
      const url = new URL(`../src/entries/${item.stem}.oracle.json`, import.meta.url);
      cache.set(item.stem, existsSync(url) ? JSON.parse(readFileSync(url, "utf8")).examples : {});
    }
    return cache.get(item.stem)?.[item.head]?.[item.key]?.[system]?.tolerance;
  };
})();

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
    const tolerance = toleranceOf(row.item, system);
    const verdict = verdictOf(system, row.item.expected, result, tolerance);
    outcomes.push({
      id: row.item.id,
      source,
      verdict,
      theirs,
      display: result.display ?? theirs,
      ...(result.tex === undefined ? {} : { tex: result.tex }),
    });
  });
  report[system] = outcomes;
  missingBySystem[system] = missing;

  const tally = new Map<string, number>();
  for (const outcome of outcomes) tally.set(outcome.verdict, (tally.get(outcome.verdict) ?? 0) + 1);
  process.stderr.write(
    `${system}: ${[...tally].map(([verdict, n]) => `${verdict} ${n}`).join(", ")}\n`,
  );
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

// ── the per-entry-file sidecars ──────────────────────────────────────────────────
//
// One `<stem>.oracle.json` beside each entries/<stem>.ts, keyed by head then by the
// example's `id` — the shape `entries.ts` reads back and the page looks
// examples up by. Scanning a system replaces only that system's rows for the heads touched
// this run (every head, unless `--head` narrowed it), keeping every other system's rows and
// dropping stale rows for examples that no longer exist.

interface OtherRow {
  readonly input: string;
  readonly output: string;
  readonly verdict: Verdict | "error";
  readonly kind?: string;
  readonly note?: string;
  readonly tolerance?: number;
  readonly issue?: number;
  readonly tex?: { readonly input: string; readonly output: string };
}
type Sidecar = {
  kernels: Record<string, string>;
  examples: Record<string, Record<string, Record<string, OtherRow>>>;
};

const sidecarUrl = (stem: string): URL =>
  new URL(`../src/entries/${stem}.oracle.json`, import.meta.url);
const loadSidecar = (stem: string): Sidecar => {
  const url = sidecarUrl(stem);
  if (!existsSync(url)) return { kernels: {}, examples: {} };
  return JSON.parse(readFileSync(url, "utf8")) as Sidecar;
};

const touchedStems = new Set(cases.map((c) => c.stem));
const sidecars = new Map(entryFiles.map((f) => [f.stem, loadSidecar(f.stem)]));

const kernelOf: Partial<Record<System, string>> = {};
if (systems.includes("wolfram")) {
  kernelOf.wolfram = (await runKernel("wolframscript", ["-code", "$Version"])).trim();
}
if (systems.includes("sage")) {
  kernelOf.sage = (await runKernel("sage", ["-c", "print(version())"])).trim();
}

for (const system of systems) {
  const outcomes = report[system] ?? [];
  // Every head touched this run, so a head with zero rows for `system` (all unmapped) still
  // gets its stale rows for that system cleared out below.
  const headsThisRun = new Set(cases.map((c) => c.head));
  const outcomeByCaseId = new Map(outcomes.map((o) => [o.id, o]));

  for (const stem of touchedStems) {
    const sidecar = sidecars.get(stem) as Sidecar;
    if (kernelOf[system] !== undefined) sidecar.kernels[system] = kernelOf[system] as string;
    const stemHeads = new Set(
      cases.filter((c) => c.stem === stem && headsThisRun.has(c.head)).map((c) => c.head),
    );
    for (const head of stemHeads) {
      const ofHead = cases.filter((c) => c.stem === stem && c.head === head);
      const currentKeys = new Set(ofHead.map((c) => c.key));
      const existingForHead = sidecar.examples[head] ?? {};
      // Drop this system's row for a key that no longer names a current example.
      for (const key of Object.keys(existingForHead)) {
        if (currentKeys.has(key)) continue;
        const row = existingForHead[key] as Record<string, OtherRow>;
        if (!(system in row)) continue;
        const { [system]: _dropped, ...rest } = row;
        if (Object.keys(rest).length === 0) delete existingForHead[key];
        else existingForHead[key] = rest;
      }
      for (const item of ofHead) {
        const outcome = outcomeByCaseId.get(item.id);
        const prior = existingForHead[item.key]?.[system];
        if (outcome === undefined || outcome.verdict === "unmapped") {
          // Unmapped this run: clear a stale row for this system, keep the others.
          if (prior === undefined) continue;
          const { [system]: _dropped, ...rest } = existingForHead[item.key] as Record<
            string,
            OtherRow
          >;
          if (Object.keys(rest).length === 0) delete existingForHead[item.key];
          else existingForHead[item.key] = rest;
          continue;
        }
        // Anything but agreement needs a classification; one carries forward while the
        // verdict holds, and a verdict that moves is reviewed afresh. A tolerance is a
        // property of the example, so it carries forward regardless.
        const same = prior?.verdict === outcome.verdict;
        const row: OtherRow = {
          input: outcome.source,
          output: outcome.display,
          verdict: outcome.verdict,
          ...(outcome.verdict === "agree"
            ? {}
            : {
                kind: same ? (prior?.kind ?? "unclassified") : "unclassified",
                note: same ? (prior?.note ?? "") : "",
                ...(same && prior?.issue !== undefined ? { issue: prior.issue } : {}),
              }),
          ...(prior?.tolerance === undefined
            ? {}
            : { tolerance: prior.tolerance, note: prior.note ?? "" }),
          ...(outcome.tex === undefined ? {} : { tex: outcome.tex }),
        };
        existingForHead[item.key] = { ...existingForHead[item.key], [system]: row };
      }
      // A head with no rows stays out, so a rescan leaves an untouched file identical.
      if (Object.keys(existingForHead).length > 0) sidecar.examples[head] = existingForHead;
      else delete sidecar.examples[head];
    }
  }
}

// An unchanged sidecar is left as it is on disk, however it happens to be formatted, so a
// rescan that finds nothing new leaves the tree clean (the nightly lanes fail on drift).
// Whatever is written goes through the repo formatter at the end, so it lands as committed.
const written: string[] = [];
for (const { stem } of entryFiles) {
  const sidecar = sidecars.get(stem) as Sidecar;
  const url = sidecarUrl(stem);
  if (existsSync(url) && isDeepStrictEqual(JSON.parse(readFileSync(url, "utf8")), sidecar))
    continue;
  writeFileSync(url, `${JSON.stringify(sidecar, null, 2)}\n`);
  written.push(fileURLToPath(url));
}

const fresh = [...sidecars.values()].flatMap((sidecar) =>
  Object.entries(sidecar.examples).flatMap(([head, byKey]) =>
    Object.entries(byKey).flatMap(([, bySystem]) =>
      Object.entries(bySystem)
        .filter(([, row]) => row.kind === "unclassified")
        .map(([system]) => `${head} (${system})`),
    ),
  ),
);
if (fresh.length > 0) {
  process.stderr.write(`\nunclassified divergences: ${[...new Set(fresh)].join(", ")}\n`);
}

// A readable digest of the disagreements, COMMITTED — the sidecars are regenerated per
// kernel version and are not worth diffing wholesale, but the disagreements are exactly the
// thing to review and to watch move over time. Built from every sidecar rather than this
// run, so it covers every system scanned so far and a rescan that changes nothing leaves it
// identical — which is what lets the nightly lanes fail on drift.
const exampleAt = new Map(
  entryFiles.flatMap(({ stem, entries }) =>
    entries.flatMap((entry) =>
      entry.examples
        .filter((example) => example.aspirational !== true)
        .map((example) => [
          `${stem}\0${entry.name}\0${example.id}`,
          { id: `${entry.name}/${example.id}`, expected: example.expected as MathJSON },
        ]),
    ),
  ),
);
interface DigestRow extends OtherRow {
  readonly id: string;
  readonly expected: MathJSON;
}
const rowsBySystem = new Map<string, DigestRow[]>();
for (const { stem } of entryFiles) {
  const sidecar = sidecars.get(stem) as Sidecar;
  for (const [head, byKey] of Object.entries(sidecar.examples)) {
    for (const [key, bySystem] of Object.entries(byKey)) {
      const example = exampleAt.get(`${stem}\0${head}\0${key}`);
      if (example === undefined) continue;
      for (const [system, row] of Object.entries(bySystem)) {
        const rows = rowsBySystem.get(system) ?? [];
        rows.push({ ...row, ...example });
        rowsBySystem.set(system, rows);
      }
    }
  }
}
const scanned = SYSTEMS.map((spec) => spec.name).filter((name) => rowsBySystem.has(name));

const lines: string[] = [
  "# Oracle disagreements",
  "",
  "Generated by `vp node packages/reference/scripts/oracle-scan.ts` from the entry sidecars. Each",
  "row is an example where an external system returned something other than our pinned",
  "`expected`. A row is NOT a bug report — it is one of three things, and telling them apart is",
  "the review:",
  "",
  "- **a formatter bug** — we emitted the wrong source, so the system answered a different question",
  "- **a convention difference** — both are right under their own definitions (rounding mode,",
  "  branch cut, signed versus unsigned Stirling numbers of the first kind)",
  "- **our bug** — the interesting case, and the reason this exists",
  "",
  "Classifications live in each entry's `<stem>.oracle.json` sidecar, on the disagreeing row.",
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
      lines.push(
        `| \`${row.id}\` | ${row.kind ?? ""} | \`${trim(show(row.expected))}\` | \`${trim(row.output)}\` |`,
      );
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
writeFileSync(digestUrl, `${lines.join("\n")}\n`);
written.push(fileURLToPath(digestUrl));
execFileSync("pnpm", ["exec", "vp", "fmt", ...written], { stdio: "inherit" });

process.stderr.write(`\nmost-wanted mappings:\n`);
for (const [head, count] of queue.slice(0, 12)) {
  process.stderr.write(`  ${head} — blocks ${count}\n`);
}
