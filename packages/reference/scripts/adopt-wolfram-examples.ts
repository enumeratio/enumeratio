// Adopt farmed Wolfram examples (`farm-wolfram-data.ts`'s cache) into our heads' records:
// documentation inputs as examples, MathematicalFunctionData's particular values as examples
// with a `known` value. An input is adopted when all its names are ours (`adaptInput`), it
// mentions the head, and our engine evaluates it quickly to a real answer (`judge`); a
// particular value also has to agree with Wolfram's. Captions are ours to write: Wolfram's
// stay in the cache. New rows only -- an example already on the head is left as it is.
//
//   node packages/reference/scripts/adopt-wolfram-examples.ts             every mapped head
//   node packages/reference/scripts/adopt-wolfram-examples.ts Zeta Gamma  these heads
//   … --dry                                                                report, write nothing
//   … --exclude symbols/combinatorics                                      skip records under a path
//   … --exclude-domain "Combinatorial maps"                                skip a domain's heads
//   … --skip Gamma,Beta                                                    skip these heads
//
// Then the Wolfram scan over the adopted rows and `prune-wolfram-examples.ts` (its header has
// the commands): an adopted row stays only once Wolfram agrees with it.
//
// The report (`adopt-report.json`, in the cache) keeps what didn't make it: gaps (Wolfram's
// documentation shows something ours doesn't do), suspects (a NaN, a float from exact input,
// a canonical form that hangs) and disagreements with a particular value -- the last two are
// likely bugs of ours.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { bySection, dedupeId, type ReferenceExample } from "@enumeratio/entry";
import { writeHead } from "@enumeratio/entry/node";
import { runCases } from "@enumeratio/evaluation/src/node";
import type { FunctionRecord, LanguageRecord } from "@enumeratio/oracle/src";
import { HEADS } from "@enumeratio/wolfram/src";
import { toInputForm } from "../../formats/src/inputform.ts";
import { DEFAULT_TOLERANCE, disagreement } from "../src/known.ts";
import { loadReferenceData, PACKAGES } from "../src/node.ts";
import { baseId } from "./example-id.ts";
import { ADOPTED, cachedRecords, readCached, readDeclined, WOLFRAM_CACHE } from "./wolfram-cache.ts";
import { adaptInput, assignedNames, judge, mentions, SECTION } from "./wolfram-examples.ts";

const { values, positionals } = parseArgs({
  options: {
    dry: { type: "boolean", default: false },
    exclude: { type: "string", multiple: true, default: [] },
    "exclude-domain": { type: "string", multiple: true, default: [] },
    skip: { type: "string", default: "" },
    "max-docs": { type: "string", default: "10" },
    "max-identities": { type: "string", default: "6" },
  },
  allowPositionals: true,
});
const MAX_DOCS = Number(values["max-docs"]);
const MAX_IDENTITIES = Number(values["max-identities"]);
// An adopted example is re-run by every standard test run: a quick one only.
const TIME_MS = 2_000;
const MEMORY_BYTES = 512 * 1024 * 1024;
// A long answer is a table, not an example.
const MAX_VALUE_CHARS = 1_500;
// Candidates tried per head and kind, before the cap keeps the ones that work.
const OVERSAMPLE = 3;

// Statistics and domains run under their own engines (see tests/entries.test.ts), as do the
// heads that read the carriers' tables.
const OWN_ENGINE = new Set(["statistics", "domains"]);
const ON_CARRIERS = new Set(["CombinatorialStat", "CombinatorialMap"]);

// InputForm for a short expression; a long one stays MathJSON, since `toInputForm` doesn't
// return on some kilobyte-sized answers (a Fibonacci `FunctionExpand`).
const SHOWN_CHARS = 300;
const show = (expr: unknown): string => {
  const json = JSON.stringify(expr);
  if (json.length > SHOWN_CHARS) return json;
  try {
    return toInputForm(expr as never);
  } catch {
    return json;
  }
};

const run = (inputs: readonly unknown[]) =>
  runCases(
    inputs.map((input, i) => ({ id: String(i), input })),
    {
      setup: new URL("./adopt-setup.ts", import.meta.url).href,
      timeMs: TIME_MS,
      memoryBytes: MEMORY_BYTES,
      materialize: true,
      concurrency: 4,
    },
  );

/** Each expression as our engine writes it, unevaluated (`5/4`, not Wolfram's `5 * 4^-1`), or
 * why it can't be: a type error (`Arccos(+oo)`: +oo isn't complex), or a hang. */
async function canonicalForms(exprs: readonly unknown[]): Promise<({ expr: unknown } | { why: string })[]> {
  const results = await run(exprs.map((e) => ["CanonicalForm", e]));
  return results.map((r) => {
    if (r.outcome !== "Evaluated")
      return { why: r.outcome === "Aborted" ? "canonical form hangs" : "canonical form throws" };
    const value = r.value as unknown[];
    if (Array.isArray(value) && value[0] === "Hold") return { expr: value[1] };
    const code = Array.isArray(value) && Array.isArray(value[1]) ? String(value[1][1]).replace(/'/g, "") : "error";
    return { why: `canonical form: ${code}` };
  });
}

interface HeadReport {
  adopted: string[];
  rejected: Record<string, number>;
  gaps: string[];
  suspects: { expr: string; ours: string; why: string }[];
  disagreements: { expr: string; ours: string; known: string; source: string }[];
}

interface Candidate {
  readonly head: string;
  readonly expr: unknown;
  readonly category: string;
  readonly known?: unknown;
  readonly source?: string;
}

const { heads } = loadReferenceData(PACKAGES);
const record = new Map<string, (typeof heads)[number]>();
// A head with any record under an excluded path is skipped whole, not written to another copy.
const excluded = new Set(
  heads
    .filter(
      (h) =>
        values.exclude.some((path) => h.dir.includes(`/${path}`)) ||
        values["exclude-domain"].includes(h.entry.domain) ||
        values.skip.split(",").includes(h.head),
    )
    .map((h) => h.head),
);
for (const h of heads)
  if (!OWN_ENGINE.has(h.package) && !ON_CARRIERS.has(h.head) && !excluded.has(h.head) && !record.has(h.head))
    record.set(h.head, h);
const wanted = (positionals.length > 0 ? positionals : Object.keys(HEADS)).filter(
  (h) => record.has(h) && HEADS[h] !== undefined,
);
const functions = cachedRecords<FunctionRecord>("function");

const report: Record<string, HeadReport> = {};
const reject = (r: HeadReport, reason: string): void => {
  r.rejected[reason] = (r.rejected[reason] ?? 0) + 1;
};

// Adapt: Wolfram's inputs as MathJSON, for the heads they mention.
const raw: Candidate[] = [];
for (const head of wanted) {
  const wolfram = HEADS[head]!;
  const r: HeadReport = (report[head] = { adopted: [], rejected: {}, gaps: [], suspects: [], disagreements: [] });
  const docs: Candidate[] = [];
  for (const [section, groups] of Object.entries(readCached<LanguageRecord>("language", wolfram)?.sections ?? {})) {
    const category = SECTION[section];
    if (category == null) continue;
    const assigned = new Set<string>();
    for (const input of groups.flatMap((g) => g.inputs)) {
      const adapted = adaptInput(input);
      const earlier = [...assigned];
      for (const name of assignedNames(input)) assigned.add(name);
      if (adapted.ok && earlier.some((name) => mentions(adapted.expr, name))) reject(r, "uses an earlier definition");
      else if (!adapted.ok) reject(r, adapted.reason);
      else if (!mentions(adapted.expr, head)) reject(r, "off head");
      else docs.push({ head, expr: adapted.expr, category });
    }
  }
  const identities: Candidate[] = [];
  for (const fn of functions.filter((f) => f.name.split(":")[0] === wolfram)) {
    for (const { lhs, rhs } of fn.particularValues) {
      const [expr, known] = [adaptInput(lhs), adaptInput(rhs)];
      if (!expr.ok) reject(r, `identity ${expr.reason}`);
      else if (!known.ok) reject(r, `identity value ${known.reason}`);
      else if (!mentions(expr.expr, head)) reject(r, "off head");
      else
        identities.push({
          head,
          expr: expr.expr,
          known: known.expr,
          source: `Wolfram MathematicalFunctionData, ${fn.name}`,
          category: "Properties",
        });
    }
  }
  raw.push(...docs.slice(0, MAX_DOCS * OVERSAMPLE), ...identities.slice(0, MAX_IDENTITIES * OVERSAMPLE));
}

// Write each in our form -- the existing examples too, to compare against -- and drop repeats.
const existing = wanted.flatMap((head) => record.get(head)!.entry.examples.map((e) => ({ head, expr: e.expr })));
const forms = await canonicalForms([...existing.map((e) => e.expr), ...raw.map((c) => c.expr)]);
const knownForms = await canonicalForms(raw.map((c) => c.known ?? 0));
const formOf = (form: { expr: unknown } | { why: string } | undefined): unknown =>
  form !== undefined && "expr" in form ? form.expr : undefined;
// Already on the head (a triage row included) or dropped by hand: not written again.
const seen = new Set([
  ...existing.map((e, i) => `${e.head} ${JSON.stringify(formOf(forms[i]) ?? e.expr)}`),
  ...Object.entries(readDeclined()).flatMap(([head, exprs]) => exprs.map((e) => `${head} ${e}`)),
]);
const candidates: Candidate[] = [];
for (const [i, c] of raw.entries()) {
  const [form, knownForm] = [forms[existing.length + i]!, knownForms[i]!];
  const failed = "why" in form ? form : c.known !== undefined && "why" in knownForm ? knownForm : undefined;
  if (failed !== undefined) {
    report[c.head]!.suspects.push({ expr: show(c.expr), ours: "", why: failed.why });
    continue;
  }
  const [expr, known] = [formOf(form), formOf(knownForm)];
  const key = `${c.head} ${JSON.stringify(expr)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  candidates.push({ ...c, expr, ...(c.known !== undefined ? { known } : {}) });
}
process.stderr.write(`${candidates.length} candidates over ${wanted.length} heads\n`);

// Evaluate, and keep what's a real answer.
const results = await run(candidates.map((c) => c.expr));
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const adopted = new Map<string, ReferenceExample[]>();
const taken = new Map<string, number>();
for (const [i, c] of candidates.entries()) {
  const r = report[c.head]!;
  const result = results[i]!;
  if (result.outcome !== "Evaluated") {
    reject(r, result.outcome === "Aborted" ? "slow" : "error");
    continue;
  }
  const value = result.value;
  if (JSON.stringify(value).length > MAX_VALUE_CHARS) {
    reject(r, "long value");
    continue;
  }
  if (mentions(value, "Error") || mentions(value, "Aborted")) {
    reject(r, "error");
    continue;
  }
  const verdict = judge(c.expr, value, same);
  if (verdict !== "keep") {
    if ("gap" in verdict) r.gaps.push(`${show(c.expr)} (${verdict.gap})`);
    else r.suspects.push({ expr: show(c.expr), ours: show(value), why: verdict.suspect });
    continue;
  }
  if (c.known !== undefined && disagreement(value, c.known, DEFAULT_TOLERANCE) !== undefined) {
    r.disagreements.push({ expr: show(c.expr), ours: show(value), known: show(c.known), source: c.source! });
    continue;
  }
  const kind = c.known === undefined ? "docs" : "identity";
  const count = taken.get(`${c.head} ${kind}`) ?? 0;
  if (count >= (kind === "docs" ? MAX_DOCS : MAX_IDENTITIES)) continue;
  taken.set(`${c.head} ${kind}`, count + 1);
  const example = {
    expr: c.expr,
    expected: value,
    ...(c.known !== undefined ? { known: c.known, source: c.source } : {}),
    ...(c.category !== "Basic" ? { category: c.category } : {}),
  } as ReferenceExample;
  (adopted.get(c.head) ?? adopted.set(c.head, []).get(c.head)!).push(example);
  r.adopted.push(`${show(c.expr)} = ${show(value)}`);
}

if (!values.dry) {
  // Every row written is remembered, so the prune step can take back what Wolfram disagrees with.
  const written: Record<string, string[]> = existsSync(ADOPTED) ? JSON.parse(readFileSync(ADOPTED, "utf8")) : {};
  for (const [head, rows] of adopted) {
    const { dir, entry, body, implementations } = record.get(head)!;
    const ids = new Set(entry.examples.map((e) => e.id));
    const examples = rows.map((row) => {
      const id = dedupeId(baseId(row), ids);
      ids.add(id);
      return { ...row, id };
    });
    await writeHead(dir, head, {
      entry: { ...entry, examples: bySection([...entry.examples, ...examples]) },
      implementations,
      body,
    });
    written[head] = [...(written[head] ?? []), ...examples.map((e) => e.id)];
  }
  writeFileSync(ADOPTED, `${JSON.stringify(written, null, 1)}\n`);
}
// A run over some heads replaces only theirs in the report.
const REPORT = `${WOLFRAM_CACHE}/adopt-report.json`;
const previous: Record<string, HeadReport> = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, "utf8")) : {};
writeFileSync(REPORT, `${JSON.stringify({ ...previous, ...report }, null, 1)}\n`);

const sum = (f: (r: HeadReport) => number): number => Object.values(report).reduce((n, r) => n + f(r), 0);
process.stderr.write(
  `${values.dry ? "would adopt" : "adopted"} ${sum((r) => r.adopted.length)} examples on ${adopted.size} heads; ` +
    `${sum((r) => r.gaps.length)} gaps, ${sum((r) => r.suspects.length)} suspects, ` +
    `${sum((r) => r.disagreements.length)} disagreements (${WOLFRAM_CACHE}/adopt-report.json)\n`,
);
