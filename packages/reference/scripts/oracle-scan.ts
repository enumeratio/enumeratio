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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ComputeEngine } from "@cortex-js/compute-engine";
import {
  compare,
  comparePythonStructured,
  compareTrees,
  emit,
  type Leaf,
  type MathJSON,
  reduce,
  runIn,
  symbolic,
  type System,
  type Tree,
  type Verdict,
  wiredSystems,
} from "@enumeratio/oracle/src";
import { fromWolfram } from "@enumeratio/wolfram/src";
import { entryFiles } from "../src/entries.ts";

interface Case {
  readonly id: string;
  readonly stem: string;
  readonly head: string;
  readonly key: string;
  readonly expr: MathJSON;
  readonly expected: MathJSON;
}

const ce = new ComputeEngine();

/**
 * A leaf of the comparison: the number an expression has, else its symbolic text.
 *
 * The pinned `expected` is MathJSON, and the first version of this compared it as raw text
 * against a system's printed output — so `["Rational",-1,2]` "disagreed" with `-1/2`, and
 * `["Multiply",["Rational",1,6],["Power","Pi",2]]` with `Pi^2/6`. Those inflated the count
 * with pure notation and buried the real divergences.
 */
const leaf = (expr: MathJSON): Leaf => {
  try {
    const boxed = ce.box(expr as Parameters<ComputeEngine["box"]>[0]).N();
    // `.symbol` lives on the narrowed SymbolInterface, with no typed route from the union.
    const name = (boxed as { symbol?: unknown }).symbol;
    if (name === "True") return true;
    if (name === "False") return false;
    const { re, im } = boxed;
    if (typeof re === "number" && Number.isFinite(re)) {
      return typeof im === "number" && im !== 0 && Number.isFinite(im) ? { re, im } : re;
    }
  } catch {
    // fall through to the textual form
  }
  return symbolic(expr);
};

/** Our side of a TEXT comparison (the Python-family systems): the number, else the JSON. */
const show = (expr: MathJSON): string => {
  const value = leaf(expr);
  return typeof value === "number"
    ? String(value)
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
};

/** Keep a table cell readable, and never let a backtick break the markdown. */
const trim = (text: string): string => text.replace(/`/g, "'").replace(/\|/g, "/").slice(0, 90);

const args = process.argv.slice(2);
const headIndex = args.indexOf("--head");
const headFilter = headIndex >= 0 ? args[headIndex + 1] : undefined;
const requested = args.filter(
  (argument, index) => !argument.startsWith("-") && args[index - 1] !== "--head",
);
const systems = (requested.length > 0 ? requested : wiredSystems()) as System[];

const cases: Case[] = entryFiles.flatMap(({ stem, entries }) =>
  entries.flatMap((entry) =>
    entry.examples
      .filter((example) => example.aspirational !== true)
      .map((example, index) => ({
        id: `${stem}/${entry.name}#${index + 1}`,
        stem,
        head: entry.name,
        key: JSON.stringify(example.expr),
        expr: example.expr as MathJSON,
        expected: example.expected as MathJSON,
      }))
      .filter((item) => headFilter === undefined || item.head === headFilter),
  ),
);
const caseById = new Map(cases.map((item) => [item.id, item]));

type Outcome = {
  readonly id: string;
  readonly source: string;
  readonly verdict: Verdict | "unmapped" | "error";
  readonly theirs: string;
  /** A reader-facing form of `theirs` — Wolfram's InputForm, or the Python `str(...)`. */
  readonly display: string;
};

const report: Record<string, Outcome[]> = {};
const missingBySystem: Record<string, Record<string, number>> = {};

/** Wolfram's answer, parsed and reduced; `undefined` when it cannot be read. */
const theirTree = (fullForm: string): Tree | undefined => {
  try {
    return reduce(fromWolfram(fullForm) as MathJSON, leaf);
  } catch {
    return undefined;
  }
};

for (const system of systems) {
  const emitted = cases.map((item) => ({ item, out: emit(item.expr, system) }));
  const runnable = emitted.filter((row) => row.out.ok);
  const sources = runnable.map((row) => (row.out as { source: string }).source);
  process.stderr.write(`${system}: ${runnable.length}/${cases.length} emit — running…\n`);
  const results = runIn(system, sources);

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
    const result = results[index] as { value?: string; display?: string; error?: string };
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
    let verdict: Verdict;
    if (system === "wolfram") {
      const tree = theirTree(theirs);
      verdict =
        tree === undefined ? "inconclusive" : compareTrees(reduce(row.item.expected, leaf), tree);
    } else {
      verdict = compare(show(row.item.expected), theirs);
      if (verdict === "disagree") {
        const structured = comparePythonStructured(reduce(row.item.expected, leaf), theirs);
        if (structured === "agree") verdict = structured;
      }
    }
    outcomes.push({ id: row.item.id, source, verdict, theirs, display: result.display ?? theirs });
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

writeFileSync(
  new URL("../golden/oracle/report.json", import.meta.url),
  `${JSON.stringify({ generated: new Date().toISOString(), systems, report, queue }, null, 2)}\n`,
);

// ── the per-entry-file sidecars ──────────────────────────────────────────────────
//
// One `<stem>.oracle.json` beside each entries/<stem>.ts, keyed by head then by the
// example's `JSON.stringify(expr)` — the shape `entries.ts` reads back and the page looks
// examples up by. Scanning a system replaces only that system's rows for the heads touched
// this run (every head, unless `--head` narrowed it), keeping every other system's rows and
// dropping stale rows for examples that no longer exist.

interface OtherRow {
  readonly input: string;
  readonly output: string;
  readonly verdict: Verdict | "error";
  readonly kind?: string;
  readonly note?: string;
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
  kernelOf.wolfram = execFileSync("wolframscript", ["-code", "$Version"], {
    encoding: "utf8",
  }).trim();
}
if (systems.includes("sage")) {
  kernelOf.sage = execFileSync("sage", ["-c", "print(version())"], { encoding: "utf8" }).trim();
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
        const row: OtherRow =
          outcome.verdict === "disagree"
            ? {
                input: outcome.source,
                output: outcome.display,
                verdict: outcome.verdict,
                kind:
                  prior?.verdict === "disagree" ? (prior.kind ?? "unclassified") : "unclassified",
                note: prior?.verdict === "disagree" ? (prior.note ?? "") : "",
              }
            : { input: outcome.source, output: outcome.display, verdict: outcome.verdict };
        existingForHead[item.key] = { ...existingForHead[item.key], [system]: row };
      }
      sidecar.examples[head] = existingForHead;
    }
  }
}

for (const { stem } of entryFiles) {
  const sidecar = sidecars.get(stem) as Sidecar;
  writeFileSync(sidecarUrl(stem), `${JSON.stringify(sidecar, null, 2)}\n`);
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
// thing to review and to watch move over time.
const lines: string[] = [
  "# Oracle disagreements",
  "",
  "Generated by `vp node packages/reference/scripts/oracle-scan.ts`. Each row is an example where an",
  "external system returned something other than our pinned `expected`. A row is NOT a bug",
  "report — it is one of three things, and telling them apart is the review:",
  "",
  "- **a formatter bug** — we emitted the wrong source, so the system answered a different question",
  "- **a convention difference** — both are right under their own definitions (rounding mode,",
  "  branch cut, signed versus unsigned Stirling numbers of the first kind)",
  "- **our bug** — the interesting case, and the reason this exists",
  "",
  "Classifications live in each entry's `<stem>.oracle.json` sidecar, on the disagreeing row.",
  "",
  `Systems in this run: ${systems.join(", ")}.`,
  "",
];
for (const system of systems) {
  const outcomes = report[system] ?? [];
  const bad = outcomes.filter((outcome) => outcome.verdict === "disagree");
  const broken = outcomes.filter((outcome) => outcome.verdict === "error");
  const tally = (verdict: string) => outcomes.filter((o) => o.verdict === verdict).length;
  lines.push(
    `## ${system} — agree ${tally("agree")}, disagree ${bad.length}, inconclusive ${tally("inconclusive")}, unmapped ${tally("unmapped")}, error ${broken.length}`,
    "",
  );
  if (bad.length > 0) {
    lines.push("| example | ours | theirs |", "| --- | --- | --- |");
    for (const outcome of bad) {
      const ours = show(caseById.get(outcome.id)?.expected ?? "");
      lines.push(`| \`${outcome.id}\` | \`${trim(ours)}\` | \`${trim(outcome.theirs)}\` |`);
    }
    lines.push("");
  }
  if (broken.length > 0) {
    lines.push("<details><summary>errors — usually a mapping whose SHAPE is wrong</summary>", "");
    lines.push("| example | message |", "| --- | --- |");
    for (const outcome of broken) {
      lines.push(`| \`${outcome.id}\` | \`${trim(outcome.theirs)}\` |`);
    }
    lines.push("", "</details>", "");
  }
}
writeFileSync(
  new URL("../golden/oracle/disagreements.md", import.meta.url),
  `${lines.join("\n")}\n`,
);

process.stderr.write(`\nmost-wanted mappings:\n`);
for (const [head, count] of queue.slice(0, 12)) {
  process.stderr.write(`  ${head} — blocks ${count}\n`);
}
