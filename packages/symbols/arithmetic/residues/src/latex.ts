import type { MathJsonExpression } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry, Parser } from "@cortex-js/compute-engine/latex-syntax";
import { POWER_LATEX } from "@enumeratio/boxed";
import { INTEGER_MOD, INTEGER_MOD_RING } from "./integer-mod-declare.ts";

// Notation for ℤ/m, both ways. Not declared with the heads: compute-engine takes its LaTeX
// dictionary only at construction (design/upstreaming.md §3.7), so a host appends these to
// the default one -- notatio's `configureLatex(RESIDUES_LATEX)`.
//
//   a \pmod{n}             IntegerMod(a, n)
//   a = b \pmod{n}         Congruent(a, b, n), as `a \equiv b \pmod{n}` already is
//   a \bmod n              Mod(a, n), untouched: the remainder, an integer
//   \mathbb{Z}/m\mathbb{Z} IntegerModRing(m) -- written here; it parses to CE's
//                          QuotientRing(Integers, m), which evaluates to it
//
// `Power` is here too (boxed's `POWER_LATEX`): compute-engine parenthesises a base from a
// fixed list of heads, so `(3 \pmod{7})^6` would print as `3\pmod{7}^{6}`. The entry
// replaces the native one by name -- a host merging these must drop the default entry for a
// name it redefines.

// compute-engine's own infix `\pmod`, just under the relations (245), so `a + b \pmod{n}`
// takes the whole sum. `a \equiv b \pmod{n}` never reaches it: `\equiv` reads its
// `\pmod` through the separate prefix entry, which this leaves alone.
const PMOD_PRECEDENCE = 244;
const RELATION_PRECEDENCE = 245;

const operand = (expr: MathJsonExpression, i: number): MathJsonExpression | null =>
  Array.isArray(expr) ? ((expr[i] as MathJsonExpression | undefined) ?? null) : null;

export const RESIDUES_LATEX: readonly Partial<LatexDictionaryEntry>[] = [
  {
    name: INTEGER_MOD,
    kind: "infix",
    latexTrigger: ["\\pmod"],
    precedence: PMOD_PRECEDENCE,
    parse: (parser: Parser, lhs: MathJsonExpression) => {
      const n = parser.parseGroup() ?? parser.parseToken();
      if (n === null) return null;
      // `x = 2 \pmod{5}` is how congruence is written on paper.
      if (Array.isArray(lhs) && lhs[0] === "Equal" && lhs.length === 3) {
        return ["Congruent", lhs[1], lhs[2], n] as MathJsonExpression;
      }
      return [INTEGER_MOD, lhs, n] as MathJsonExpression;
    },
    serialize: (serializer, expr) =>
      `${serializer.wrap(operand(expr, 1), RELATION_PRECEDENCE)}\\pmod{${serializer.serialize(operand(expr, 2))}}`,
  },
  POWER_LATEX,
  {
    name: INTEGER_MOD_RING,
    serialize: (serializer, expr) =>
      `\\mathbb{Z}/${serializer.wrapShort(operand(expr, 1))}\\mathbb{Z}`,
  },
];
