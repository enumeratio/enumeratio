import type { Json, LatexRule } from "@enumeratio/engine";
import { INTEGER_MOD, QUOTIENT_RING, RESIDUE_CLASS } from "./names.ts";

// Notation for ℤ/m, both ways. Not declared with the heads: a host loads these from the
// package's notation entry (`./notation`) and gives them to the engine's LaTeX syntax.
//
//   a \pmod{n}             ResidueClass(a, n); written back as compute-engine writes it,
//                          \overline{a}_{n}
//   a = b \pmod{n}         Congruent(a, b, n), as `a \equiv b \pmod{n}` already is
//   IntegerMod(a, n)       (a \mathrm{mod} n), read back; `\pmod` is ResidueClass
//   a \bmod n              Mod(a, n), untouched: the remainder, an integer
//   \mathbb{Z}/m\mathbb{Z} QuotientRing(Integers, m) -- CE parses it; written here
//
// compute-engine's own infix `\pmod`, just under the relations (245), so `a + b \pmod{n}`
// takes the whole sum. `a \equiv b \pmod{n}` never reaches it: `\equiv` reads its
// `\pmod` through the separate prefix entry, which this leaves alone.
const PMOD_PRECEDENCE = 244;
const RELATION_PRECEDENCE = 245;
// Above Multiply (390), so compute-engine adds no fence to the one this writes; any higher and a parenthesised left operand stops reading as the left.
const FENCED_PRECEDENCE = 400;

/** The digits of an integer literal, `{num}` for a big one. */
function integerLiteral(expr: Json | null): string | undefined {
  if (typeof expr === "number") return Number.isInteger(expr) ? String(expr) : undefined;
  const num = typeof expr === "object" && expr !== null && "num" in expr ? (expr as { num: unknown }).num : undefined;
  return typeof num === "string" && /^-?\d+$/.test(num) ? num : undefined;
}

const operand = (expr: Json, i: number): Json | null =>
  Array.isArray(expr) ? ((expr[i] as Json | undefined) ?? null) : null;

export const RESIDUES_LATEX: readonly LatexRule[] = [
  {
    name: RESIDUE_CLASS,
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
      return [RESIDUE_CLASS, lhs, n] as Json;
    },
    // An entry by this name replaces compute-engine's writer wholesale: integer literals are
    // written as it does, and anything else, which it leaves as a call that doesn't read back,
    // the way it is typed.
    serialize: (serializer, expr) => {
      const [k, n] = [integerLiteral(operand(expr, 1)), integerLiteral(operand(expr, 2))];
      return k !== undefined && n !== undefined && BigInt(n) >= 1n
        ? `\\overline{${k}}_{${n}}`
        : `${serializer.wrap(operand(expr, 1), RELATION_PRECEDENCE)}\\pmod{${serializer.serialize(operand(expr, 2))}}`;
    },
  },
  {
    name: INTEGER_MOD,
    // `(3 mod 7)`, fenced whole so a sum, product or power of classes
    // (`(3 mod 7) + (2 mod 7)`) never reads as one modulus over several terms. `\mathrm{mod}`
    // keeps it apart from `\bmod` (Mod, the remainder) and `\pmod` (ResidueClass).
    kind: "infix",
    latexTrigger: ["\\mathrm", "<{>", "m", "o", "d", "<}>", "\\;"],
    precedence: FENCED_PRECEDENCE,
    parse: (parser, lhs) => {
      const n = parser.parseGroup() ?? parser.parseArguments("enclosure")?.[0] ?? parser.parseToken();
      return n === null ? null : ([INTEGER_MOD, lhs, n] as Json);
    },
    serialize: (serializer, expr) => {
      // A multi-digit literal is grouped so the modulus reads back as one token.
      const side = (i: number): string => {
        const digits = integerLiteral(operand(expr, i));
        return digits !== undefined && digits.length > 1 ? `{${digits}}` : serializer.wrapShort(operand(expr, i));
      };
      return String.raw`(${side(1)}\;\mathrm{mod}\;${side(2)})`;
    },
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
