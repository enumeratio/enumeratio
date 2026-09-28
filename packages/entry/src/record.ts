// A head's record on disk: one folder, `reference/<Head>/`, holding
//
//   index.md                          the entry's fields as front matter; a markdown body
//   examples.tsv                      one row per example, in page order: everything written
//                                     by hand, including each system's classification columns
//   examples.values.<system>.tsv      generated: that system's writing of each example (and,
//                                     for another system, its answer), same rows
//
// Read, the folder is the same `ReferenceEntry` and `HeadImplementations` the tools have always
// had; written, those split back into these files. Node-only.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "oxfmt";
import { FORMAT } from "./format.ts";
import { orderImplementations } from "./order.ts";
import { bySection } from "./sections.ts";
import { SYSTEM_ORDER } from "./sources.ts";
import { type Cell, decodeCell, encodeCell, parseTsv, stringifyTsv } from "./tsv.ts";
import type {
  ExampleImplementations,
  HeadImplementations,
  ReferenceEntry,
  ReferenceExample,
  SystemImplementation,
} from "./types.ts";
import { parseYaml, stringifyYaml } from "./yaml.ts";

export const INDEX_FILE = "index.md";
export const EXAMPLES_FILE = "examples.tsv";
const VALUES_PREFIX = "examples.values.";
const VALUES_SUFFIX = ".tsv";
export const valuesFile = (system: string): string => `${VALUES_PREFIX}${system}${VALUES_SUFFIX}`;
/** True for a head folder's generated `examples.values.<system>.tsv`. */
export const isValuesFile = (file: string): boolean => file.startsWith(VALUES_PREFIX) && file.endsWith(VALUES_SUFFIX);

/** An example's columns, in order, and how each is written. `section` is the entry's
 * `category`, named for what it is on the page. Any other field follows as a flow column. */
const EXAMPLE_COLUMNS: readonly (readonly [column: string, field: string, cell: Cell])[] = [
  ["id", "id", "text"],
  ["section", "category", "text"],
  ["role", "role", "text"],
  ["group", "group", "text"],
  ["expr", "expr", "flow"],
  ["expected", "expected", "flow"],
  ["known", "known", "flow"],
  ["tolerance", "tolerance", "flow"],
  ["source", "source", "text"],
  ["caption", "caption", "text"],
  ["aspirational", "aspirational", "flow"],
  ["volatile", "volatile", "flow"],
];

/** A system's fields written by hand -- the classification of a verdict -- which live in
 * examples.tsv as `<system>.<field>`; everything else a system has is generated. */
const HAND_FIELDS: readonly (readonly [string, Cell])[] = [
  ["kind", "text"],
  ["note", "text"],
  ["issue", "flow"],
  ["tolerance", "flow"],
];
const HAND = new Set(HAND_FIELDS.map(([field]) => field));

/** A values file's columns after `id`. `tex` splits in two; anything else is a flow column. */
const VALUE_COLUMNS: readonly (readonly [string, Cell])[] = [
  ["in", "text"],
  ["out", "text"],
  ["shown", "text"],
  ["tex.in", "text"],
  ["tex.out", "text"],
  ["verdict", "text"],
  ["messages", "flow"],
  ["back", "flow"],
];

const cellOf = (columns: readonly (readonly [string, Cell])[], column: string): Cell =>
  columns.find(([c]) => c === column)?.[1] ?? "flow";

// --- index.md ---------------------------------------------------------------------------

async function formatYaml(value: unknown): Promise<string> {
  const { code, errors } = await format("record.yaml", stringifyYaml(value), FORMAT);
  if (errors.length > 0) throw new Error(`oxfmt: ${JSON.stringify(errors)}`);
  return code;
}

/** `index.md`'s front matter and body. */
export function parseIndex(text: string): { fields: Record<string, unknown>; body: string } {
  const match = /^---\n([\s\S]*?\n)?---\n?([\s\S]*)$/.exec(text);
  if (match === null) throw new Error("index.md: no front matter");
  return { fields: (parseYaml(match[1] ?? "") ?? {}) as Record<string, unknown>, body: match[2]!.replace(/^\n/, "") };
}

async function indexText(fields: Record<string, unknown>, body: string): Promise<string> {
  return `---\n${await formatYaml(fields)}---\n${body === "" ? "" : `\n${body.replace(/\n*$/, "\n")}`}`;
}

// --- examples.tsv and the values files --------------------------------------------------

function exampleTable(examples: readonly ReferenceExample[], record: HeadImplementations): string {
  const fields = new Set(EXAMPLE_COLUMNS.map(([, field]) => field));
  const extra = [...new Set(examples.flatMap(Object.keys))].filter((k) => !fields.has(k) && k !== "others").toSorted();
  const hand = new Map<string, Set<string>>(); // system -> hand fields it uses
  for (const rows of Object.values(record))
    for (const [system, row] of Object.entries(rows))
      for (const field of Object.keys(row))
        if (HAND.has(field)) (hand.get(system) ?? hand.set(system, new Set()).get(system)!).add(field);
  const systems = [...hand.keys()].toSorted(bySystem);
  const handColumns = systems.flatMap((system) =>
    HAND_FIELDS.filter(([field]) => hand.get(system)!.has(field)).map(([field, cell]) => ({ system, field, cell })),
  );
  const always = new Set(["id", "section", "role", "expr", "expected"]);
  const used = EXAMPLE_COLUMNS.filter(([column, field]) => always.has(column) || examples.some((e) => field in e));
  const columns = [
    ...used.map(([column]) => column),
    ...extra,
    ...handColumns.map(({ system, field }) => `${system}.${field}`),
  ];
  const rows = examples.map((example) => {
    const row: Record<string, string> = {};
    const e = example as unknown as Record<string, unknown>;
    for (const [column, field, cell] of used) row[column] = encodeCell(e[field], cell);
    for (const key of extra) row[key] = encodeCell(e[key], "flow");
    for (const { system, field, cell } of handColumns)
      row[`${system}.${field}`] = encodeCell(
        (record[example.id]?.[system] as unknown as Record<string, unknown> | undefined)?.[field],
        cell,
      );
    return row;
  });
  return stringifyTsv({ columns, rows });
}

function valueTable(system: string, examples: readonly ReferenceExample[], record: HeadImplementations): string {
  const rowOf = (id: string): Record<string, unknown> | undefined =>
    record[id]?.[system] as unknown as Record<string, unknown> | undefined;
  const present = new Set<string>();
  for (const { id } of examples)
    for (const [field, value] of Object.entries(rowOf(id) ?? {}))
      if (!HAND.has(field))
        if (field === "tex") ["tex.in", "tex.out"].forEach((c) => present.add(c));
        else if (value !== undefined) present.add(field);
  const known = VALUE_COLUMNS.map(([c]) => c).filter((c) => present.has(c));
  const extra = [...present].filter((c) => !VALUE_COLUMNS.some(([k]) => k === c)).toSorted();
  const columns = ["id", ...known, ...extra];
  const rows = examples.map(({ id }) => {
    const source = rowOf(id) ?? {};
    const tex = source["tex"] as { in?: string; out?: string } | undefined;
    const row: Record<string, string> = { id: encodeCell(id, "text") };
    for (const column of columns.slice(1))
      row[column] =
        column === "tex.in"
          ? encodeCell(tex?.in, "text")
          : column === "tex.out"
            ? encodeCell(tex?.out, "text")
            : encodeCell(source[column], cellOf(VALUE_COLUMNS, column));
    return row;
  });
  return stringifyTsv({ columns, rows });
}

const SYSTEM_RANK = ["epsil", "tex", "traditional", "fullform", "notatio", ...SYSTEM_ORDER];
function bySystem(a: string, b: string): number {
  const rank = (s: string): number => (SYSTEM_RANK.indexOf(s) + 1 || SYSTEM_RANK.length + 1) - 1;
  return rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Every system with a row for some example. */
function systemsOf(record: HeadImplementations): string[] {
  return [...new Set(Object.values(record).flatMap((rows) => Object.keys(rows)))].toSorted(bySystem);
}

// --- a head's folder ------------------------------------------------------------------

export interface HeadRecord {
  readonly entry: ReferenceEntry;
  /** Absent when no example has any system's row. */
  readonly implementations?: HeadImplementations;
  /** `index.md`'s markdown body, "" when there is none. */
  readonly body: string;
}

/** The heads with a folder in `dir`, by name. */
export function headNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, INDEX_FILE)))
    .map((e) => e.name)
    .toSorted();
}

export const headExists = (dir: string, head: string): boolean => existsSync(join(dir, head, INDEX_FILE));

/** Parse a head's folder. Throws on a malformed file; the loader turns that into an issue. */
export function readHead(dir: string, head: string): HeadRecord {
  const folder = join(dir, head);
  const files = new Map(
    readdirSync(folder)
      .filter(
        (f) => f === INDEX_FILE || f === EXAMPLES_FILE || (f.startsWith(VALUES_PREFIX) && f.endsWith(VALUES_SUFFIX)),
      )
      .map((f) => [f, readFileSync(join(folder, f), "utf8")] as const),
  );
  return decodeHead(files);
}

/** A head's record from its files' text, by name (`index.md`, `examples.tsv`, the values files). */
export function decodeHead(files: ReadonlyMap<string, string>): HeadRecord {
  const index = files.get(INDEX_FILE);
  if (index === undefined) throw new Error(`no ${INDEX_FILE}`);
  const { fields, body } = parseIndex(index);
  const record: Record<string, Record<string, Record<string, unknown>>> = {};
  const examples: ReferenceExample[] = [];
  const examplesText = files.get(EXAMPLES_FILE);
  if (examplesText !== undefined) {
    const table = parseTsv(examplesText);
    for (const row of table.rows) {
      const example: Record<string, unknown> = {};
      for (const column of table.columns) {
        const spec = EXAMPLE_COLUMNS.find(([c]) => c === column);
        const dot = column.indexOf(".");
        if (spec !== undefined) {
          const value = decodeCell(row[column]!, spec[2]);
          if (value !== undefined) example[spec[1]] = value;
        } else if (dot > 0) {
          const [system, field] = [column.slice(0, dot), column.slice(dot + 1)];
          const value = decodeCell(row[column]!, cellOf(HAND_FIELDS, field));
          if (value !== undefined) ((record[row["id"]!] ??= {})[system] ??= {})[field] = value;
        } else {
          const value = decodeCell(row[column]!, "flow");
          if (value !== undefined) example[column] = value;
        }
      }
      examples.push(example as unknown as ReferenceExample);
    }
  }
  const ids = examples.map((e) => e.id);
  for (const [file, text] of [...files].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!file.startsWith(VALUES_PREFIX) || !file.endsWith(VALUES_SUFFIX)) continue;
    const system = file.slice(VALUES_PREFIX.length, -VALUES_SUFFIX.length);
    const table = parseTsv(text);
    const rowIds = table.rows.map((row) => row["id"]);
    if (JSON.stringify(rowIds) !== JSON.stringify(ids))
      throw new Error(`${file}: its rows aren't examples.tsv's, in the same order`);
    for (const row of table.rows) {
      const generated: Record<string, unknown> = {};
      for (const column of table.columns.slice(1)) {
        const value = decodeCell(row[column]!, cellOf(VALUE_COLUMNS, column));
        if (value === undefined) continue;
        if (column === "tex.in" || column === "tex.out")
          ((generated["tex"] ??= {}) as Record<string, unknown>)[column.slice(4)] = value;
        else generated[column] = value;
      }
      if (Object.keys(generated).length === 0) continue;
      const rows = (record[row["id"]!] ??= {});
      rows[system] = { ...generated, ...rows[system] };
    }
  }
  const entry = { ...fields, examples } as unknown as ReferenceEntry;
  if (Object.keys(record).length === 0) return { entry, body };
  const implementations = orderImplementations(record as unknown as HeadImplementations, ids, SYSTEM_ORDER);
  return { entry, implementations, body };
}

/** The files a head's record is written to, by name inside its folder. */
export async function headFiles({ entry, implementations = {}, body }: HeadRecord): Promise<Map<string, string>> {
  const { examples, ...fields } = JSON.parse(JSON.stringify(entry)) as ReferenceEntry;
  const clean = bySection(examples.map(({ others: _others, divergence: _divergence, ...e }) => e as ReferenceExample));
  const files = new Map([[INDEX_FILE, await indexText(fields as Record<string, unknown>, body)]]);
  if (clean.length === 0) return files;
  files.set(EXAMPLES_FILE, exampleTable(clean, implementations));
  for (const system of systemsOf(implementations)) {
    const hasGenerated = Object.values(implementations).some((rows) =>
      Object.keys((rows[system] ?? {}) as SystemImplementation).some((field) => !HAND.has(field)),
    );
    if (hasGenerated) files.set(valuesFile(system), valueTable(system, clean, implementations));
  }
  return files;
}

/** Write a head's folder: every file `headFiles` makes, and nothing else of the record's. */
export async function writeHead(dir: string, head: string, record: HeadRecord): Promise<void> {
  const folder = join(dir, head);
  mkdirSync(folder, { recursive: true });
  const files = await headFiles(record);
  for (const file of readdirSync(folder))
    if ((file === EXAMPLES_FILE || file.startsWith(VALUES_PREFIX)) && !files.has(file)) rmSync(join(folder, file));
  for (const [file, text] of files) writeFileSync(join(folder, file), text);
}

/** Replace one part of a head's record -- its entry, its implementations or its body --
 * keeping the others as they are on disk. */
export async function updateHead(
  dir: string,
  head: string,
  part: { entry?: ReferenceEntry; implementations?: HeadImplementations; body?: string },
): Promise<void> {
  const current: HeadRecord = headExists(dir, head)
    ? readHead(dir, head)
    : { entry: part.entry!, implementations: undefined, body: "" };
  await writeHead(dir, head, {
    entry: part.entry ?? current.entry,
    implementations: "implementations" in part ? part.implementations : current.implementations,
    body: part.body ?? current.body,
  });
}

/** Remove a head's record entirely. */
export function removeHead(dir: string, head: string): void {
  rmSync(join(dir, head), { recursive: true, force: true });
}

export type { ExampleImplementations };
