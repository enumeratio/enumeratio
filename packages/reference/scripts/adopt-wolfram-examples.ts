// Adopt farmed Wolfram examples (`farm-wolfram-data.ts`'s cache) into our heads' records:
// documentation inputs as examples, MathematicalFunctionData's particular values and its
// identities' instances (the `relation` source) as examples with a `known` value. An input is
// adopted when all its names are ours (`adaptInput`), it mentions the head, and our engine
// evaluates it quickly to a real answer (`judge`); a particular value or an identity's instance
// also has to agree with Wolfram's. Captions are ours to write: Wolfram's stay in the cache.
// New rows only -- an example already on the head is left as it is.
//
//   node packages/reference/scripts/adopt-wolfram-examples.ts             every mapped head
//   node packages/reference/scripts/adopt-wolfram-examples.ts Zeta Gamma  these heads
//   … --dry                                                                report, write nothing
//   … --exclude symbols/combinatorics                                      skip records under a path
//   … --exclude-domain "Combinatorial maps"                                skip a domain's heads
//   … --skip Gamma,Beta                                                    skip these heads
//   … --kind relations                                                     only this kind (docs,
//                                                                          values, relations)
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
import type { FunctionRecord, LanguageRecord, RelationRecord } from "@enumeratio/oracle/src";
import { HEADS } from "@enumeratio/wolfram/src";
import { toInputForm } from "../../formats/src/inputform.ts";
import { comparable, DEFAULT_TOLERANCE, disagreement, measuredTolerance } from "../src/known.ts";
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
    "max-relations": { type: "string", default: "4" },
    kind: { type: "string", multiple: true, default: ["docs", "values", "relations"] },
  },
  allowPositionals: true,
});
type Kind = "docs" | "values" | "relations";
const CAP: Record<Kind, number> = {
  docs: Number(values["max-docs"]),
  values: Number(values["max-identities"]),
  relations: Number(values["max-relations"]),
};
const kinds = new Set(values.kind as Kind[]);
// An adopted example is re-run by every standard test run: a quick one only.
const TIME_MS = 2_000;
const MEMORY_BYTES = 512 * 1024 * 1024;
// A long answer is a table, not an example.
const MAX_VALUE_CHARS = 1_500;
// Candidates tried per head and kind, before the cap keeps the ones that work.
const OVERSAMPLE = 3;
const RELATION_RANK = ["NamedIdentities", "FunctionalEquations", "ReflectionSymmetries"];

// Statistics and domains run under their own engines (see tests/entries.test.ts), as do the
// heads that read the carriers' tables.
const OWN_ENGINE = new Set(["statistics", "domains"]);
const ON_CARRIERS = new Set(["CombinatorialStat", "CombinatorialMap"]);

/** Wolfram's printed real and imaginary parts (`3.14*^-25`) as a MathJSON number. */
const numeral = ([re, im]: readonly string[]): unknown => {
  const num = (s: string | undefined) =>
    s === undefined || !/^-?[\d.]+(\*\^-?\d+)?$/.test(s) ? undefined : { num: s.replace("*^", "e") };
  const [x, y] = [num(re), num(im)];
  if (x === undefined || y === undefined) return undefined;
  return im === "0" ? x : ["Complex", x, y];
};

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
  readonly kind: Kind;
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
const relations = cachedRecords<RelationRecord>("relation");

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
      else docs.push({ head, kind: "docs", expr: adapted.expr, category });
    }
  }
  // An instance's left side is the example and its right side, as Wolfram evaluates it, the
  // known value; Wolfram's digits for it where the right side is in heads compute-engine
  // alone can't evaluate (`dn(2, 1/2)/cn(2, 1/2)`), since `known.test.ts` never runs ours.
  const instance = (kind: Kind, lhs: string, rhs: string, source: string, value?: readonly string[]): Candidate[] => {
    const [expr, known] = [adaptInput(lhs), adaptInput(rhs)];
    if (!expr.ok) reject(r, `identity ${expr.reason}`);
    else if (!known.ok) reject(r, `identity value ${known.reason}`);
    else if (!mentions(expr.expr, head)) reject(r, "off head");
    else {
      const digits = comparable(known.expr) || value === undefined ? undefined : numeral(value);
      if (!comparable(known.expr) && digits === undefined) reject(r, "identity value not comparable");
      else return [{ head, kind, expr: expr.expr, known: digits ?? known.expr, source, category: "Properties" }];
    }
    return [];
  };
  const ofHead = <T extends { name: string }>(records: readonly T[]): T[] =>
    records.filter((f) => f.name.split(":")[0] === wolfram);
  const identities = ofHead(functions).flatMap((fn) =>
    fn.particularValues.flatMap(({ lhs, rhs }) =>
      instance("values", lhs, rhs, `Wolfram MathematicalFunctionData, ${fn.name}`),
    ),
  );
  // One instance of each relation before a second one, named identities first: the cap
  // keeps the most varied. The source names the identity an instance comes from.
  const related = ofHead(relations).flatMap((fn) => {
    const seen = new Map<string, number>();
    const nth = fn.relations.map(({ property, index }) => {
      const key = `${property} ${index}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      return seen.get(key)!;
    });
    return (
      fn.relations
        .map((relation, i) => ({ relation, rank: [nth[i]!, RELATION_RANK.indexOf(relation.property), i] }))
        .toSorted((a, b) => a.rank[0]! - b.rank[0]! || a.rank[1]! - b.rank[1]! || a.rank[2]! - b.rank[2]!)
        // A symmetry at a real point says nothing: `cot(conjugate(1/2))` is `cot(1/2)`.
        .filter(({ relation }) => relation.property !== "ReflectionSymmetries" || relation.lhs.includes("Complex["))
        .flatMap(({ relation: { lhs, rhs, property, label, value } }) =>
          instance("relations", lhs, rhs, `Wolfram MathematicalFunctionData, ${fn.name}, ${label ?? property}`, value),
        )
    );
  });
  for (const [kind, found] of [
    ["docs", docs],
    ["values", identities],
    ["relations", related],
  ] as const)
    if (kinds.has(kind)) raw.push(...found.slice(0, CAP[kind] * OVERSAMPLE));
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
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const adopted = new Map<string, ReferenceExample[]>();
const taken = new Map<string, number>();
// An identity's instance our engine leaves as it is (`4 arctan(1/5) - arctan(1/239)`) still
// holds numerically: it is tried again under `N`.
const numeric: Candidate[] = [];
function consider(c: Candidate, result: Awaited<ReturnType<typeof run>>[number]): void {
  const r = report[c.head]!;
  if (result.outcome !== "Evaluated") {
    reject(r, result.outcome === "Aborted" ? "slow" : "error");
    return;
  }
  const value = result.value;
  if (JSON.stringify(value).length > MAX_VALUE_CHARS) {
    reject(r, "long value");
    return;
  }
  if (mentions(value, "Error") || mentions(value, "Aborted")) {
    reject(r, "error");
    return;
  }
  const verdict = judge(c.expr, value, same);
  if (verdict !== "keep") {
    if ("gap" in verdict) r.gaps.push(`${show(c.expr)} (${verdict.gap})`);
    else r.suspects.push({ expr: show(c.expr), ours: show(value), why: verdict.suspect });
    if (c.kind === "relations" && "gap" in verdict && verdict.gap === "unevaluated")
      numeric.push({ ...c, expr: ["N", c.expr] });
    return;
  }
  // Rearranged but still in our heads (`2F(…) − F(…)/4`, a Gauss transformation's left side
  // with its power rewritten): nothing `disagreement` can weigh until it is a number.
  if (c.kind === "relations" && !(Array.isArray(c.expr) && c.expr[0] === "N") && !comparable(value)) {
    numeric.push({ ...c, expr: ["N", c.expr] });
    return;
  }
  const tolerance = measuredTolerance(value);
  if (c.known !== undefined && disagreement(value, c.known, tolerance ?? DEFAULT_TOLERANCE) !== undefined) {
    r.disagreements.push({ expr: show(c.expr), ours: show(value), known: show(c.known), source: c.source! });
    return;
  }
  const count = taken.get(`${c.head} ${c.kind}`) ?? 0;
  if (count >= CAP[c.kind]) return;
  taken.set(`${c.head} ${c.kind}`, count + 1);
  const example = {
    expr: c.expr,
    expected: value,
    ...(c.known !== undefined ? { known: c.known, source: c.source } : {}),
    ...(tolerance !== undefined ? { tolerance } : {}),
    ...(c.category !== "Basic" ? { category: c.category } : {}),
  } as ReferenceExample;
  (adopted.get(c.head) ?? adopted.set(c.head, []).get(c.head)!).push(example);
  r.adopted.push(`${show(c.expr)} = ${show(value)}`);
}
const results = await run(candidates.map((c) => c.expr));
for (const [i, c] of candidates.entries()) consider(c, results[i]!);
const numericResults = await run(numeric.map((c) => c.expr));
for (const [i, c] of numeric.entries()) consider(c, numericResults[i]!);

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
