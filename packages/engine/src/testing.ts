import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import type { Engine } from "./facade.ts";
import { latexEntries, type LatexRule } from "./latex.ts";

/** A step that declares heads on an engine, e.g. a library's `declareX`. */
export type Declare = (ce: Engine) => void;

/** A fresh engine with `declares` applied in order. */
export const createEngine = (...declares: readonly Declare[]): Engine => {
  const ce = bareEngine();
  for (const declare of declares) declare(ce);
  return ce;
};

/** A fresh engine with nothing declared: compute-engine's own library only. */
export const bareEngine = (): Engine => new ComputeEngine();

/**
 * `createEngine` with `rules` added to the LaTeX dictionary, which compute-engine fixes at
 * construction. A rule for a head replaces the default one, as the interface's engine merges.
 */
export const createLatexEngine = (rules: readonly LatexRule[], ...declares: readonly Declare[]): Engine => {
  const replaced = new Set(rules.map((rule) => rule.name));
  const ce = new ComputeEngine({
    latexSyntax: new LatexSyntax({
      dictionary: [...LATEX_DICTIONARY.filter((entry) => !replaced.has(entry.name)), ...latexEntries(rules)],
    }),
  });
  for (const declare of declares) declare(ce);
  return ce;
};
