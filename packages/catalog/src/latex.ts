// The `ƒ` spelling. This CANNOT be contributed by `declareCatalog` — compute-engine takes
// its LaTeX dictionary as a CONSTRUCTOR option that REPLACES the default, so notation has
// to be assembled by whoever calls `new ComputeEngine`. See design/upstreaming.md §3.7;
// this is the first place where that gap costs ergonomics rather than cosmetics.
//
//   import { LatexSyntax, ComputeEngine } from "@cortex-js/compute-engine";
//   const ce = new ComputeEngine({
//     latexSyntax: new LatexSyntax({ dictionary: [...LATEX_DICTIONARY, ...CATALOG_LATEX] }),
//   });
//   ce.parse("ƒ(\"Subsets\", 4)")   // ["Resource", "'Subsets'", 4]

/** Loose shape of a compute-engine LaTeX dictionary entry — typed structurally so this
 *  module does not drag the engine's types into a data-only file. */
export interface LatexEntry {
  readonly kind: "function";
  readonly name: string;
  readonly latexTrigger: string;
}

/** U+0192 LATIN SMALL LETTER F WITH HOOK — Option+f on a Mac. Deliberately a glyph nobody
 *  reaches for as a variable, so the namespace marker never shadows a real symbol. */
export const RESOURCE_TRIGGER = "ƒ";

export const CATALOG_LATEX: readonly LatexEntry[] = [
  { kind: "function", name: "Resource", latexTrigger: RESOURCE_TRIGGER },
];
