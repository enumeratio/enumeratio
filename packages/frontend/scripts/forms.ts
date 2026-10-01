// How we write each reference example, as data (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §2): the rows of
// its implementations record that no kernel is needed for. Our own forms -- `epsil`, the
// InputForm you can retype; `tex`, our TeX serialisation; `traditional`, the TraditionalForm
// TeX where it differs; `fullform`, the tree as Epsil with every head explicit; `notatio`, the
// vdom as markup -- each an `in` and an `out`, with `back` and `backOut` wherever one doesn't
// read back as the example's `expr` or `expected`; and, for every other system, the `in` the
// oracle scan sends it.
//
// Our own forms are built, not kept (scripts/build-forms.ts); a record keeps only the ones
// pinned in examples.tsv as `<form>.<field>`, and every `back`/`backOut`. A system's `in` is
// kept in its values file: scripts/collect-forms.ts writes those (`UPDATE_FORMS=1`).
// tests/forms.test.ts fails when a printer or transpiler no longer produces what's pinned.

import { isDeepStrictEqual } from "node:util";
import { ComputeEngine, LatexSyntax } from "@cortex-js/compute-engine";
import { parseEpsil } from "@cortex-js/compute-engine/epsil";
import {
  type ExampleImplementations,
  type HeadImplementations,
  type MathJSON,
  OWN_FORMS,
  type SystemImplementation,
} from "@enumeratio/entry";
import { toFullForm } from "@enumeratio/formats/fullform";
import { toInputForm } from "@enumeratio/formats/inputform";
import { markupOf, readMarkupText, stripMetadata } from "@enumeratio/formats/markup";
import { parseExpression } from "@enumeratio/formats/expression";
import { portableTeX, registerTeXMacros } from "@enumeratio/formats/tex";
import { emit, SYSTEMS, type System } from "@enumeratio/oracle/src";
import { conventionalLatexDictionary } from "../src/conventional-latex.ts";
import { mergeLatex } from "../src/engine.ts";
import { combineNotation, makeBoxes, notationOf } from "@enumeratio/boxes";
import { toLatex } from "@enumeratio/boxes/render";
import { declaredEngine, packageNotations } from "../../reference/scripts/engines.ts";

// StandardForm: every package's LaTeX, and its macros expanded, so `tex` is portable TeX.
const PACKAGES = combineNotation(await packageNotations());
registerTeXMacros(PACKAGES.macros);

const ce = new ComputeEngine({
  latexSyntax: new LatexSyntax({ dictionary: mergeLatex(conventionalLatexDictionary(), PACKAGES.latex) as never[] }),
});

// TraditionalForm: every package's notation, as the engine that declares them all registers it.
const NOTATION = notationOf(declaredEngine());
const traditionalOf = (json: MathJSON): string => portableTeX(toLatex(makeBoxes(json as never, NOTATION)));

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

/** What FullForm `printed` reads back as, uncanonicalised, where that is not `expr`. */
function fullFormBack(expr: MathJSON, printed: string): MathJSON | undefined {
  const [json, errors] = parseEpsil(printed);
  if (errors.length > 0) return "Unreadable";
  const read = attempt(() => JSON.stringify(numbersAsValues(box(stripOffsets(json)).json)));
  if (read === attempt(() => JSON.stringify(numbersAsValues(box(expr).json)))) return undefined;
  return read === undefined ? "Unreadable" : (JSON.parse(read) as MathJSON);
}

const stripOffsets = (json: unknown): MathJSON =>
  JSON.parse(JSON.stringify(json, (k, v: unknown) => (k === "sourceOffsets" ? undefined : v))) as MathJSON;

// Digits a double holds exactly, so a `{num}` that short reads as the same plain number.
const DOUBLE_DIGITS = 15;

/** `json` with each short `{num}` as the plain number it is: Epsil reads `1e+30` as `{num}`. */
function numbersAsValues(json: unknown): unknown {
  if (Array.isArray(json)) return json.map(numbersAsValues);
  const num = (json as { num?: unknown })?.num;
  if (typeof num !== "string") return json;
  const digits = num.replace(/^[+-]/, "").replace(/e.*$/i, "").replace(".", "").replace(/^0+/, "").length;
  return digits <= DOUBLE_DIGITS && Number.isFinite(Number(num)) ? Number(num) : json;
}

/** What markup `printed` reads back as, where that is not `expr`. */
function markupBack(expr: MathJSON, printed: string): MathJSON | undefined {
  const { json, errors } = readMarkupText(printed);
  if (errors.length > 0) return "Unreadable";
  return isDeepStrictEqual(json, stripMetadata(expr)) ? undefined : (json as MathJSON);
}

/** Our own forms of one example, and each system's `in`, in the order a record lists them. */
export function formsOf(expr: MathJSON, expected: MathJSON): ExampleImplementations {
  const out: Record<string, SystemImplementation> = {};
  const epsil = [attempt(() => toInputForm(expr as never)), attempt(() => toInputForm(expected as never))];
  if (epsil[0] !== undefined) {
    const back = inputFormBack(expr, epsil[0]);
    const backOut = epsil[1] === undefined ? undefined : inputFormBack(expected, epsil[1]);
    out.epsil = {
      in: epsil[0],
      ...(epsil[1] === undefined ? {} : { out: epsil[1] }),
      ...(back === undefined ? {} : { back }),
      ...(backOut === undefined ? {} : { backOut }),
    };
  }
  const tex = [attempt(() => portableTeX(box(expr).latex)), attempt(() => portableTeX(box(expected).latex))];
  if (tex[0] !== undefined) out.tex = { in: tex[0], ...(tex[1] === undefined ? {} : { out: tex[1] }) };
  const traditional = [attempt(() => traditionalOf(expr)), attempt(() => traditionalOf(expected))];
  if (traditional[0] !== undefined && (traditional[0] !== tex[0] || traditional[1] !== tex[1]))
    out.traditional = { in: traditional[0], ...(traditional[1] === undefined ? {} : { out: traditional[1] }) };
  // FullForm: the tree as Epsil, every head explicit, with what `in` and `out` read back as
  // where the trip loses something (none should). `out` is the evaluated tree, so the two differ
  // by what canonicalisation and evaluation did.
  const full = [attempt(() => toFullForm(expr as never, ce)), attempt(() => toFullForm(expected as never, ce))];
  if (full[0] !== undefined) {
    const back = fullFormBack(expr, full[0]);
    const backOut = full[1] === undefined ? undefined : fullFormBack(expected, full[1]);
    out.fullform = {
      in: full[0],
      ...(full[1] === undefined ? {} : { out: full[1] }),
      ...(back === undefined ? {} : { back }),
      ...(backOut === undefined ? {} : { backOut }),
    };
  }
  // The vdom as markup, FullForm written as JSX, and what it reads back as where the trip
  // loses something: none should.
  const notatio = [
    attempt(() => markupOf(expr, { width: Infinity })),
    attempt(() => markupOf(expected, { width: Infinity })),
  ];
  if (notatio[0] !== undefined) {
    const back = markupBack(expr, notatio[0]);
    const backOut = notatio[1] === undefined ? undefined : markupBack(expected, notatio[1]);
    out.notatio = {
      in: notatio[0],
      ...(notatio[1] === undefined ? {} : { out: notatio[1] }),
      ...(back === undefined ? {} : { back }),
      ...(backOut === undefined ? {} : { backOut }),
    };
  }
  // What the oracle scan sends each system: `emit` adds the mappings and the comparison
  // shapes (an equality as `a == b`) the scan compares by.
  for (const { name } of SYSTEMS) {
    const emitted = emit(expr, name as System);
    if (emitted.ok) out[name] = { in: emitted.source };
  }
  return out;
}

const isOwn = (key: string): boolean => (OWN_FORMS as readonly string[]).includes(key);

/** Every example's forms, by id: a row in triage isn't on the page and its `expected` isn't
 * settled, so it gets none. */
export function headForms(
  examples: readonly { id: string; expr: unknown; expected: unknown; role?: string }[],
): Record<string, ExampleImplementations> {
  const forms: Record<string, ExampleImplementations> = {};
  for (const example of examples)
    if (example.role !== "triage") forms[example.id] = formsOf(example.expr as never, example.expected as never);
  return forms;
}

/** Only our own forms of `forms`: what the build writes for the site. */
export function ownForms(forms: Record<string, ExampleImplementations>): Record<string, ExampleImplementations> {
  return Object.fromEntries(
    Object.entries(forms).map(([id, rows]) => [id, Object.fromEntries(Object.entries(rows).filter(([k]) => isOwn(k)))]),
  );
}

// A trip that loses something is always pinned, so a new loss (or a fixed one) shows up.
const ALWAYS_PINNED = ["back", "backOut"] as const;
const PINNABLE = ["in", "out"] as const;

/** An own form's pins as the printers make them now: a pinned `in` or `out` takes the printed
 * value, `back` and `backOut` are there exactly when the trip loses something, and anything
 * else a person wrote stays. */
function repinned(pinned: SystemImplementation | undefined, made: SystemImplementation | undefined) {
  const row: Record<string, unknown> = { ...pinned };
  const printed = (made ?? {}) as unknown as Record<string, unknown>;
  for (const field of PINNABLE)
    if (row[field] !== undefined) {
      if (printed[field] === undefined) delete row[field];
      else row[field] = printed[field];
    }
  for (const field of ALWAYS_PINNED)
    if (printed[field] === undefined) delete row[field];
    else row[field] = printed[field];
  return Object.keys(row).length === 0 ? undefined : (row as unknown as SystemImplementation);
}

/** `record`'s rows for one example with each system's `in` replaced and our own forms'
 * pins refreshed, keeping a kernel's answers. */
export function withForms(
  rows: ExampleImplementations | undefined,
  forms: ExampleImplementations,
): ExampleImplementations {
  const next: Record<string, SystemImplementation> = {};
  for (const form of OWN_FORMS) {
    const row = repinned(rows?.[form], forms[form]);
    if (row !== undefined) next[form] = row;
  }
  for (const [key, row] of Object.entries(forms)) {
    if (isOwn(key)) continue;
    const { in: _in, back: _back, ...kept } = rows?.[key] ?? {};
    next[key] = { ...row, ...kept };
  }
  // Rows the forms don't cover: a system that no longer emits keeps only what a kernel or a
  // person wrote (a transpiled `in` without an answer goes with the mapping).
  for (const [key, row] of Object.entries(rows ?? {})) {
    if (key in next || isOwn(key)) continue;
    const { back: _back, ...kept } = row;
    if (kept.out !== undefined || kept.note !== undefined) next[key] = kept;
  }
  return next;
}

/** A head's record as the forms make it, from the record it has. */
export function recordWithForms(
  examples: readonly { id: string; expr: unknown; expected: unknown; role?: string }[],
  record: HeadImplementations | undefined,
  forms: Record<string, ExampleImplementations> = headForms(examples),
): HeadImplementations {
  const next: Record<string, ExampleImplementations> = {};
  for (const [id, rows] of Object.entries(forms)) {
    const kept = withForms(record?.[id], rows);
    if (Object.keys(kept).length > 0) next[id] = kept;
  }
  // Rows for an example that's gone, or in triage: a kernel's answer, a note or a pin stays
  // for the scan (or a person) to deal with.
  for (const [id, rows] of Object.entries(record ?? {})) {
    if (id in next) continue;
    const kept = Object.fromEntries(
      Object.entries(rows).filter(([key, row]) => isOwn(key) || row.out !== undefined || row.note),
    );
    if (Object.keys(kept).length > 0) next[id] = kept;
  }
  return next;
}
