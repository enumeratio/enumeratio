// The layout formatters as `makeBoxes` rules, as in Wolfram: `Row` is a `RowBox`; `Column`, `Grid`
// and `Labeled` a `GridBox`; `Panel` a `PanelBox`. The first three carry the head as a `TagBox`, so
// the head reads back and an environment can give each its own look.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type Box, grid, type Options, type OptionValue, panel, row, style, tag, text } from "./box.ts";
import type { Notation, NotationRule, Writer } from "./notation.ts";

type Json = MathJsonExpression;

const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

const opsOf = (node: unknown): Json[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? (fn.slice(1) as Json[]) : [];
};

const stringOf = (node: unknown): string | undefined => {
  if (typeof node === "string") return /^'.*'$/s.test(node) ? node.slice(1, -1) : undefined;
  const s = (node as { str?: unknown })?.str;
  return typeof s === "string" ? s : undefined;
};

/** A symbol's name, or a number's digits: what an atom reads as in running text. */
const atomText = (node: unknown): string | undefined => {
  if (typeof node === "number") return String(node);
  if (typeof node === "string") return stringOf(node) ?? node;
  const o = node as { sym?: unknown; num?: unknown; str?: unknown };
  return typeof o?.sym === "string" ? o.sym : o?.num !== undefined ? String(o.num as string | number) : stringOf(node);
};

/** The entries of a literal list or tuple, or undefined for anything else. */
const listOf = (node: Json | undefined): Json[] | undefined => {
  const head = headOf(node);
  return head === "List" || head === "Tuple" ? opsOf(node) : undefined;
};

/** `Name -> value`, however the parse spells a rule: a `KeyValuePair` or a `Tuple` keyed by a capitalized name. */
const ruleOf = (node: Json): [string, Json] | undefined => {
  const head = headOf(node);
  const [key, value, ...rest] = opsOf(node);
  if ((head !== "KeyValuePair" && head !== "Rule" && head !== "Tuple") || value === undefined || rest.length > 0) {
    return undefined;
  }
  const name = atomText(key);
  return name !== undefined && /^[A-Z]/.test(name) ? [name, value] : undefined;
};

/** The positional arguments, and the trailing rules as options (the leftmost setting of a name wins). */
function split(args: readonly Json[]): { ops: Json[]; options: Record<string, Json> } {
  let end = args.length;
  while (end > 0 && ruleOf(args[end - 1]!) !== undefined) end--;
  const options: Record<string, Json> = {};
  for (const arg of args.slice(end)) {
    const [name, value] = ruleOf(arg)!;
    if (!(name in options)) options[name] = value;
  }
  return { ops: args.slice(0, end) as Json[], options };
}

/** A rule's value as an option: a name, a string, a number, or a list of them. */
function optionOf(json: Json): OptionValue | undefined {
  const items = listOf(json);
  if (items !== undefined) {
    const values = items.map(optionOf);
    return values.every((v) => v !== undefined) ? (values as OptionValue[]) : undefined;
  }
  if (typeof json === "number") return json;
  const n = (json as { num?: unknown })?.num;
  if (n !== undefined) return Number(n);
  const atom = atomText(json);
  if (atom === "True" || atom === "False") return atom === "True";
  return atom;
}

/** The rules named `names`, as options under the box's own names. */
function boxOptions(options: Readonly<Record<string, Json>>, names: Readonly<Record<string, string>>): Options {
  const out: Record<string, OptionValue> = {};
  for (const [from, to] of Object.entries(names)) {
    const value = options[from] === undefined ? undefined : optionOf(options[from]);
    if (value !== undefined) out[to] = value;
  }
  return out;
}

/** What an entry of a layout is: a string is text (not math, so no quotes), anything else as the writer has it. */
const cell = (write: Writer, node: Json): Box => {
  const s = stringOf(node);
  return s === undefined ? write.box(node) : text(s);
};

/** A layout's entries: `Row([a, b])`'s list, or the single argument, or the arguments themselves. */
const entriesOf = (ops: readonly Json[]): Json[] =>
  ops.length === 1 ? (listOf(ops[0]) ?? [ops[0]!]) : ops.length === 0 ? [] : [...ops];

const interleave = (items: readonly Box[], between: Box): Box[] =>
  items.flatMap((item, i) => (i === 0 ? [item] : [between, item]));

const Row: NotationRule = (args, write) => {
  const { ops } = split(args);
  // `Row({a, b}, sep)`: a separator between the entries.
  const separated = ops.length === 2 && listOf(ops[0]) !== undefined && listOf(ops[1]) === undefined;
  const boxes = (separated ? listOf(ops[0])! : entriesOf(ops)).map((item) => cell(write, item));
  return tag(row(separated ? interleave(boxes, cell(write, ops[1]!)) : boxes), "Row");
};

const Column: NotationRule = (args, write) =>
  tag(grid(entriesOf(split(args).ops).map((item) => [cell(write, item)])), "Column");

const GRID_OPTIONS = {
  Alignment: "ColumnAlignments",
  Spacings: "ColumnSpacings",
  Frame: "GridBoxFrame",
  Dividers: "GridBoxDividers",
} as const;

/** `Alignment -> Left` or `{Left, Top}`: the horizontal part, one per column when it is a list of lists. */
const alignments = (value: OptionValue | undefined): OptionValue | undefined =>
  Array.isArray(value) ? value[0] : value;

const Grid: NotationRule = (args, write) => {
  const { ops, options } = split(args);
  const rows = (listOf(ops[0]) ?? []).map((r) => listOf(r) ?? [r]);
  const width = Math.max(1, ...rows.map((r) => r.length));
  // A short row is padded, so every row has a cell for every column.
  const cells = rows.map((r) => [
    ...r.map((c) => cell(write, c)),
    ...Array.from({ length: width - r.length }, () => text("")),
  ]);
  const set = boxOptions(options, GRID_OPTIONS);
  const aligned = alignments(set.ColumnAlignments);
  const spacing = set.ColumnSpacings;
  const rules = set.GridBoxDividers === true || set.GridBoxDividers === "All" || set.GridBoxDividers === "Center";
  const { ColumnAlignments: _a, ColumnSpacings: _s, GridBoxDividers: _d, ...rest } = set;
  return tag(
    grid(cells, {
      ...rest,
      ...(aligned !== undefined && { ColumnAlignments: aligned }),
      ...(spacing !== undefined && { ColumnSpacings: Array.isArray(spacing) ? spacing[0]! : spacing }),
      ...(Array.isArray(spacing) && spacing[1] !== undefined && { RowSpacings: spacing[1] }),
      ...(rules && { GridBoxDividers: "All" }),
    }),
    "Grid",
  );
};

const Panel: NotationRule = (args, write) => {
  const { ops, options } = split(args);
  const items = entriesOf(ops).map((item) => cell(write, item));
  return panel(
    items.length === 1 ? items[0]! : row(items),
    boxOptions(options, { Background: "Background", FrameMargins: "FrameMargins", ImageSize: "ImageSize" }),
  );
};

/** Where `Labeled`'s label goes, as the grid's shape: beside the body or stacked with it. */
const LABEL_AT: Readonly<Record<string, "above" | "below" | "before" | "after">> = {
  Top: "above",
  Bottom: "below",
  Left: "before",
  Right: "after",
};

const Labeled: NotationRule = (args, write) => {
  const { ops } = split(args);
  const [body, label, where] = ops;
  if (body === undefined) return undefined;
  const bodyBox = cell(write, body);
  // A label that is text (or an atom) is the caption; one that is an expression is drawn like the body.
  const caption =
    label === undefined
      ? undefined
      : headOf(label) === undefined || stringOf(label) !== undefined
        ? style(text(atomText(label) ?? ""), { BaseStyle: "Label" })
        : cell(write, label);
  const position = LABEL_AT[atomText(where) ?? ""] ?? "after";
  const rows: Box[][] =
    caption === undefined
      ? [[bodyBox]]
      : position === "after"
        ? [[bodyBox, caption]]
        : position === "before"
          ? [[caption, bodyBox]]
          : position === "below"
            ? [[bodyBox], [caption]]
            : [[caption], [bodyBox]];
  return tag(grid(rows), "Labeled");
};

/** The layout formatters' rules: add them to what `makeBoxes` writes with. */
export const LAYOUT_NOTATION: Notation = { Row, Column, Grid, Panel, Labeled };

/** The options the rules above consume; any other a layout is given is left for its host. */
export const LAYOUT_OPTIONS: ReadonlySet<string> = new Set([
  ...Object.keys(GRID_OPTIONS),
  "Background",
  "FrameMargins",
  "ImageSize",
]);

/** The heads `LAYOUT_NOTATION` writes. */
export const LAYOUT_HEADS: ReadonlySet<string> = new Set(Object.keys(LAYOUT_NOTATION));
