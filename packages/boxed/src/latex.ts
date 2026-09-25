import type { MathJsonExpression } from "@cortex-js/compute-engine";
import {
  LATEX_DICTIONARY,
  type LatexDictionaryEntry,
  type Serializer,
} from "@cortex-js/compute-engine/latex-syntax";

// compute-engine parenthesises a power's base from a hard-coded list of heads, so
// `(1+i)^2` prints as `1+\imaginaryI^2` and `(2/3)^2` as `\frac{2}{3}^2`. This entry
// replaces the native `Power` by name and brackets any base that binds looser than the
// superscript: an operator under its precedence, a postfix operator (`(n!)^2`), a complex
// number other than `i`, another power (native `{x^2}^3` reads as a stacked exponent). Every host dictionary that redefines `Power` should use this one,
// so whichever lands last still carries the fix.

/** compute-engine's precedence for `^`. */
const POWER_PRECEDENCE = 720;

/** Heads that print with a superscript of their own. */
const SUPERSCRIPTED = new Set(["Power", "Square", "Exp"]);

type Definition = { readonly kind?: string; readonly precedence?: number };
type SerializeHandler = (serializer: Serializer, expr: MathJsonExpression) => string;

const native = LATEX_DICTIONARY.find((e) => e.name === "Power");
const nativeSerialize = native?.serialize as SerializeHandler;

const operand = (expr: MathJsonExpression, i: number): MathJsonExpression | null =>
  Array.isArray(expr) ? ((expr[i] as MathJsonExpression | undefined) ?? null) : null;

function bindsLooser(serializer: Serializer, base: MathJsonExpression | null): boolean {
  if (!Array.isArray(base) || typeof base[0] !== "string") return false;
  if (base[0] === "Complex") return !(base[1] === 0 && base[2] === 1);
  if (SUPERSCRIPTED.has(base[0])) return true;
  const definition = serializer.dictionary.ids.get(base[0]) as Definition | undefined;
  if (definition?.kind === "postfix") return true;
  return definition?.precedence !== undefined && definition.precedence < POWER_PRECEDENCE;
}

export const POWER_LATEX: Partial<LatexDictionaryEntry> = {
  ...native,
  name: "Power",
  serialize: (serializer: Serializer, expr: MathJsonExpression) => {
    const out = nativeSerialize(serializer, expr);
    const base = operand(expr, 1);
    if (!bindsLooser(serializer, base)) return out;
    // Only the plain `base^exp` shape: roots and reciprocals are written without one.
    const bare = serializer.serialize(base);
    const written = [bare, `{${bare}}`].find((form) => out.startsWith(`${form}^`));
    return written === undefined ? out : `\\left(${bare}\\right)${out.slice(written.length)}`;
  },
} as Partial<LatexDictionaryEntry>;
