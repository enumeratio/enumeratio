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

/** `box` with each param's slot filled from `args`. */
function fill(box: Box, args: ReadonlyMap<string, unknown>, write: Writer): Box {
  if (!isNode(box)) return box;
  if (box[0] === "TemplateSlot" && args.has(box[1])) {
    const arg = args.get(box[1]) as Parameters<Writer["box"]>[0];
    return (box[2] as { Tight?: unknown } | undefined)?.Tight === true ? write.tight(arg) : write.box(arg);
  }
  // An argument is a box, a list of them (a row's items, a grid's rows), or the options.
  const each = (item: unknown): unknown =>
    !Array.isArray(item) ? item : isBoxHead(item[0]) ? fill(item as unknown as Box, args, write) : item.map(each);
  return [box[0], ...box.slice(1).map(each)] as unknown as Box;
}

/** A template as `makeBoxes` consults it. */
function ruleOf(templates: readonly BoxTemplate[]): NotationRule {
  return (ops, write) => {
    const template = templates.find((t) => t.params.length === ops.length);
    if (template === undefined || (template.scalars !== false && ops.some(isList))) return undefined;
    const args = new Map(template.params.map((p, i) => [p, ops[i]]));
    if (template.box !== undefined) return fill(template.box as Box, args, write);
    if (template.call === undefined) return undefined;
    const used = slotsOf(template.call);
    return write.call(
      fill(template.call as Box, args, write),
      template.params.flatMap((p, i) => (used.has(p) ? [] : [ops[i]!])),
    );
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
