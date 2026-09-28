// The fs-based loader for the records (design/examples-as-data.md §8 step 1). Reads each
// `<package>/reference/<Head>/` folder (see @enumeratio/entry's record.ts), through
// `@enumeratio/entry`'s strict reader, validated against its JSON Schema, and checks for `id`
// collisions on a head shared between two packages (§9 "Shared heads").
//
// Node-only (`node:fs`), so this lives on the `/node` subpath, never the package's `.` entry:
// `ExampleAlternatives.vue` imports `@enumeratio/reference` in the browser, and a filesystem
// loader on the main export would break the site build.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bySection,
  type HeadImplementations,
  type OtherSystemRun,
  type ReferenceEntry,
  type ReferenceExample,
  type SystemImplementation,
} from "@enumeratio/entry";
import {
  HEAD_IMPLEMENTATIONS_SCHEMA,
  REFERENCE_ENTRY_SCHEMA,
  REFERENCE_EXAMPLES_SCHEMA,
  validateSchema,
} from "@enumeratio/entry/schema";
import { EXAMPLES_FILE, headNames, type HeadRecord, INDEX_FILE, readHead, recordDirs } from "@enumeratio/entry/node";
import { isCrosswalkSystem } from "./crosswalk/sources.ts";

export interface LoadedHead {
  /** The workspace package's directory name (`analytic`, `collections`, …). */
  readonly package: string;
  /** The head name, from its folder's name. */
  readonly head: string;
  /** The package's record directory, which holds the head's folder. */
  readonly dir: string;
  /** The head's folder, `<dir>/<head>/`. */
  readonly folder: string;
  /** Its `index.md`. */
  readonly entryPath: string;
  readonly entry: ReferenceEntry;
  /** `index.md`'s markdown body, "" when there is none. */
  readonly body: string;
  /** Its `examples.tsv`; absent when the head has no examples. */
  readonly examplesPath?: string;
  readonly implementations?: HeadImplementations;
}

export interface LoadIssue {
  readonly file: string;
  readonly message: string;
}

export interface LoadResult {
  readonly heads: readonly LoadedHead[];
  readonly issues: readonly LoadIssue[];
}

/** True when the rows are in page order: each section's together, the sections in order. */
const inPageOrder = (examples: readonly ReferenceExample[]): boolean =>
  JSON.stringify(bySection(examples).map((e) => e.id)) === JSON.stringify(examples.map((e) => e.id));

/**
 * Scan every package's record directory (see `recordDirs` in `@enumeratio/entry/node`) for head
 * folders (`<Head>/index.md`, `examples.tsv`, `examples.values.<system>.tsv`), parse and validate
 * each, and check that no two packages assign the same id to the same head
 * (design/examples-as-data.md §3, §9).
 *
 * `packagesRoot` is normally the repo's `packages/` directory; a caller passes a fixture
 * directory in tests instead of scanning real data.
 */
export function loadReferenceData(packagesRoot: string): LoadResult {
  const heads: LoadedHead[] = [];
  const issues: LoadIssue[] = [];
  // "<Head>/<id>" -> the file that first declared it, so a repeat can name where it collides.
  const seenIds = new Map<string, string>();

  for (const { package: pkg, dir: referenceDir } of recordDirs(packagesRoot)) {
    for (const head of headNames(referenceDir)) {
      const folder = join(referenceDir, head);
      const entryPath = join(folder, INDEX_FILE);
      const examplesPath = join(folder, EXAMPLES_FILE);
      let record: HeadRecord;
      try {
        record = readHead(referenceDir, head);
      } catch (error) {
        issues.push({ file: folder, message: `failed to parse: ${(error as Error).message}` });
        continue;
      }
      const { examples, ...fields } = record.entry;
      for (const message of validateSchema(REFERENCE_ENTRY_SCHEMA, fields)) issues.push({ file: entryPath, message });
      if (examples.length > 0)
        for (const message of validateSchema(REFERENCE_EXAMPLES_SCHEMA, examples))
          issues.push({ file: examplesPath, message });
      if (!inPageOrder(examples))
        issues.push({
          file: examplesPath,
          message: "rows aren't in page order (each section's together, in SECTIONS order): run format-records",
        });
      const implementations = record.implementations;
      if (implementations !== undefined)
        for (const message of validateSchema(HEAD_IMPLEMENTATIONS_SCHEMA, implementations))
          issues.push({ file: folder, message });

      for (const example of examples) {
        if (example.id === undefined) continue;
        const globalId = `${head}/${example.id}`;
        const seenIn = seenIds.get(globalId);
        if (seenIn !== undefined)
          issues.push({
            file: examplesPath,
            message: `id collision: "${globalId}" is also declared in ${seenIn}`,
          });
        else seenIds.set(globalId, examplesPath);
      }

      heads.push({
        package: pkg,
        head,
        dir: referenceDir,
        folder,
        entryPath,
        entry: record.entry,
        body: record.body,
        examplesPath: examples.length > 0 ? examplesPath : undefined,
        implementations,
      });
    }
  }

  return { heads, issues };
}

/** The repo's `packages/`, which every caller but the loader's own tests reads. */
export const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));

/**
 * One `LoadedHead` per name, for a head two packages document (design/examples-as-data.md
 * §9 "Shared heads"): reference's own copy when it has one, else the first package's by
 * path. The same precedence `referenceData()` uses to pick which entry a name resolves to --
 * a migration script edits THIS copy, not an arbitrary duplicate, or its write is invisible
 * to every consumer that reads through `referenceData()`.
 */
export function canonicalHeads(heads: readonly LoadedHead[]): ReadonlyMap<string, LoadedHead> {
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const rank = (h: LoadedHead): string => `${h.package === "reference" ? "0" : "1"}${h.entryPath}`;
  const chosen = new Map<string, LoadedHead>();
  for (const h of [...heads].toSorted((a, b) => cmp(rank(a), rank(b)))) if (!chosen.has(h.head)) chosen.set(h.head, h);
  return chosen;
}

/** Every system's kernel version, as the last scan of it recorded (scripts/oracle-scan.ts). */
const KERNELS = new URL("../../oracle/kernels.json", import.meta.url);

/** Our own forms of an example (frontend/scripts/forms.ts): rows a record keeps beside the
 * systems', with no kernel behind them. */
const OWN_FORMS = new Set(["epsil", "tex", "traditional", "fullform", "notatio"]);

/** A record row as the page reads it: a scanned system's run of one example. */
const runOf = (row: SystemImplementation): OtherSystemRun => ({
  input: row.in,
  output: row.out!,
  verdict: row.verdict ?? "agree",
  ...(row.kind !== undefined ? { kind: row.kind } : {}),
  ...(row.note !== undefined ? { note: row.note } : {}),
  ...(row.tolerance !== undefined ? { tolerance: row.tolerance } : {}),
  ...(row.issue !== undefined ? { issue: row.issue } : {}),
  ...(row.shown !== undefined ? { shown: row.shown } : {}),
  ...(row.tex !== undefined ? { tex: { input: row.tex.in, output: row.tex.out } } : {}),
});

export interface ReferenceData {
  /** One entry per head, `others` attached, sorted by domain then name. A head two packages
   * document is reference's copy when it has one, else the first package's by path. */
  readonly entries: readonly ReferenceEntry[];
  /** The package directory each of `entries` came from. */
  readonly packageOf: ReadonlyMap<string, string>;
  /** Every loaded head, duplicates included, with the package directory it came from. */
  readonly heads: readonly LoadedHead[];
  /** Every system's kernel version, as the last scan of it recorded. */
  readonly kernels: Readonly<Record<string, string>>;
}

const cache = new Map<string, ReferenceData>();

/**
 * The reference data every consumer reads: the YAML, validated (a problem throws). Each
 * example carries its implementations record's rows as the page reads them: a scanned
 * system's run as `others`, and Wolfram's note as `divergence`.
 */
export function referenceData(
  packagesRoot: string = PACKAGES,
  { fresh = false }: { fresh?: boolean } = {},
): ReferenceData {
  const hit = fresh ? undefined : cache.get(packagesRoot);
  if (hit !== undefined) return hit;
  const { heads, issues } = loadReferenceData(packagesRoot);
  if (issues.length > 0)
    throw new Error(`reference data: ${issues.map((i) => `\n  ${i.file}: ${i.message}`).join("")}`);

  const kernels = (
    packagesRoot === PACKAGES && existsSync(KERNELS) ? JSON.parse(readFileSync(KERNELS, "utf8")) : {}
  ) as Record<string, string>;

  const withRecord = (h: LoadedHead): ReferenceEntry => {
    const record = h.implementations;
    if (record === undefined) return h.entry;
    return {
      ...h.entry,
      examples: h.entry.examples.map((example) => {
        const rows = record[example.id];
        if (rows === undefined) return example;
        const scanned = Object.entries(rows).filter(([key, row]) => !OWN_FORMS.has(key) && row.out !== undefined);
        // A chip is Wolfram's: the one system with authored "differs from" prose. Other
        // systems' notes explain their rows (a transpiler shape, a kernel's convention), and so
        // does a note on a row where Wolfram errored.
        const noted = Object.entries(rows).filter(
          ([system, row]) => system === "wolfram" && row.note && row.verdict !== "error",
        );
        return {
          ...example,
          ...(scanned.length ? { others: Object.fromEntries(scanned.map(([s, row]) => [s, runOf(row)])) } : {}),
          ...(noted.length ? { divergence: Object.fromEntries(noted.map(([s, row]) => [s, row.note!])) } : {}),
        };
      }),
    };
  };

  // By code unit, not localeCompare: generated files must sort the same in every locale.
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const chosen = canonicalHeads(heads);
  const entries = [...chosen.values()]
    .map(withRecord)
    .toSorted((a, b) => cmp(a.domain, b.domain) || cmp(a.name, b.name));

  const packageOf = new Map([...chosen].map(([head, h]) => [head, h.package]));
  const data = { entries, packageOf, heads, kernels };
  cache.set(packagesRoot, data);
  return data;
}

/** Per head, how each crosswalk system's kernel fared on its examples: the crosswalk chips'
 * score, written to src/crosswalk/oracle-agreements.json. */
export function oracleAgreementsOf(
  data: ReferenceData,
): Record<string, { system: string; agree: number; disagree: number; kernel: string }[]> {
  const out: Record<string, { system: string; agree: number; disagree: number; kernel: string }[]> = {};
  for (const entry of [...data.entries].toSorted((a, b) => a.name.localeCompare(b.name))) {
    const tally = new Map<string, { agree: number; disagree: number }>();
    for (const example of entry.examples)
      for (const [system, run] of Object.entries(example.others ?? {})) {
        if (!isCrosswalkSystem(system)) continue;
        const row = tally.get(system) ?? { agree: 0, disagree: 0 };
        if (run.verdict === "agree") row.agree += 1;
        if (run.verdict === "disagree") row.disagree += 1;
        tally.set(system, row);
      }
    // By system name, so the order rows sit in a record doesn't matter.
    const rows = [...tally]
      .toSorted(([a], [b]) => a.localeCompare(b))
      .filter(([system, row]) => (row.agree || row.disagree) && data.kernels[system] !== undefined)
      .map(([system, row]) => ({ system, kernel: data.kernels[system]!, ...row }));
    if (rows.length > 0) out[entry.name] = rows;
  }
  return out;
}

/** Rewrite oracle-agreements.json from the current data. */
export function writeOracleAgreements(data: ReferenceData = referenceData()): void {
  writeFileSync(
    new URL("./crosswalk/oracle-agreements.json", import.meta.url),
    `${JSON.stringify(oracleAgreementsOf(data), null, 2)}\n`,
  );
}

/** Packages whose heads need their own engine (statistics over the carriers, the maps over
 * those): the reference engine (scripts/engines.ts) doesn't declare them, and each package's
 * own entries test runs them. */
const OWN_ENGINE = new Set(["statistics", "domains"]);

/** The entries the reference engine evaluates: every head but those in `OWN_ENGINE`. */
export function referenceEntries(data: ReferenceData = referenceData()): readonly ReferenceEntry[] {
  return data.entries.filter((entry) => !OWN_ENGINE.has(data.packageOf.get(entry.name)!));
}

/** One package's own entries (by directory name), as that package's tests run them. */
export function packageEntries(pkg: string, data: ReferenceData = referenceData()): readonly ReferenceEntry[] {
  return data.heads.filter((h) => h.package === pkg).map((h) => h.entry);
}
