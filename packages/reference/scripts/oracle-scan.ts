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
//   vp node packages/reference/scripts/oracle-scan.ts --head Foo,Bar,Baz     # several heads, one kernel process
//   vp node packages/reference/scripts/oracle-scan.ts --ids Foo/a,Bar/b     # only these example ids
//   vp node packages/reference/scripts/oracle-scan.ts --new-only            # skip rows already answered per system
//   vp node packages/reference/scripts/oracle-scan.ts --digest            # rebuild the digest only

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import {
  emit,
  interpretSymbolicAgreement,
  isSymbolicSystem,
  type MathJSON,
  runIn,
  runKernel,
  symbolicAgreementSource,
  SYSTEMS,
  type System,
  type Verdict,
  wiredSystems,
} from "@enumeratio/oracle";
import { isSettled, orderImplementations, type SystemImplementation } from "@enumeratio/entry";
import { updateHead } from "@enumeratio/entry/node";
import { referenceData, referenceEntries } from "../src/node.ts";
import { asksForDigits, show } from "./oracle-verdict.ts";
import { cappedVerdicts } from "./oracle-verdict-capped.ts";

const data = referenceData();
// The comparison numerically evaluates our value in-process, which CE can fail to return from.
const verdicts = cappedVerdicts();

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
// Comma-separated: `--head Foo,Bar` scans several heads in one kernel process, cheaper than
// one invocation per head when a fix (or this free-symbol pass) touches many heads at once.
const headFilter = headIndex >= 0 ? new Set((args[headIndex + 1] ?? "").split(",")) : undefined;
const idsIndex = args.indexOf("--ids");
// Comma-separated full example ids (`Head/key`), for a run that only touches SOME examples of
// a head — the free-symbol pass is the reason this exists: touching every mapped head's
// examples would drag in disagreements this lane has nothing to do with.
const idFilter = idsIndex >= 0 ? new Set((args[idsIndex + 1] ?? "").split(",")) : undefined;
const requested = args.filter(
  (argument, index) => !argument.startsWith("-") && args[index - 1] !== "--head" && args[index - 1] !== "--ids",
);
// `--digest` scans nothing: it rebuilds `disagreements.md` from the records (`build` runs it).
const digestOnly = args.includes("--digest");
// `--new-only` skips a case (per system) that already has a committed answer for it — a fast
// pass over the gaps a `--head`/`--ids` run just widened, without re-asking a kernel about
// rows it's already answered.
const newOnly = args.includes("--new-only");
// Without `--accept` a scan only reports (report.json, stderr); with it, what the kernels said
// goes into the records, and the digest follows. The explicit write is what a fixup PR carries.
const accept = args.includes("--accept");
const systems = (digestOnly ? [] : requested.length > 0 ? requested : wiredSystems()) as System[];

// Every settled example (not aspirational, not in triage), UNFILTERED — the authority for "does
// this example still exist" (the write-out loop's deletion guard, below), so a partial
// `--head`/`--ids` run can't be misread as "every other example of this head is gone."
const inTriage = new Map(
  referenceEntries(data).map((entry) => [
    entry.name,
    new Set(entry.examples.filter((example) => example.role === "triage").map((example) => example.id)),
  ]),
);
const allCases: Case[] = referenceEntries(data).flatMap((entry) =>
  entry.examples
    .filter((example) => isSettled(example))
    .map((example) => ({
      id: `${entry.name}/${example.id}`,
      head: entry.name,
      key: example.id,
      expr: example.expr as MathJSON,
      expected: example.expected as MathJSON,
    })),
);
const cases: Case[] = allCases.filter(
  (item) =>
    (headFilter === undefined || headFilter.has(item.head)) && (idFilter === undefined || idFilter.has(item.id)),
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
// One `<Head>/examples.values.*.tsv` beside each `<Head>/index.md`, keyed by example id then
// system. A scan of a system rewrites only that system's rows (`in`, `out`, `tex`, `shown`,
// `verdict`) for the heads touched this run, keeps every other system's, and drops rows for
// examples that no longer exist. A row with only a note (prose about a system the scan can't
// reach) stays until someone removes it.
//
// The hand columns (`kind`, `note`, `issue`, `tolerance`) are NEVER cleared by a scan — they
// are a person's classification, and a rescan is not a review. When a row's verdict and input
// are unchanged, they carry forward untouched. When the verdict moves, the OLD note and kind
// still carry forward (a scan doesn't get to invalidate someone's classification), and the
// only thing that changes is: a row with no prior classification gets `kind: "unclassified"`
// so it surfaces, and the move is reported on stderr for a person to re-review.

type Record_ = Record<string, Record<string, SystemImplementation>>;
const dirOf = new Map<string, string>();
const records = new Map<string, Record_>();
const exampleIdsOf = new Map<string, string[]>();
for (const h of data.heads) {
  if (data.packageOf.get(h.head) !== h.package) continue;
  exampleIdsOf.set(
    h.head,
    h.entry.examples.map((e) => e.id),
  );
  dirOf.set(h.head, h.dir);
  records.set(h.head, structuredClone((h.implementations ?? {}) as Record_));
}
const loaded = new Map([...records].map(([head, record]) => [head, structuredClone(record)]));

// Which cases were actually asked of each system this run — every one, unless `--new-only`
// narrows it to cases with no committed answer for that system yet. The write-out loop below
// needs this to leave an unscanned row alone rather than reading its absence from `report` as
// "gone".
const scannedIdsBySystem = new Map<System, Set<string>>();

for (const system of systems) {
  const casesForSystem = newOnly
    ? cases.filter((item) => records.get(item.head)?.[item.key]?.[system] === undefined)
    : cases;
  scannedIdsBySystem.set(system, new Set(casesForSystem.map((item) => item.id)));
  const emitted = casesForSystem.map((item) => ({ item, out: emit(item.expr, system) }));
  const runnable = emitted.filter((row) => row.out.ok);
  // A free symbol on a symbolic system (wolfram, sympy, sage) is checked as an identity —
  // does the difference vanish? — rather than compared value-for-value, since two closed
  // forms that are equal can still be spelled differently (design/free-symbol-oracle
  // question below). `symbolicAgreementSource` returns undefined when `expected` itself
  // doesn't emit for `system`, and the case falls back to the ordinary verdict.
  // `plainSources` is what forms.ts (collect-forms.ts) also emits and pins as `in:` — the
  // record has to keep showing that, currency-tested by forms.test.ts, regardless of what a
  // free-symbol case actually asks the kernel. `sources` is what's actually run: the plain
  // source, unless it carries a free symbol on a symbolic system, in which case it's the
  // agreement check (symbolic-mode) — `undefined` back means `expected` itself doesn't emit
  // for `system`, so this case just falls back to the ordinary evaluate-and-compare verdict.
  const plainSources = runnable.map((row) => (row.out as { source: string }).source);
  const sources = runnable.map((row, index) => {
    const freeSymbols = row.out.ok ? row.out.freeSymbols : undefined;
    if (freeSymbols !== undefined && freeSymbols.length > 0 && isSymbolicSystem(system)) {
      const agreement = symbolicAgreementSource(system, row.item.expr, row.item.expected, freeSymbols);
      if (agreement !== undefined) return agreement;
    }
    return plainSources[index] as string;
  });
  const symbolicMode = runnable.map((_row, index) => sources[index] !== plainSources[index]);
  process.stderr.write(`${system}: ${runnable.length}/${casesForSystem.length} emit — running…\n`);
  const results = await runIn(system, sources);

  const outcomes: Outcome[] = [];
  const missing: Record<string, number> = {};
  for (const row of emitted) {
    if (!row.out.ok) {
      for (const head of row.out.missing) missing[head] = (missing[head] ?? 0) + 1;
      outcomes.push({ id: row.item.id, source: "", verdict: "unmapped", theirs: "", display: "" });
    }
  }
  for (const [index, row] of runnable.entries()) {
    const source = plainSources[index] as string;
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
      continue;
    }
    const theirs = result.value ?? "";
    let verdict: Verdict;
    if (symbolicMode[index]) {
      verdict = interpretSymbolicAgreement(theirs);
    } else {
      const tolerance = records.get(row.item.head)?.[row.item.key]?.[system]?.tolerance;
      const judged = await verdicts.verdict(
        system,
        row.item.expected,
        result,
        tolerance,
        asksForDigits(row.item.expr),
        row.item.expr,
      );
      if (judged === "timeout") {
        const reason = "TimeoutError: comparison exceeded its cap";
        outcomes.push({ id: row.item.id, source, verdict: "error", theirs: reason, display: reason });
        continue;
      }
      verdict = judged;
    }
    outcomes.push({
      id: row.item.id,
      source,
      verdict,
      theirs,
      display: result.display ?? theirs,
      ...(result.shown === undefined ? {} : { shown: result.shown }),
      ...(result.tex === undefined ? {} : { tex: result.tex }),
    });
  }
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
const queue = [...cost].toSorted((a, b) => b[1] - a[1]).slice(0, 30);

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
// `id (system): from -> to`, one per row whose verdict moved from its committed value — the
// row keeps its old classification (never cleared), but a moved verdict needs a person's eyes.
const changedVerdicts: string[] = [];
for (const system of systems) {
  const outcomeByCaseId = new Map((report[system] ?? []).map((o) => [o.id, o]));
  for (const head of headsThisRun) {
    const record = records.get(head) ?? {};
    const ofHead = cases.filter((c) => c.head === head);
    // From `allCases`, not `ofHead`: a `--head`/`--ids`-scoped run still has to see every
    // OTHER example of this head as present, or it would delete their rows as "gone".
    // A row in triage isn't scanned but keeps the run it was triaged on.
    const current = new Set([
      ...allCases.filter((c) => c.head === head).map((c) => c.key),
      ...(inTriage.get(head) ?? []),
    ]);
    const put = (id: string, row: SystemImplementation | undefined): void => {
      const { [system]: _old, ...rest } = record[id] ?? {};
      const next = row === undefined ? rest : { ...rest, [system]: row };
      if (Object.keys(next).length === 0) delete record[id];
      else record[id] = next;
    };
    // A row for an example that's gone, or aspirational now, goes.
    for (const id of Object.keys(record)) if (!current.has(id) && record[id]?.[system]) put(id, undefined);
    const scanned = scannedIdsBySystem.get(system);
    for (const item of ofHead) {
      // `--new-only` didn't ask this system about this case — its absence from `report` means
      // "not scanned", not "unmapped", so leave whatever row is already there untouched.
      if (newOnly && !scanned?.has(item.id)) continue;
      const outcome = outcomeByCaseId.get(item.id);
      const prior = record[item.key]?.[system];
      if (outcome === undefined || outcome.verdict === "unmapped") {
        // Unmapped this run: the scanned part goes; a hand note stays.
        put(item.key, prior?.note ? { in: prior.in, note: prior.note } : undefined);
        continue;
      }
      const verdict = outcome.verdict;
      const priorVerdict = prior?.verdict ?? "agree";
      const verdictMoved = prior?.out !== undefined && priorVerdict !== verdict;
      if (verdictMoved) changedVerdicts.push(`${item.id} (${system}): ${priorVerdict} -> ${verdict}`);
      put(item.key, {
        in: outcome.source,
        out: outcome.display,
        ...(outcome.shown === undefined ? {} : { shown: outcome.shown }),
        ...(outcome.tex === undefined ? {} : { tex: { in: outcome.tex.input, out: outcome.tex.output } }),
        ...(verdict === "agree" ? {} : { verdict }),
        // A hand classification is never cleared by a rescan. Unchanged verdict or not, the
        // old note (and issue) carry forward as-is; a verdict that moved just gets reported
        // (changedVerdicts, below) for a person to re-review. Only a row with no prior
        // classification at all picks up "unclassified".
        ...(verdict === "agree"
          ? prior?.note
            ? { note: prior.note }
            : {}
          : {
              kind: prior?.kind ?? "unclassified",
              note: prior?.note ?? "",
              ...(prior?.issue !== undefined ? { issue: prior.issue } : {}),
            }),
        // A tolerance is a property of the example, so it carries forward regardless.
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
    await updateHead(dirOf.get(head)!, head, {
      implementations:
        Object.keys(record).length === 0
          ? undefined
          : orderImplementations(
              record,
              exampleIdsOf.get(head) ?? [],
              SYSTEMS.map((s) => s.name),
            ),
    });
  }
if (accept && !isDeepStrictEqual(kernels, data.kernels))
  writeFileSync(
    KERNELS,
    `${JSON.stringify(
      Object.fromEntries(Object.entries(kernels).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
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
if (changedVerdicts.length > 0) {
  process.stderr.write(`\nverdict changed (classification kept, please re-review):\n`);
  for (const line of changedVerdicts) process.stderr.write(`  ${line}\n`);
}

// A readable digest of the disagreements, uncommitted (`build` writes it) — the records are regenerated per
// kernel version and are not worth diffing wholesale, but the disagreements are exactly the
// thing to review and to watch move over time. Built from every record rather than this
// run, so it covers every system scanned so far.
const exampleAt = new Map(
  referenceEntries(data).flatMap((entry) =>
    entry.examples
      .filter((example) => isSettled(example))
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
  "Classifications live in each head's `<Head>/examples.values.*.tsv`, on the disagreeing row.",
  "Counts cover mapped examples only; unmapped ones have no row.",
  "",
];
for (const system of scanned) {
  const rows = (rowsBySystem.get(system) ?? []).toSorted((a, b) => a.id.localeCompare(b.id));
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

verdicts.close();
