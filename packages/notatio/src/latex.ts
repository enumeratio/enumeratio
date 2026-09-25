import type { BoxedExpression, ComputeEngine, MathJsonExpression } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";

// LaTeX for compute-engine heads that have none of their own; the shared engine always
// carries these (engine.ts). Display only -- nothing here needs to parse back.

const operands = (expr: MathJsonExpression | null): MathJsonExpression[] =>
  Array.isArray(expr) ? (expr.slice(1) as MathJsonExpression[]) : [];

const BOOLEAN = new Set(["True", "False"]);

export const NOTATIO_LATEX: readonly Partial<LatexDictionaryEntry>[] = [
  {
    // Written as its InputForm is, `{"key" -> value, …}`.
    name: "Dictionary",
    serialize: (serializer, expr) => {
      const entries = operands(expr).map((pair) => {
        const [key, value] = operands(pair);
        // A flag reads as a word here, not as ⊤/⊥.
        const shown =
          typeof value === "string" && BOOLEAN.has(value) ? `\\mathrm{${value}}` : serializer.serialize(value ?? null);
        return `${serializer.serialize(key ?? null)}\\to ${shown}`;
      });
      return `\\left\\lbrace ${entries.join(",\\;")}\\right\\rbrace`;
    },
  },
];

type DictNode = { dict: Record<string, unknown> };
const isDict = (node: unknown): node is DictNode =>
  typeof node === "object" && node !== null && !Array.isArray(node) && "dict" in node;

/** A value inside a `{dict: …}` literal, as the MathJSON it abbreviates. */
function entryOf(value: unknown): unknown {
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null && !("fn" in value || "sym" in value)) {
    if ("str" in value || "num" in value) return value;
    return expandDictionaries({ dict: value as Record<string, unknown> });
  }
  return value;
}

/**
 * `expr` with every `{dict: …}` literal spelled out as `["Dictionary", ["KeyValuePair", …]]`.
 * compute-engine's LaTeX serialiser skips the literal form entirely -- it writes the empty
 * string -- so a dictionary only reaches an entry for `Dictionary` once it is spelled out.
 */
export function expandDictionaries(node: unknown): unknown {
  if (isDict(node)) {
    return [
      "Dictionary",
      ...Object.entries(node.dict).map(([k, v]) => ["KeyValuePair", { str: k }, expandDictionaries(entryOf(v))]),
    ];
  }
  if (Array.isArray(node)) return node.map(expandDictionaries);
  return node;
}

const hasDictionary = (node: unknown): boolean => isDict(node) || (Array.isArray(node) && node.some(hasDictionary));

/** `expr.latex`, except that a dictionary anywhere inside is written rather than dropped. */
export function latexOf(ce: ComputeEngine, expr: BoxedExpression, options?: Record<string, unknown>): string {
  const json = expr.json;
  if (!hasDictionary(json) || ce.latexSyntax === undefined) {
    return options === undefined ? expr.latex : expr.toLatex(options);
  }
  return ce.latexSyntax.serialize(expandDictionaries(json) as MathJsonExpression, options);
}
