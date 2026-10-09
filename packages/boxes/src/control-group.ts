// The bar controls as Wolfram lowers them, and read back as the one control each is. Wolfram boxes
// a `SetterBar` as a `GridBox` row of single-entry `SetterBox`es, a `TogglerBar` as the same over
// `Dynamic[MemberQ[x, a]]` (the entry toggles in and out of the list `x`), and a `RadioButtonBar` as
// a row of `RadioButtonBox`es, each with its label. A reader of the controls (the keyboard driver,
// `reduce`, the terminal drawer, the web) wants one control per variable, so `barOf` groups the
// boxes of a row by their shared binding.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type Box, dynamic, grid, isControlBoxHead, isNode, type Options, optionsOfBox, row } from "./box.ts";
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

/** The variable a binding (`Dynamic(x)`, or a toggle's `Dynamic(MemberQ(x, a))`) names, as written. */
export function bindingVariable(binding: Box): Json | undefined {
  if (!Array.isArray(binding) || binding[0] !== "DynamicBox") return undefined;
  const expr = binding[1] as Json;
  return memberOf(expr)?.variable ?? expr;
}

/** A toggle's binding: `entry` is in the list `variable` holds. */
export const toggleBinding = (variable: Json, entry: Json): Box =>
  dynamic(["MemberQ", variable, entryValue(entry)] as unknown as Json);

/** Whether a binding is a toggle's. */
export const isToggleBinding = (binding: Box): boolean =>
  Array.isArray(binding) && binding[0] === "DynamicBox" && memberOf(binding[1] as Json) !== undefined;

interface Cell {
  readonly head: BarCellHead;
  readonly toggles: boolean;
  readonly variable: Json;
  readonly entry: Json;
  readonly options: Options;
}

/** A single-entry box, read: its variable, its one entry and whether it toggles. */
function cellOf(box: Box): Cell | undefined {
  if (!isNode(box) || (box[0] !== "SetterBox" && box[0] !== "RadioButtonBox")) return undefined;
  const variable = bindingVariable(box[1]);
  const entries = entriesOf(box[2] as Json);
  if (variable === undefined || entries?.length !== 1) return undefined;
  const toggles = isToggleBinding(box[1]);
  if (toggles && box[0] !== "SetterBox") return undefined;
  return { head: box[0], toggles, variable, entry: entries[0]!, options: optionsOfBox(box) };
}

/** A bar's box in a row: a `SetterBox`, or a `RadioButtonBox` beside its label. */
function inRow(box: Box): Box {
  return isNode(box) &&
    box[0] === "RowBox" &&
    box[1].length === 2 &&
    isNode(box[1][0]) &&
    box[1][0][0] === "RadioButtonBox"
    ? box[1][0]
    : box;
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

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
  const cells = box[1][0]!.map((b) => cellOf(inRow(b)));
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
 * radio button beside its label (`label` boxes an entry's label).
 */
export function lowerBar(
  kind: BarKind,
  variable: Json,
  entries: readonly Json[],
  options: Options,
  label: (entry: Json) => Box,
): Box {
  const cells = entries.map((entry): Box => {
    const domain = ["List", entry] as unknown as Json;
    const binding = kind === "TogglerBar" ? toggleBinding(variable, entry) : dynamic(variable);
    const withOptions = Object.keys(options).length === 0 ? [] : [options];
    if (kind === "RadioButtonBar") {
      return row([["RadioButtonBox", binding, domain, ...withOptions] as unknown as Box, label(entryLabel(entry))]);
    }
    return ["SetterBox", binding, domain, ...withOptions] as unknown as Box;
  });
  return grid([cells]);
}
