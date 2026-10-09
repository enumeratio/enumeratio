// Plain readers of MathJSON, shared by the symbol map (`symbols.ts`) and the box renderer
// (`box-render.ts`, `control-box.ts`): neither imports the other, so what both need sits here.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { serializeExpression } from "@enumeratio/formats/expression";

type Json = MathJsonExpression;

export const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

export const opsOf = (node: unknown): Json[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? (fn.slice(1) as Json[]) : [];
};

export const symOf = (node: unknown): string | undefined => {
  if (typeof node === "string") return node;
  const sym = (node as { sym?: unknown })?.sym;
  return typeof sym === "string" ? sym : undefined;
};

export const numOf = (node: unknown): number | undefined => {
  if (typeof node === "number") return node;
  const num = (node as { num?: unknown })?.num;
  if (typeof num === "string") return Number(num);
  if (typeof num === "number") return num;
  return undefined;
};

export const strOf = (node: unknown): string | undefined => {
  // A string is `{str}`, or -- the engine's own spelling of a literal -- `'…'`.
  if (typeof node === "string" && node.length >= 2 && node.startsWith("'") && node.endsWith("'")) {
    return node.slice(1, -1);
  }
  const str = (node as { str?: unknown })?.str;
  return typeof str === "string" ? str : undefined;
};

/** Epsil for an operand, as an attribute value. */
export const epsil = (node: Json): string => serializeExpression(node);

/**
 * The elements of a tuple -- `Tuple` or `List`, or the `Delimiter(Sequence(…))` a LaTeX
 * parse leaves for `(x, 0, 10)` before canonicalisation -- or undefined.
 */
export function tupleOf(node: Json | undefined): Json[] | undefined {
  const head = headOf(node);
  if (head === "Tuple" || head === "List") return opsOf(node);
  if (head === "Delimiter") {
    const inner = opsOf(node)[0];
    if (headOf(inner) === "Sequence") return opsOf(inner);
    return inner === undefined ? undefined : [inner];
  }
  return undefined;
}

/** `PlotRange` -> `plot-range`: an option's attribute when the symbol says nothing. */
export const optionAttribute = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
