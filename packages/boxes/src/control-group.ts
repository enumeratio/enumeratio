// The bar controls as Wolfram lowers them, and read back as the one control each is. Wolfram boxes
// a `SetterBar` as a `GridBox` row of single-entry `SetterBox`es (`SetterBox[Dynamic[x], {a}, label]`),
// a `TogglerBar` as the same over `Dynamic[MemberQ[x, a]]` and `{True}` (the entry toggles in and out
// of the list `x`), and a `RadioButtonBar` as a row of `RadioButtonBox`es, each beside its label. A
// reader of the controls (the keyboard driver, `reduce`, the terminal drawer, the web) wants one
// control per variable, so `barOf` groups the boxes of a row by their shared binding.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  type Box,
  binding as bindingOf,
  control,
  grid,
  isControlBoxHead,
  isNode,
  type Options,
  optionsOfBox,
  row,
} from "./box.ts";
import { headOf, opsOf } from "./notation-layout.ts";

type Json = MathJsonExpression;

/** The bars: one control over several entries, lowered to a row of single-entry boxes. */
export const BAR_KINDS = ["SetterBar", "TogglerBar", "RadioButtonBar"] as const;
export type BarKind = (typeof BAR_KINDS)[number];

/** The single-entry box a bar is made of. */
export type BarCellHead = "SetterBox" | "RadioButtonBox";

/** A bar read back: its variable, its entries and the options its boxes share. */
export interface Bar {
  readonly kind: BarKind;
  readonly head: BarCellHead;
  /** The variable as the binding wrote it, `x` or `(x, start)`. */
  readonly variable: Json;
  readonly entries: readonly Json[];
  readonly options: Options;
}

/** The entries a domain lists, when it is a list written out. */
export function entriesOf(domain: Json): Json[] | undefined {
  const head = headOf(domain);
  if (head === "List" || head === "Tuple") return opsOf(domain);
  if (head === "Delimiter") {
    const inner = opsOf(domain)[0];
    return headOf(inner) === "Sequence" ? opsOf(inner) : inner === undefined ? undefined : [inner];
  }
  return undefined;
}

/** An entry's value: `Labeled(v, "label")` binds `v`. */
export const entryValue = (entry: Json): Json => (headOf(entry) === "Labeled" ? (opsOf(entry)[0] ?? entry) : entry);

/** An entry's label: `Labeled(v, "label")` shows the label, anything else shows itself. */
export const entryLabel = (entry: Json): Json => (headOf(entry) === "Labeled" ? (opsOf(entry)[1] ?? entry) : entry);

/** `MemberQ(x, a)` as the pieces a toggle binds: the variable and the entry it toggles. */
function memberOf(expr: Json): { variable: Json; entry: Json } | undefined {
  const [variable, entry, ...rest] = opsOf(expr);
  return headOf(expr) === "MemberQ" && variable !== undefined && entry !== undefined && rest.length === 0
    ? { variable, entry }
    : undefined;
}

/** `Dynamic(x)`, or the `DynamicBox(x)` a record written before bindings were expressions holds. */
const isBindingHead = (head: string | undefined): boolean => head === "Dynamic" || head === "DynamicBox";

/** The variable a binding (`Dynamic(x)`, or a toggle's `Dynamic(MemberQ(x, a))`) names, as written. */
export function bindingVariable(binding: Json): Json | undefined {
  if (!isBindingHead(headOf(binding))) return undefined;
  const expr = opsOf(binding)[0];
  return expr === undefined ? undefined : (memberOf(expr)?.variable ?? expr);
}

/** A toggle's binding: `entry` is in the list `variable` holds. */
export const toggleBinding = (variable: Json, entry: Json): Json =>
  bindingOf(["MemberQ", variable, entryValue(entry)] as unknown as Json);

/** Whether a binding is a toggle's. */
export const isToggleBinding = (binding: Json): boolean => {
  const expr = isBindingHead(headOf(binding)) ? opsOf(binding)[0] : undefined;
  return expr !== undefined && memberOf(expr) !== undefined;
};

/** What a text entry shows: a symbol, a number or a string as it reads. */
export function displayText(entry: Json): string | undefined {
  if (typeof entry === "number") return String(entry);
  if (typeof entry === "string") return /^'.*'$/s.test(entry) ? entry.slice(1, -1) : entry;
  const { str, num, sym } = entry as { str?: unknown; num?: unknown; sym?: unknown };
  return typeof str === "string" ? str : typeof num === "string" ? num : typeof sym === "string" ? sym : undefined;
}

/** A box as the text it shows, if it is only text. */
export function plainText(box: Box): string | undefined {
  if (typeof box === "string") return box;
  if (box[0] === "TextBox") return box[1];
  if (box[0] === "RowBox") {
    const parts = box[1].map(plainText);
    return parts.every((p) => p !== undefined) ? parts.join("") : undefined;
  }
  return box[0] === "TagBox" || box[0] === "StyleBox" ? plainText(box[1]) : undefined;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** An entry's label as a string where it reads as text, else as written. */
const entryLabelJson = (entry: Json): Json => {
  const label = entryLabel(entry);
  const text = displayText(label);
  return text === undefined ? label : ({ str: text } as Json);
};

/** A `value -> label` rule, as Wolfram lists a menu's, a picker's and a toggler's entries. */
export const entryRule = (entry: Json): Json => ["Rule", entryValue(entry), entryLabelJson(entry)] as unknown as Json;

/** An entry rebuilt from a value and the label shown for it: the value alone when the label is its own text. */
export function entryOfLabeled(value: Json, label: Json | string): Json {
  const text = typeof label === "string" ? label : displayText(label);
  const own = displayText(value);
  if (own !== undefined ? text === own : sameJson(value, label)) return value;
  return ["Labeled", value, typeof label === "string" ? { str: label } : label] as unknown as Json;
}

/** A rule list read back as entries: `value -> label` is `Labeled(value, label)` unless the label is the value. */
export function entriesOfRules(domain: Json): Json | undefined {
  if (headOf(domain) !== "List") return undefined;
  const entries = opsOf(domain).map((rule) => {
    const [value, label] = opsOf(rule);
    return (headOf(rule) === "Rule" || headOf(rule) === "KeyValuePair" || headOf(rule) === "Tuple") &&
      value !== undefined &&
      label !== undefined
      ? entryOfLabeled(value, label)
      : undefined;
  });
  return entries.every((e) => e !== undefined) ? (["List", ...entries] as unknown as Json) : undefined;
}

interface Cell {
  readonly head: BarCellHead;
  readonly toggles: boolean;
  readonly variable: Json;
  readonly entry: Json;
  readonly options: Options;
}

/** A single-entry box, read: its variable, its one entry (with the label shown for it) and whether it toggles. */
function cellOf(box: Box, beside?: Box): Cell | undefined {
  if (!isNode(box) || (box[0] !== "SetterBox" && box[0] !== "RadioButtonBox")) return undefined;
  const variable = bindingVariable(box[1] as Json);
  const values = entriesOf(box[2] as Json);
  if (variable === undefined || values?.length !== 1) return undefined;
  const toggles = isToggleBinding(box[1] as Json);
  if (toggles && box[0] !== "SetterBox") return undefined;
  const value = toggles ? memberOf(opsOf(box[1] as Json)[0]!)!.entry : values[0]!;
  const shown = box[0] === "SetterBox" ? (box[3] as Box) : beside;
  const label = shown === undefined ? undefined : plainText(shown);
  return {
    head: box[0],
    toggles,
    variable,
    entry: label === undefined ? value : entryOfLabeled(value, label),
    options: optionsOfBox(box),
  };
}

/** A bar's box in a row: a `SetterBox`, or a `RadioButtonBox` beside its label. */
function inRow(box: Box): { box: Box; label?: Box } {
  return isNode(box) &&
    box[0] === "RowBox" &&
    box[1].length === 2 &&
    isNode(box[1][0]) &&
    box[1][0][0] === "RadioButtonBox"
    ? { box: box[1][0], label: box[1][1]! }
    : { box };
}

const kindOf = (cell: Cell): BarKind =>
  cell.head === "RadioButtonBox" ? "RadioButtonBar" : cell.toggles ? "TogglerBar" : "SetterBar";

/**
 * The bar a box is: a row of single-entry boxes that share one binding (and options), or a lone
 * `SetterBox` over `MemberQ`, a toggler bar of one. A lone setter or radio button is no bar.
 */
export function barOf(box: Box): Bar | undefined {
  if (!isNode(box)) return undefined;
  if (box[0] === "SetterBox") {
    const only = cellOf(box);
    return only?.toggles === true ? { kind: "TogglerBar", ...barPart(only), entries: [only.entry] } : undefined;
  }
  if (box[0] !== "GridBox" || box[1].length !== 1 || box[1][0]!.length === 0) return undefined;
  const cells = box[1][0]!.map((b) => {
    const { box: inner, label } = inRow(b);
    return cellOf(inner, label);
  });
  const first = cells[0];
  if (first === undefined) return undefined;
  const alike = cells.every(
    (c) =>
      c !== undefined &&
      c.head === first.head &&
      c.toggles === first.toggles &&
      sameJson(c.variable, first.variable) &&
      sameJson(c.options, first.options),
  );
  if (!alike) return undefined;
  return { kind: kindOf(first), ...barPart(first), entries: (cells as Cell[]).map((c) => c.entry) };
}

const barPart = (cell: Cell): Pick<Bar, "head" | "variable" | "options"> => ({
  head: cell.head,
  variable: cell.variable,
  options: cell.options,
});

/** Whether a box is a control the environment draws and the reader moves: a control box, or a bar of them. */
export const isControlLeaf = (box: Box): boolean =>
  isNode(box) && (isControlBoxHead(box[0]) || barOf(box) !== undefined);

/**
 * A bar lowered as Wolfram does: the row of single-entry boxes. A `RadioButtonBar` puts each
 * radio button beside its label, a `SetterBar` shows it in the setter (`label` boxes an entry's label).
 */
export function lowerBar(
  kind: BarKind,
  variable: Json,
  entries: readonly Json[],
  options: Options,
  label: (entry: Json) => Box,
): Box {
  const cells = entries.map((entry): Box => {
    const domain = ["List", kind === "TogglerBar" ? "True" : entryValue(entry)] as unknown as Json;
    const bound = kind === "TogglerBar" ? toggleBinding(variable, entry) : bindingOf(variable);
    const withOptions = Object.keys(options).length === 0 ? undefined : options;
    const shown = label(entryLabel(entry));
    return kind === "RadioButtonBar"
      ? row([control("RadioButtonBox", bound, domain, withOptions), shown])
      : control("SetterBox", bound, domain, withOptions, shown);
  });
  return grid([cells]);
}
