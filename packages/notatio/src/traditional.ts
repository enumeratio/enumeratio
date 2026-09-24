import type { ComputeEngine } from "@cortex-js/compute-engine";
import { latexOf } from "./latex.ts";

// Conventional ("traditional") notation for heads that compute-engine otherwise
// serialises functionally (e.g. \mathrm{CatalanNumber}(n)). Anything not listed
// falls back to CE's own LaTeX, so operators, fractions, roots etc. are unchanged.
const NOTATION: Record<string, (args: string[]) => string | undefined> = {
  CatalanNumber: ([n]) => `C_{${n}}`,
  Fibonacci: ([n]) => `F_{${n}}`,
  LucasL: ([n]) => `L_{${n}}`,
  BellNumber: ([n]) => `B_{${n}}`,
  Subfactorial: ([n]) => `!${n}`,
  Totient: ([n]) => `\\varphi(${n})`,
  MoebiusMu: ([n]) => `\\mu(${n})`,
  PrimePi: ([n]) => `\\pi(${n})`,
  NthPrime: ([n]) => `p_{${n}}`,
  Pochhammer: ([a, n]) => `(${a})_{${n}}`,
  StirlingS1: ([n, m]) => `S_{${n}}^{(${m})}`,
  Stirling: ([n, k]) => `\\left\\{{${n}\\atop ${k}}\\right\\}`,
  DivisorSigma: ([k, n]) => `\\sigma_{${k}}(${n})`,
  PrimeNu: ([n]) => `\\omega(${n})`,
  PrimeOmega: ([n]) => `\\Omega(${n})`,
  // A residue class as the coset it is.
  IntegerMod: ([a, m]) => `${a}+${m}\\mathbb{Z}`,
  IntegerModRing: ([m]) => `\\mathbb{Z}/${m}\\mathbb{Z}`,
};

/**
 * Serialise a MathJSON value to "traditional" LaTeX: mapped heads use their
 * conventional symbol (with arguments serialised recursively), everything else
 * defers to `ce.box(node).latex`.
 */
export function toTraditionalLatex(node: unknown, ce: ComputeEngine): string {
  if (Array.isArray(node) && typeof node[0] === "string") {
    const render = NOTATION[node[0]];
    if (render) {
      const args = node.slice(1).map((arg) => toTraditionalLatex(arg, ce));
      const latex = render(args);
      if (latex !== undefined) return latex;
    }
  }
  return latexOf(ce, ce.box(node as Parameters<ComputeEngine["box"]>[0]));
}
