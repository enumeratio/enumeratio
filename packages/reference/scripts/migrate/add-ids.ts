// Step 2 of design/examples-as-data.md §8: give every example an `id`.
//
//   node packages/reference/scripts/migrate/add-ids.ts [--write]
//
// Loads the entries as evaluated (so computed examples count), assigns ids per head in the
// site's order (core entries first, then collections, statistics, domains, which is also
// who wins a shared head's page), then inserts `id` into each example's object literal
// with ts-morph, checking head, position and caption against the evaluated list. Also
// writes ids into `special-functions.examples.json`, rekeys the oracle sidecars from
// `JSON.stringify(expr)` to id, and dumps `(head, #example-N) → id` for the page links.
// Without `--write` it only reports.
//
// Safe to re-run: ids already in the data are kept, so a lane that merged main and added
// examples without ids runs it with `--write` to fill in just those, and to rekey any
// sidecar rows it wrote by expression.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ReferenceEntry, ReferenceExample } from "@enumeratio/entry";
import { entries as collectionsEntries } from "@enumeratio/collections/reference";
import { entries as domainsEntries } from "@enumeratio/domains/reference";
import { entries as statisticsEntries } from "@enumeratio/statistics/reference";
import { type Node, type ObjectLiteralExpression, Project, SyntaxKind } from "ts-morph";
import { entryFiles, oracleSidecars } from "../../src/entries.ts";
import { dedupeId as dedupe } from "@enumeratio/entry";
import { baseId } from "./ids.ts";

const write = process.argv.includes("--write");
const root = (path: string): string =>
  fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const EXAMPLES_JSON = "packages/reference/src/entries/special-functions.examples.json";
const extra = JSON.parse(readFileSync(root(EXAMPLES_JSON), "utf8")) as Record<
  string,
  Record<string, unknown>[]
>;

interface Source {
  file: string;
  entries: readonly ReferenceEntry[];
  /** Per head, how many trailing examples come from `<stem>.examples.json`, not the TS. */
  appended?: Readonly<Record<string, number>>;
  stem?: string;
}

const sources: Source[] = [
  ...entryFiles.map(({ stem, entries }) => ({
    file: `packages/reference/src/entries/${stem}.ts`,
    entries,
    stem,
    appended:
      stem === "special-functions"
        ? Object.fromEntries(Object.entries(extra).map(([h, xs]) => [h, xs.length]))
        : undefined,
  })),
  {
    file: "packages/symbols/combinatorics/collections/src/entries.ts",
    entries: collectionsEntries,
  },
  { file: "packages/symbols/combinatorics/statistics/src/entries.ts", entries: statisticsEntries },
  { file: "packages/symbols/combinatorics/domains/src/entries.ts", entries: domainsEntries },
];

// Ids, in the site's order, one id space per head across every source.
const taken = new Map<string, Set<string>>();
const idsOf = new Map<ReferenceEntry, string[]>();
for (const { entries } of sources) {
  for (const entry of entries) {
    const set = taken.get(entry.name) ?? new Set<string>();
    taken.set(entry.name, set);
    // Ids already in the data stay; only examples without one get a fresh id.
    for (const ex of entry.examples) if (ex.id) set.add(ex.id);
    idsOf.set(
      entry,
      entry.examples.map((ex) => ex.id || dedupe(baseId(ex), set)),
    );
  }
}

// ---- source literals ------------------------------------------------------------------
const project = new Project({ skipAddingFilesFromTsConfig: true });
const problems: string[] = [];

const prop = (obj: ObjectLiteralExpression, name: string): Node | undefined =>
  obj.getProperty(name);
const stringOf = (node: Node | undefined): string | undefined => {
  const init = node?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();
  if (
    init?.isKind(SyntaxKind.StringLiteral) ||
    init?.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
  )
    return init.getLiteralValue();
  return undefined;
};

/** The entry literal an example literal sits in: nearest ancestor with `name` and `examples`. */
const headOf = (obj: ObjectLiteralExpression): string | undefined => {
  for (const anc of obj.getAncestors()) {
    const o = anc.asKind(SyntaxKind.ObjectLiteralExpression);
    if (o && prop(o, "examples") && prop(o, "name")) return stringOf(prop(o, "name"));
  }
  return undefined;
};

let inserted = 0;
for (const { file, entries, appended } of sources) {
  const sf = project.addSourceFileAtPath(root(file));
  const literals = sf
    .getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)
    .filter((o) => prop(o, "expr") && prop(o, "expected"));
  const byHead = new Map<string, ObjectLiteralExpression[]>();
  for (const lit of literals) {
    const head = headOf(lit);
    if (head === undefined) {
      problems.push(`${file}:${lit.getStartLineNumber()}: example literal outside a named entry`);
      continue;
    }
    byHead.set(head, [...(byHead.get(head) ?? []), lit]);
  }
  for (const entry of entries) {
    const ids = idsOf.get(entry)!;
    const own = entry.examples.length - (appended?.[entry.name] ?? 0);
    const lits = byHead.get(entry.name) ?? [];
    byHead.delete(entry.name);
    if (lits.length !== own) {
      problems.push(`${file} ${entry.name}: ${lits.length} literals, ${own} examples`);
      continue;
    }
    lits.forEach((lit, i) => {
      const ex = entry.examples[i]!;
      const caption = stringOf(prop(lit, "caption"));
      if (prop(lit, "caption") && caption === undefined) {
        // A computed caption: can't compare, but position already matched.
      } else if (caption !== ex.caption) {
        problems.push(
          `${file}:${lit.getStartLineNumber()} ${entry.name} #${i + 1}: caption mismatch`,
        );
        return;
      }
      if (prop(lit, "id")) return;
      lit.insertPropertyAssignment(0, { name: "id", initializer: JSON.stringify(ids[i]) });
      inserted++;
    });
  }
  for (const [head, lits] of byHead)
    problems.push(`${file} ${head}: ${lits.length} literals with no evaluated entry`);
  if (write) sf.saveSync();
}

// ---- special-functions.examples.json ----------------------------------------------------
const special = sources.find((s) => s.stem === "special-functions")!;
const withIds = Object.fromEntries(
  Object.entries(extra).map(([head, xs]) => {
    const entry = special.entries.find((e) => e.name === head)!;
    const ids = idsOf.get(entry)!.slice(entry.examples.length - xs.length);
    return [head, xs.map((x, i) => ({ id: ids[i], ...x }))];
  }),
);

// ---- sidecars: JSON.stringify(expr) → id ------------------------------------------------
const rekeyed: Record<string, unknown> = {};
for (const { stem, entries } of sources) {
  if (stem === undefined) continue;
  const sidecar = oracleSidecars[stem] as {
    kernels?: object;
    examples?: Record<string, Record<string, unknown>>;
  };
  if (sidecar === undefined) continue;
  const examples: Record<string, Record<string, unknown>> = {};
  for (const [head, rows] of Object.entries(sidecar.examples ?? {})) {
    const entry = entries.find((e) => e.name === head);
    if (entry === undefined) {
      problems.push(`${stem}.oracle.json ${head}: no such head`);
      continue;
    }
    const ids = idsOf.get(entry)!;
    const byKey = new Map<string, string[]>();
    entry.examples.forEach((ex, i) => {
      const key = JSON.stringify(ex.expr);
      byKey.set(key, [...(byKey.get(key) ?? []), ids[i]!]);
    });
    const out: Record<string, unknown> = {};
    // Rows in example order, so the file reads like the page.
    const pending = new Map(Object.entries(rows));
    for (const [i, ex] of entry.examples.entries()) {
      const row = rows[ids[i]!] ?? rows[JSON.stringify(ex.expr)];
      if (row !== undefined) out[ids[i]!] = row;
      pending.delete(ids[i]!);
      pending.delete(JSON.stringify(ex.expr));
    }
    for (const key of pending.keys())
      problems.push(`${stem}.oracle.json ${head} ${key}: orphan row`);
    if (Object.keys(out).length > 0) examples[head] = out;
  }
  rekeyed[stem] = { ...sidecar, examples };
}

// ---- #example-N → id, over the page's entry (first source wins) --------------------------
const links: Record<string, Record<string, string>> = {};
for (const { entries } of sources) {
  for (const entry of entries) {
    if (links[entry.name] !== undefined) continue;
    const ids = idsOf.get(entry)!;
    const map: Record<string, string> = {};
    const ex = entry.examples as readonly ReferenceExample[];
    ex.forEach((e, i) => {
      map[`example-${i + 1}`] = ids[i]!;
      if (e.group === undefined) return;
      const members = ex.flatMap((m, j) => (m.group === e.group ? [j] : []));
      members.slice(members.indexOf(i)).forEach((j, x) => {
        map[`example-${i + 1}=${x + 1}`] = ids[j]!;
      });
    });
    links[entry.name] = map;
  }
}

console.log(`${inserted} ids inserted${write ? "" : " (dry run)"}`);
for (const p of problems) console.log(`  ${p}`);
if (write) {
  writeFileSync(root(EXAMPLES_JSON), `${JSON.stringify(withIds, null, 2)}\n`);
  for (const [stem, sidecar] of Object.entries(rekeyed))
    writeFileSync(
      root(`packages/reference/src/entries/${stem}.oracle.json`),
      `${JSON.stringify(sidecar, null, 2)}\n`,
    );
}
const out = process.env.LINKS_OUT;
if (out) writeFileSync(out, `${JSON.stringify(links, null, 2)}\n`);
if (problems.length > 0) process.exitCode = 1;
