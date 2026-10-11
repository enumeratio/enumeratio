// `StringTemplate` as a `makeBoxes` rule: Wolfram's template, with Epsil holes, written as `TextData`
// whose holes are boxes the environment fills (a variable's control, a readout, a setter link).
// The head rides on a `TagBox`, so it reads back.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type Box, button, form, row, slot, tag, templateExpression, text, textData } from "./box.ts";
import { stringOf } from "./notation-layout.ts";
import type { Notation, NotationRule } from "./notation.ts";
import { parseProse, type ProsePart } from "./template.ts";

type Json = MathJsonExpression;

/** A hole that is a variable by name: `{_d}`, the control its declaration picks. */
const VARIABLE = /^_([A-Za-z]\w*)$/;

/** A setter hole, Wolfram's `Setter(_e, value, "label")`: a link that sets the variable to the value. */
const SETTER = /^Setter\(\s*_([A-Za-z]\w*)\s*,\s*(.+?)\s*,\s*"([^"]*)"\s*\)$/s;

/** `{InputField(Variables)}`: the scope's variables as one editable, copyable sentence. */
const SETTINGS = /^InputField\(\s*Variables\s*\)$/;

/** A variable standing alone in TeX (`\sqrt{_d}`), with nothing before it to subscript. */
const TEX_VARIABLE = /(^|[\s{([,=+\-*/^|])_(?:\{([A-Za-z]\w*)\}|([A-Za-z]))/g;

/** A `$…$` island: held TeX, a row of fragments around a hole for each variable it names. */
function island(latex: string): Box {
  const parts: Box[] = [];
  let from = 0;
  for (const m of latex.matchAll(TEX_VARIABLE)) {
    const name = (m[2] ?? m[3])!;
    parts.push(latex.slice(from, m.index + m[1]!.length), slot(name));
    from = m.index + m[0].length;
  }
  if (parts.length === 0) return form(latex, "TeXForm");
  parts.push(latex.slice(from));
  return form(row(parts.filter((p) => p !== "")), "TeXForm");
}

function holeOf(part: Extract<ProsePart, { kind: "knob" | "dynamic" }>): Box {
  if (part.kind === "knob") return slot(part.name.slice(1), part.options);
  const source = part.value.trim();
  if (SETTINGS.test(source)) return slot("Variables");
  const setter = SETTER.exec(source);
  if (setter) return button(text(setter[3]!), { ButtonFunction: `Set(_${setter[1]}, ${setter[2]})` });
  return templateExpression(source, part.options);
}

const itemOf = (part: ProsePart): Box =>
  part.kind === "text" ? part.text : part.kind === "tex" ? island(part.latex) : holeOf(part);

const StringTemplate: NotationRule = (args) => {
  const template = stringOf(args[0] as Json);
  if (template === undefined || args.length !== 1) return undefined;
  const parts = parseProse(template, { has: (name) => VARIABLE.test(name) });
  return tag(textData(parts.map(itemOf)), "StringTemplate");
};

/** The prose formatters' rules: add them to what `makeBoxes` writes with. */
export const PROSE_NOTATION: Notation = { StringTemplate };

/** The heads `PROSE_NOTATION` writes. */
export const PROSE_HEADS: ReadonlySet<string> = new Set(Object.keys(PROSE_NOTATION));
