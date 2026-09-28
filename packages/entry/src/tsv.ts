// Tab-separated tables for the reference records: a head's `examples.tsv` and its generated
// `examples.values.<system>.tsv`. One header row, one row per example; an empty cell is an
// absent field. A column holds either text, as written (`\zeta(2)` stays `\zeta(2)`), or a
// value in flow YAML (`[Mod, 5, 0]`, `3`, `true`), read back through the strict scalar schema.
// A cell that can't sit in a row as written is a JSON string.

import { parseYaml, stringifyFlow } from "./yaml.ts";

export type Cell = "text" | "flow";

/** Text that can't sit in a cell as written -- a tab or line break, a leading `"`, or nothing
 * at all (an empty cell is an absent field) -- is written as a JSON string instead. */
const needsQuotes = (text: string): boolean => text === "" || /[\t\n\r]/.test(text) || text.startsWith('"');

/** One cell's text for `value` in a column of `kind`; `undefined` is the empty cell. */
export function encodeCell(value: unknown, kind: Cell): string {
  if (value === undefined) return "";
  if (kind === "text") {
    if (typeof value !== "string") throw new Error(`text cell given ${JSON.stringify(value)}`);
    return needsQuotes(value) ? JSON.stringify(value) : value;
  }
  const flow = stringifyFlow(value);
  // JSON is flow YAML too, and never breaks a line.
  return flow === "" || /[\t\n\r]/.test(flow) ? JSON.stringify(value) : flow;
}

/** The value a cell holds, or `undefined` when it's empty. */
export function decodeCell(text: string, kind: Cell): unknown {
  if (text === "") return undefined;
  if (kind === "text") return text.startsWith('"') ? (JSON.parse(text) as string) : text;
  return parseYaml(text);
}

export interface Table {
  readonly columns: readonly string[];
  /** Each row's cells by column, still encoded. */
  readonly rows: readonly Readonly<Record<string, string>>[];
}

export function parseTsv(text: string): Table {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const [header, ...body] = lines;
  if (header === undefined) return { columns: [], rows: [] };
  const columns = header.split("\t");
  const rows = body.map((line, i) => {
    const cells = line.split("\t");
    if (cells.length !== columns.length)
      throw new Error(`row ${i + 2}: ${cells.length} cells for ${columns.length} columns`);
    return Object.fromEntries(columns.map((c, j) => [c, cells[j]!]));
  });
  return { columns, rows };
}

export function stringifyTsv({ columns, rows }: Table): string {
  const lines = [columns.join("\t"), ...rows.map((row) => columns.map((c) => row[c] ?? "").join("\t"))];
  return `${lines.join("\n")}\n`;
}
