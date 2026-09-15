// Run every documented example through every wired system, and write the report.
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
// (structural.ts); the Python-family systems are compared as text (compare.ts).
//
// Nothing here is a gate: it needs four external kernels. Run it, read it, classify the
// new rows in golden/divergences.json, commit the goldens.
//
//   vp node packages/reference/scripts/oracle-scan.ts            # everything wired
//   vp node packages/reference/scripts/oracle-scan.ts wolfram    # one system

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ComputeEngine } from "@cortex-js/compute-engine";
import {
  compare,
  compareTrees,
  type Divergence,
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
import { entries } from "../src/index.ts";

interface Case {
  readonly id: string;
  readonly head: string;
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

const cases: Case[] = entries.flatMap((entry) =>
  entry.examples
    .filter((example) => example.aspirational !== true)
    .map((example, index) => ({
      id: `${entry.name}#${index + 1}`,
      head: entry.name,
      expr: example.expr as MathJSON,
      expected: example.expected as MathJSON,
    })),
);
const caseById = new Map(cases.map((item) => [item.id, item]));

type Outcome = {
  readonly id: string;
  readonly source: string;
  readonly verdict: Verdict | "unmapped" | "error";
  readonly theirs: string;
};

const requested = process.argv.slice(2).filter((argument) => !argument.startsWith("-"));
const systems = (requested.length > 0 ? requested : wiredSystems()) as System[];

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
      outcomes.push({ id: row.item.id, source: "", verdict: "unmapped", theirs: "" });
    }
  }
  runnable.forEach((row, index) => {
    const source = sources[index] as string;
    const result = results[index] as { value?: string; error?: string };
    if (result.error !== undefined) {
      outcomes.push({ id: row.item.id, source, verdict: "error", theirs: result.error });
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
    }
    outcomes.push({ id: row.item.id, source, verdict, theirs });
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

// ── the Wolfram goldens ───────────────────────────────────────────────────────
//
// Two committed files. The sweep is every (example, verdict, answer) — regenerated
// wholesale, diffed to see what moved. The divergence catalogue is the disagreements WITH
// a classification, which a person supplies: the scan carries existing classifications
// forward by example id, adds new rows as `unclassified`, and drops rows that no longer
// disagree. The test refuses an unclassified row, so a scan that finds something new
// cannot be committed without someone saying what it is.

const wolfram = report["wolfram"];
if (wolfram !== undefined) {
  const summary: Record<string, number> = {};
  for (const outcome of wolfram) summary[outcome.verdict] = (summary[outcome.verdict] ?? 0) + 1;
  const kernel = execFileSync("wolframscript", ["-code", "$Version"], { encoding: "utf8" }).trim();
  const sweep = {
    kernel,
    summary,
    cases: [...wolfram].sort((a, b) => a.id.localeCompare(b.id)),
  };
  writeFileSync(
    new URL("../golden/oracle/wolfram-sweep.json", import.meta.url),
    `${JSON.stringify(sweep, null, 2)}\n`,
  );

  const catalogueUrl = new URL("../golden/oracle/divergences.json", import.meta.url);
  const existing: Divergence[] = existsSync(catalogueUrl)
    ? (JSON.parse(readFileSync(catalogueUrl, "utf8")) as Divergence[])
    : [];
  const known = new Map(existing.map((row) => [row.id, row]));
  const catalogue: Divergence[] = wolfram
    .filter((outcome) => outcome.verdict === "disagree")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((outcome) => {
      const item = caseById.get(outcome.id) as Case;
      const prior = known.get(outcome.id);
      return {
        id: outcome.id,
        kind: prior?.kind ?? "unclassified",
        note: prior?.note ?? "",
        expr: item.expr,
        source: outcome.source,
        ours: reduce(item.expected, leaf),
        theirs: theirTree(outcome.theirs) ?? outcome.theirs,
      };
    });
  writeFileSync(catalogueUrl, `${JSON.stringify(catalogue, null, 2)}\n`);

  const fresh = catalogue.filter((row) => row.kind === "unclassified").map((row) => row.id);
  const resolved = existing.filter((row) => !catalogue.some((c) => c.id === row.id));
  if (fresh.length > 0) process.stderr.write(`\nunclassified divergences: ${fresh.join(", ")}\n`);
  if (resolved.length > 0) {
    process.stderr.write(`resolved (dropped): ${resolved.map((row) => row.id).join(", ")}\n`);
  }
}

// A readable digest of the disagreements, COMMITTED — the full JSON is regenerated per
// kernel version and is not worth diffing, but the disagreements are exactly the thing to
// review and to watch move over time.
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
  "The Wolfram rows are classified in `golden/divergences.json`.",
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
