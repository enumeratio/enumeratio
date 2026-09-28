// How we write each reference example, as data (design/examples-as-data.md §2): the rows of
// its implementations record that no kernel is needed for. Our own forms -- `epsil`, the
// InputForm you can retype; `tex`, our TeX serialisation; `traditional`, the TraditionalForm
// TeX where it differs; `fullform`, the Wolfram FullForm @enumeratio/wolfram writes, with
// `back` wherever it doesn't read back as the example -- and, for every other system, the `in`
// the oracle scan sends it.
//
// scripts/collect-forms.ts writes these into the records (`UPDATE_FORMS=1`), and
// tests/forms.test.ts fails when a printer or transpiler no longer produces what's pinned.

import { ComputeEngine, LatexSyntax } from "@cortex-js/compute-engine";
import type { ExampleImplementations, HeadImplementations, MathJSON, SystemImplementation } from "@enumeratio/entry";
import { toInputForm } from "@enumeratio/formats/inputform";
import { parseExpression } from "@enumeratio/formats/expression";
import { portableTeX } from "@enumeratio/formats/tex";
import { emit, SYSTEMS, type System } from "@enumeratio/oracle/src";
import { fromWolfram, toWolfram } from "@enumeratio/wolfram";
import { conventionalLatexDictionary } from "../src/conventional-latex.ts";
import { traditionalLatexOf } from "../src/traditional.ts";

const ce = new ComputeEngine({
  latexSyntax: new LatexSyntax({ dictionary: conventionalLatexDictionary() as never[] }),
});

const attempt = (f: () => string): string | undefined => {
  try {
    return f();
  } catch {
    return undefined;
  }
};

const box = (json: MathJSON) => ce.box(json as never, { form: "raw" });

/**
 * `json` with each complex literal InputForm spells out -- `2.5 + 3i`, `1 - i`, `3i`, `-i` --
 * put back as the `Complex` number it came from: the same value, and the spelling a person
 * types. Only those shapes: a bare `i` may be a bound variable (`Product(i ^ 2, (i, 1, 6))`).
 */
function complexLiterals(json: unknown): unknown {
  if (!Array.isArray(json)) return json;
  const node = json.map(complexLiterals);
  const imaginary = (n: unknown): number | undefined => {
    if (n === "i") return 1;
    if (Array.isArray(n) && n[0] === "Complex" && n[1] === 0) return n[2];
    if (Array.isArray(n) && n[0] === "Multiply" && n.length === 3 && typeof n[1] === "number" && n[2] === "i")
      return n[1];
    return undefined;
  };
  const [head, a, b] = node;
  if (head === "Negate" && node.length === 2 && imaginary(a) !== undefined) return ["Complex", 0, -imaginary(a)!];
  if (head === "Multiply" && imaginary(node) !== undefined) return ["Complex", 0, imaginary(node)];
  if (
    (head === "Add" || head === "Subtract") &&
    node.length === 3 &&
    typeof a === "number" &&
    imaginary(b) !== undefined
  )
    return ["Complex", a, (head === "Subtract" ? -1 : 1) * imaginary(b)!];
  return node;
}

/**
 * What InputForm `printed` reads back as through Epsil, as a notebook cell reads it, where
 * that is not `expr` -- the same canonical expression, not merely the same value (a complex
 * literal aside). Absent when the trip is exact; `Unreadable` when the cell would refuse it.
 */
function inputFormBack(expr: MathJSON, printed: string): MathJSON | undefined {
  const { json, errors } = parseExpression(printed, { allow: ["Assign"] });
  if (errors.length > 0) return "Unreadable";
  const reread = attempt(() => JSON.stringify(ce.box(complexLiterals(box(json as MathJSON).json) as never).json));
  if (reread === attempt(() => JSON.stringify(ce.box(expr as never).json))) return undefined;
  return reread === undefined ? "Unreadable" : (box(json as MathJSON).json as MathJSON);
}

/** Our own forms of one example, and each system's `in`, in the order a record lists them. */
export function formsOf(expr: MathJSON, expected: MathJSON): ExampleImplementations {
  const out: Record<string, SystemImplementation> = {};
  const epsil = [attempt(() => toInputForm(expr as never)), attempt(() => toInputForm(expected as never))];
  if (epsil[0] !== undefined) {
    const back = inputFormBack(expr, epsil[0]);
    out.epsil = {
      in: epsil[0],
      ...(epsil[1] === undefined ? {} : { out: epsil[1] }),
      ...(back === undefined ? {} : { back }),
    };
  }
  const tex = [attempt(() => portableTeX(box(expr).latex)), attempt(() => portableTeX(box(expected).latex))];
  if (tex[0] !== undefined) out.tex = { in: tex[0], ...(tex[1] === undefined ? {} : { out: tex[1] }) };
  const traditional = [
    attempt(() => portableTeX(traditionalLatexOf(ce, box(expr)))),
    attempt(() => portableTeX(traditionalLatexOf(ce, box(expected)))),
  ];
  if (traditional[0] !== undefined && (traditional[0] !== tex[0] || traditional[1] !== tex[1]))
    out.traditional = { in: traditional[0], ...(traditional[1] === undefined ? {} : { out: traditional[1] }) };
  // FullForm, as @enumeratio/wolfram writes it, and what it reads back as where the trip loses
  // something: the converter pair's round trip, over every example.
  const full = attempt(() => toWolfram(expr as never));
  if (full !== undefined) {
    // A float too big for a double reads back as Infinity, which JSON can't hold.
    const read = attempt(() =>
      JSON.stringify(fromWolfram(full), (_k, v: unknown) =>
        typeof v === "number" && !Number.isFinite(v) ? { num: String(v) } : v,
      ),
    );
    const back = read === JSON.stringify(expr) ? undefined : read === undefined ? "Unreadable" : JSON.parse(read);
    out.fullform = { in: full, ...(back === undefined ? {} : { back: back as MathJSON }) };
  }
  // What the oracle scan sends each system: `emit` adds the mappings and the comparison
  // shapes (an equality as `a == b`) the scan compares by.
  for (const { name } of SYSTEMS) {
    const emitted = emit(expr, name as System);
    if (emitted.ok) out[name] = { in: emitted.source };
  }
  return out;
}

/** The fields of a row `formsOf` owns: an own form's whole row, and a system's `in`. */
export const OWN_FORMS = ["epsil", "tex", "traditional", "fullform"] as const;

/** `record`'s rows for one example with the forms replaced and a kernel's answers kept. */
export function withForms(
  rows: ExampleImplementations | undefined,
  forms: ExampleImplementations,
): ExampleImplementations {
  const next: Record<string, SystemImplementation> = {};
  for (const [key, row] of Object.entries(forms)) {
    if ((OWN_FORMS as readonly string[]).includes(key)) next[key] = row;
    else {
      const { in: _in, back: _back, ...kept } = rows?.[key] ?? {};
      next[key] = { ...row, ...kept };
    }
  }
  // Rows the forms don't cover: a system that no longer emits keeps only what a kernel or a
  // person wrote (a transpiled `in` without an answer goes with the mapping).
  for (const [key, row] of Object.entries(rows ?? {})) {
    if (key in next || (OWN_FORMS as readonly string[]).includes(key)) continue;
    const { back: _back, ...kept } = row;
    if (kept.out !== undefined || kept.note !== undefined) next[key] = kept;
  }
  return next;
}

/** A head's record as the forms make it, from the record it has. */
export function recordWithForms(
  examples: readonly { id: string; expr: unknown; expected: unknown }[],
  record: HeadImplementations | undefined,
): HeadImplementations {
  const next: Record<string, ExampleImplementations> = {};
  for (const example of examples)
    next[example.id] = withForms(record?.[example.id], formsOf(example.expr as never, example.expected as never));
  // Rows for an example that's gone: what the forms wrote goes; a kernel's answer or a note
  // stays for the scan (or a person) to deal with.
  for (const [id, rows] of Object.entries(record ?? {})) {
    if (id in next) continue;
    const kept = Object.fromEntries(
      Object.entries(rows).filter(
        ([key, row]) => !(OWN_FORMS as readonly string[]).includes(key) && (row.out !== undefined || row.note),
      ),
    );
    if (Object.keys(kept).length > 0) next[id] = kept;
  }
  return next;
}
