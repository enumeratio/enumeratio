import type { Json, LatexRule } from "@enumeratio/engine";
import { INTEGER_MOD, QUOTIENT_RING } from "./names.ts";

// Notation for ℤ/m, both ways. Not declared with the heads: compute-engine takes its LaTeX
// dictionary only at construction, so a host loads
// these from the package's notation entry (`./notation`) before it builds an engine.
//
//   a \pmod{n}             IntegerMod(a, n)
//   a = b \pmod{n}         Congruent(a, b, n), as `a \equiv b \pmod{n}` already is
//   a \bmod n              Mod(a, n), untouched: the remainder, an integer
//   \mathbb{Z}/m\mathbb{Z} QuotientRing(Integers, m) -- CE parses it; written here
//
// compute-engine's own infix `\pmod`, just under the relations (245), so `a + b \pmod{n}`
// takes the whole sum. `a \equiv b \pmod{n}` never reaches it: `\equiv` reads its
// `\pmod` through the separate prefix entry, which this leaves alone.
const PMOD_PRECEDENCE = 244;
const RELATION_PRECEDENCE = 245;

const operand = (expr: Json, i: number): Json | null =>
  Array.isArray(expr) ? ((expr[i] as Json | undefined) ?? null) : null;

export const RESIDUES_LATEX: readonly LatexRule[] = [
  {
    name: INTEGER_MOD,
    kind: "infix",
    latexTrigger: ["\\pmod"],
    precedence: PMOD_PRECEDENCE,
    parse: (parser, lhs) => {
      const n = parser.parseGroup() ?? parser.parseToken();
      if (n === null) return null;
      // `x = 2 \pmod{5}` is how congruence is written on paper.
      if (Array.isArray(lhs) && lhs[0] === "Equal" && lhs.length === 3) {
        return ["Congruent", lhs[1], lhs[2], n] as Json;
      }
      return [INTEGER_MOD, lhs, n] as Json;
    },
    serialize: (serializer, expr) =>
      `${serializer.wrap(operand(expr, 1), RELATION_PRECEDENCE)}\\pmod{${serializer.serialize(operand(expr, 2))}}`,
  },
  {
    name: QUOTIENT_RING,
    // Not compute-engine's `\mathbb{Z}_m`, which reads as the p-adic integers as often as ℤ/m.
    // Another base keeps the functional form, which reads back.
    serialize: (serializer, expr) =>
      operand(expr, 1) === "Integers"
        ? `\\mathbb{Z}/${serializer.wrapShort(operand(expr, 2))}\\mathbb{Z}`
        : serializer.serializeFunction(expr),
  },
];
