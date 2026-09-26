// The fs-based loader for the YAML records (design/examples-as-data.md §8 step 1). Reads
// `<package>/reference/<Head>.yaml` with its optional `<Head>.examples.yaml` and
// `<Head>.implementations.yaml`, through
// `@enumeratio/entry`'s strict reader, validated against its JSON Schema, and checks for `id`
// collisions on a head shared between two packages (§9 "Shared heads").
//
// Node-only (`node:fs`), so this lives on the `/node` subpath, never the package's `.` entry:
// `ExampleAlternatives.vue` imports `@enumeratio/reference` in the browser, and a filesystem
// loader on the main export would break the site build.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type HeadImplementations,
  type OtherSystemRun,
  parseYaml,
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
import { isCrosswalkSystem } from "./crosswalk/sources.ts";

export interface LoadedHead {
  /** The workspace package's directory name (`analytic`, `collections`, …). */
  readonly package: string;
  /** The head name, from the file's basename. */
  readonly head: string;
  readonly entryPath: string;
  readonly entry: ReferenceEntry;
  /** Absent when the head has no examples. */
  readonly examplesPath?: string;
  readonly implementationsPath?: string;
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

const ENTRY_SUFFIX = ".yaml";
const EXAMPLES_SUFFIX = ".examples.yaml";
const IMPLEMENTATIONS_SUFFIX = ".implementations.yaml";

function headName(fileName: string): string {
  return fileName.slice(0, -ENTRY_SUFFIX.length);
}

/** Where the YAML lives under `packages/`: `<package>/reference/`, a symbol package's
 * `symbols/<group>/<package>/reference/`, and reference's own `entries/` (the engine's heads). */
function dataDirs(packagesRoot: string): { package: string; dir: string }[] {
  const subdirs = (dir: string): string[] =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
          .sort()
      : [];
  const packages = [
    ...subdirs(packagesRoot).map((pkg) => ({ pkg, dir: join(packagesRoot, pkg) })),
    ...subdirs(join(packagesRoot, "symbols")).flatMap((group) =>
      subdirs(join(packagesRoot, "symbols", group)).map((pkg) => ({
        pkg,
        dir: join(packagesRoot, "symbols", group, pkg),
      })),
    ),
  ];
  return packages
    .map(({ pkg, dir }) => ({
      package: pkg,
      dir: join(dir, pkg === "reference" ? "entries" : "reference"),
    }))
    .filter(({ dir }) => existsSync(dir));
}

/**
 * Scan every package's YAML directory (see `dataDirs`) for `<Head>.yaml` files, parse
 * and validate each one (and its `.implementations.yaml`, if present), and check that no two
 * packages assign the same id to the same head (design/examples-as-data.md §3, §9).
 *
 * `packagesRoot` is normally the repo's `packages/` directory; a caller passes a fixture
 * directory in tests instead of scanning real data.
 */
export function loadReferenceData(packagesRoot: string): LoadResult {
  const heads: LoadedHead[] = [];
  const issues: LoadIssue[] = [];
  // "<Head>/<id>" -> the file that first declared it, so a repeat can name where it collides.
  const seenIds = new Map<string, string>();

  for (const { package: pkg, dir: referenceDir } of dataDirs(packagesRoot)) {
    const files = readdirSync(referenceDir).filter(
      (f) => f.endsWith(ENTRY_SUFFIX) && !f.endsWith(EXAMPLES_SUFFIX) && !f.endsWith(IMPLEMENTATIONS_SUFFIX),
    );

    for (const file of files.sort()) {
      const head = headName(file);
      const entryPath = join(referenceDir, file);
      let fields: Omit<ReferenceEntry, "examples">;
      try {
        fields = parseYaml(readFileSync(entryPath, "utf8")) as Omit<ReferenceEntry, "examples">;
      } catch (error) {
        issues.push({ file: entryPath, message: `failed to parse: ${(error as Error).message}` });
        continue;
      }
      for (const message of validateSchema(REFERENCE_ENTRY_SCHEMA, fields)) issues.push({ file: entryPath, message });

      const examplesPath = join(referenceDir, `${head}${EXAMPLES_SUFFIX}`);
      let examples: ReferenceExample[] = [];
      if (existsSync(examplesPath)) {
        try {
          examples = parseYaml(readFileSync(examplesPath, "utf8")) as ReferenceExample[];
        } catch (error) {
          issues.push({ file: examplesPath, message: `failed to parse: ${(error as Error).message}` });
        }
        for (const message of validateSchema(REFERENCE_EXAMPLES_SCHEMA, examples))
          issues.push({ file: examplesPath, message });
      }
      const entry: ReferenceEntry = { ...fields, examples };

      const implementationsPath = join(referenceDir, `${head}${IMPLEMENTATIONS_SUFFIX}`);
      let implementations: HeadImplementations | undefined;
      if (existsSync(implementationsPath)) {
        try {
          implementations = parseYaml(readFileSync(implementationsPath, "utf8")) as HeadImplementations;
        } catch (error) {
          issues.push({
            file: implementationsPath,
            message: `failed to parse: ${(error as Error).message}`,
          });
        }
        if (implementations !== undefined)
          for (const message of validateSchema(HEAD_IMPLEMENTATIONS_SCHEMA, implementations))
            issues.push({ file: implementationsPath, message });
      }

      for (const example of entry.examples ?? []) {
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
        entryPath,
        entry,
        examplesPath: examples.length > 0 ? examplesPath : undefined,
        implementationsPath: implementations !== undefined ? implementationsPath : undefined,
        implementations,
      });
    }
  }

  return { heads, issues };
}

/** The repo's `packages/`, which every caller but the loader's own tests reads. */
export const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));

/** Every system's kernel version, as the last scan of it recorded (scripts/oracle-scan.ts). */
const KERNELS = new URL("../../oracle/kernels.json", import.meta.url);

/** Our own forms of an example (notatio/scripts/forms.ts): rows a record keeps beside the
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
  const rank = (h: LoadedHead): string => `${h.package === "reference" ? "0" : "1"}${h.entryPath}`;
  const chosen = new Map<string, LoadedHead>();
  for (const h of [...heads].sort((a, b) => cmp(rank(a), rank(b)))) if (!chosen.has(h.head)) chosen.set(h.head, h);
  const entries = [...chosen.values()].map(withRecord).sort((a, b) => cmp(a.domain, b.domain) || cmp(a.name, b.name));

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
  for (const entry of [...data.entries].sort((a, b) => a.name.localeCompare(b.name))) {
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
      .sort(([a], [b]) => a.localeCompare(b))
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
