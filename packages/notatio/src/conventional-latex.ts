// Conventional LaTeX for native compute-engine heads that write or read it wrong
// (design/upstreaming.md §8): `Zeta` serialises as `\Zeta` (not a LaTeX command),
// `LCM` as `\lcm`; `\operatorname{lcm|rank|erf}` don't parse back to `LCM`/`MatrixRank`/`Erf`.
// (`Rank` is array depth, not matrix rank, so it keeps its default `\mathrm{Rank}`.)
// GCD, Determinant, Trace, Sign, Arg, Mod, Max, Min and Sinc were probed and are fine.
// The shared engine carries these via its configureLatex list (engine.ts); engines built
// elsewhere pass `conventionalLatexDictionary()`.

import { LATEX_DICTIONARY, type MathJsonExpression } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";

type Entry = Partial<LatexDictionaryEntry>;

const operands = (expr: MathJsonExpression | null): MathJsonExpression[] =>
  Array.isArray(expr) ? (expr.slice(1) as MathJsonExpression[]) : [];

/** `\operatorname{word}(args...)` — matches under `\operatorname`, `\mathrm`,
 *  `\mathbin`, … (a `symbolTrigger`, not a literal token match) and parses/
 *  serializes it as a call to `name`. */
const operatorname = (name: string, word: string): Entry => ({
  kind: "function",
  name,
  symbolTrigger: word,
  serialize: (serializer, expr) =>
    `\\operatorname{${word}}(${operands(expr)
      .map((e) => serializer.serialize(e))
      .join(", ")})`,
  parse: (parser) => [name, ...(parser.parseArguments() ?? [])],
});

/** The Riemann zeta, `\zeta(s)` — not `\Zeta`, which is not a LaTeX command (capital
 *  zeta is a roman Z). Parsing already accepts both spellings; only the write side
 *  was wrong. */
const zeta: Entry = {
  kind: "function",
  name: "Zeta",
  latexTrigger: "\\zeta",
  serialize: (serializer, expr) =>
    `\\zeta(${operands(expr)
      .map((e) => serializer.serialize(e))
      .join(", ")})`,
  parse: (parser) => ["Zeta", ...(parser.parseArguments() ?? [])],
};

/** The overrides, one per native head that needed one. */
export const CONVENTIONAL_LATEX: readonly Entry[] = [
  operatorname("LCM", "lcm"),
  operatorname("MatrixRank", "rank"),
  operatorname("Erf", "erf"),
  zeta,
];

/**
 * `LATEX_DICTIONARY` with the default entries for `CONVENTIONAL_LATEX`'s names
 * dropped, and the conventional ones appended in their place. Two entries for the
 * same `name` is a dictionary-shape warning at construction time (not an error —
 * the later entry still wins — but the default is removed first to build clean).
 */
export function conventionalLatexDictionary(): readonly Entry[] {
  const names = new Set(CONVENTIONAL_LATEX.map((e) => e.name));
  const base = LATEX_DICTIONARY.filter((entry) => {
    const name = (entry as { name?: string }).name;
    return !name || !names.has(name);
  });
  return [...base, ...CONVENTIONAL_LATEX];
}
