// A head's notation as data (`@enumeratio/manifest`'s `NotationData`), compiled to the rules and
// LaTeX entries a package's notation entry gives. A template is boxes, in their JSON form or
// written in Epsil (`SubscriptBox("H", TemplateSlot("n"))`), with a `TemplateSlot` for each
// parameter: filled with that argument's boxes, or fenced as a base would be with `{ Tight: true }`.
//
//   { "params": ["s", "z"], "call": ["SubscriptBox", "Li", ["TemplateSlot", "s"]] }   Li_s(z)
//   { "params": ["n"], "box": ["SubscriptBox", "H", ["TemplateSlot", "n"]] }          H_n
//   { "trigger": "\\scaled", "kind": "function" }                                      \scaled(x)

import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";
import { type BoxTemplate, type NotationData, slotsOf } from "@enumeratio/manifest";
import { type Box, isBoxHead, isNode } from "./box.ts";
import type { NotationRule, PackageNotation, Writer } from "./notation.ts";
import { isList } from "./notation.ts";

/** What fills a slot: an operand, or a rest parameter's operands. */
type Filling = unknown;

interface SlotOptions {
  readonly Tight?: boolean;
  /** Between a rest parameter's operands, or a list's items; `,` by default. */
  readonly Separator?: string;
  /** Spread the operand, a literal `List`, as its items. */
  readonly Items?: boolean;
  readonly Open?: string;
  readonly Close?: string;
  /** What an empty list writes, in place of `Open` and `Close`. */
  readonly Empty?: string;
}

const isRest = (param: string): boolean => param.startsWith("...");
const nameOf = (param: string): string => param.replace(/^\.\.\./, "");

/**
 * A slot's boxes, as a run: one box for an operand, or the items of a rest parameter or of a
 * list `{ Items: true }` spreads, joined by `Separator`. A run inside a row is spliced into it.
 */
function slotRun(value: Filling, rest: boolean, options: SlotOptions, write: Writer): Box[] {
  const one = (x: unknown): Box =>
    options.Tight === true
      ? write.tight(x as Parameters<Writer["box"]>[0])
      : write.box(x as Parameters<Writer["box"]>[0]);
  const join = (items: readonly unknown[]): Box[] =>
    items.flatMap((x, i) => (i === 0 ? [one(x)] : [options.Separator ?? ",", one(x)]));
  if (rest) return join(value as readonly unknown[]);
  if (options.Items === true && isList(value as never)) {
    const items = (value as readonly unknown[]).slice(1);
    if (items.length === 0 && options.Empty !== undefined) return [options.Empty];
    return [
      ...(options.Open === undefined ? [] : [options.Open]),
      ...join(items),
      ...(options.Close === undefined ? [] : [options.Close]),
    ];
  }
  return [one(value)];
}

const isSlot = (box: unknown): box is readonly ["TemplateSlot", string, SlotOptions?] =>
  Array.isArray(box) && box[0] === "TemplateSlot" && typeof box[1] === "string";

/** `box` with each param's slot filled from `args`; `rests` are the rest parameters' names. */
function fill(box: Box, args: ReadonlyMap<string, Filling>, rests: ReadonlySet<string>, write: Writer): Box {
  if (!isNode(box)) return box;
  if (isSlot(box) && args.has(box[1])) {
    const run = slotRun(args.get(box[1]), rests.has(box[1]), box[2] ?? {}, write);
    return run.length === 1 ? run[0]! : (["RowBox", run] as unknown as Box);
  }
  // An argument is a box, a list of them (a row's items, a grid's rows), or the options. In a
  // list, a slot's run is spliced in, so `a × ...xs` writes one flat row.
  const each = (item: unknown): unknown => {
    if (!Array.isArray(item)) return item;
    if (isBoxHead(item[0])) return fill(item as unknown as Box, args, rests, write);
    return item.flatMap((x: unknown) =>
      isSlot(x) && args.has(x[1]) ? slotRun(args.get(x[1]), rests.has(x[1]), x[2] ?? {}, write) : [each(x)],
    );
  };
  return [box[0], ...box.slice(1).map(each)] as unknown as Box;
}

/** Whether `template` takes `n` operands: exactly its params, or at least them with a rest one. */
const takes = (template: BoxTemplate, n: number): boolean =>
  template.params.some(isRest) ? n >= template.params.length : n === template.params.length;

/** A template as `makeBoxes` consults it. */
function ruleOf(templates: readonly BoxTemplate[]): NotationRule {
  return (ops, write) => {
    const template = templates.find((t) => takes(t, ops.length));
    if (template === undefined || (template.scalars !== false && ops.some(isList))) return undefined;
    const rests = new Set(template.params.filter(isRest).map(nameOf));
    const args = new Map<string, Filling>(
      template.params.map((p, i) => [nameOf(p), isRest(p) ? ops.slice(i) : ops[i]]),
    );
    if (template.box !== undefined) return fill(template.box as Box, args, rests, write);
    if (template.call === undefined) return undefined;
    // Its arguments as given (a slot is its operand, a rest one spreads; anything else is
    // written as it is: `H_n(q)`), else the params the name doesn't use.
    const used = slotsOf(template.call);
    const callArgs =
      template.args?.flatMap((a) =>
        isSlot(a) && args.has(a[1]) ? (rests.has(a[1]) ? (args.get(a[1]) as unknown[]) : [args.get(a[1])]) : [a],
      ) ??
      template.params.flatMap((p) =>
        used.has(nameOf(p)) ? [] : isRest(p) ? (args.get(nameOf(p)) as unknown[]) : [args.get(p)],
      );
    return write.call(fill(template.call as Box, args, rests, write), callArgs as Parameters<Writer["call"]>[1]);
  };
}

/** `head`'s notation from data, as a package's notation entry would give it. */
export function compileNotation(
  head: string,
  data: NotationData,
): Required<Pick<PackageNotation, "traditional" | "latex">> {
  const latex: Partial<LatexDictionaryEntry>[] = (data.latex ?? []).map(({ trigger, kind, precedence }) => ({
    name: head,
    latexTrigger: trigger,
    ...(kind === undefined ? {} : { kind }),
    ...(precedence === undefined ? {} : { precedence }),
  })) as Partial<LatexDictionaryEntry>[];
  const traditional = data.traditional?.length ? { [head]: ruleOf(data.traditional) } : {};
  return { traditional, latex };
}
