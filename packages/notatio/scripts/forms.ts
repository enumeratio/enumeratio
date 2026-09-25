// How we write each reference example, as data (design/examples-as-data.md §2): the rows of
// its implementations record that no kernel is needed for. Our own forms -- `epsil`, the
// InputForm you can retype; `tex`, our TeX serialisation; `traditional`, the TraditionalForm
// TeX where it differs -- and, for every other system, the `in` our transpiler emits. For
// Wolfram, `back` records what that `in` reads back as, where the trip loses something.
//
// scripts/collect-forms.ts writes these into the records (`UPDATE_FORMS=1`), and
// tests/forms.test.ts fails when a printer or transpiler no longer produces what's pinned.

import { ComputeEngine, LatexSyntax } from "@cortex-js/compute-engine";
import type { ExampleImplementations, HeadImplementations, MathJSON, SystemImplementation } from "@enumeratio/entry";
import { toInputForm } from "@enumeratio/formats/inputform";
import { portableTeX } from "@enumeratio/formats/tex";
import { emit, SYSTEMS, type System } from "@enumeratio/oracle/src";
import { fromWolfram } from "@enumeratio/wolfram";
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

/** Our own forms of one example, and each system's `in`, in the order a record lists them. */
export function formsOf(expr: MathJSON, expected: MathJSON): ExampleImplementations {
  const out: Record<string, SystemImplementation> = {};
  const epsil = [attempt(() => toInputForm(expr as never)), attempt(() => toInputForm(expected as never))];
  if (epsil[0] !== undefined) out.epsil = { in: epsil[0], ...(epsil[1] === undefined ? {} : { out: epsil[1] }) };
  const tex = [attempt(() => portableTeX(box(expr).latex)), attempt(() => portableTeX(box(expected).latex))];
  if (tex[0] !== undefined) out.tex = { in: tex[0], ...(tex[1] === undefined ? {} : { out: tex[1] }) };
  const traditional = [
    attempt(() => portableTeX(traditionalLatexOf(ce, box(expr)))),
    attempt(() => portableTeX(traditionalLatexOf(ce, box(expected)))),
  ];
  if (traditional[0] !== undefined && (traditional[0] !== tex[0] || traditional[1] !== tex[1]))
    out.traditional = { in: traditional[0], ...(traditional[1] === undefined ? {} : { out: traditional[1] }) };
  for (const { name } of SYSTEMS) {
    const emitted = emit(expr, name as System);
    if (!emitted.ok) continue;
    let back: MathJSON | undefined;
    if (name === "wolfram") {
      // A float too big for a double reads back as Infinity, which JSON can't hold.
      const read = attempt(() =>
        JSON.stringify(fromWolfram(emitted.source), (_k, v: unknown) =>
          typeof v === "number" && !Number.isFinite(v) ? { num: String(v) } : v,
        ),
      );
      if (read !== JSON.stringify(expr)) back = read === undefined ? "Unreadable" : (JSON.parse(read) as MathJSON);
    }
    out[name] = { in: emitted.source, ...(back === undefined ? {} : { back }) };
  }
  return out;
}

/** The fields of a row `formsOf` owns: an own form's whole row, a system's `in` and `back`. */
export const OWN_FORMS = ["epsil", "tex", "traditional"] as const;

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
