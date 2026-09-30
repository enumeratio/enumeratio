// compute-engine's own heads in traditional notation (F_n, μ(n), ψ⁽ⁿ⁾(z)), beside the ones
// `makeBoxes` writes itself. Our packages' heads come with their packages (`notationOf`).

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { fraction, grid, row, subscript, superscript } from "./box.ts";
import {
  fence,
  indexed,
  named,
  type Notation,
  type NotationRule,
  scalars,
  subscripted,
  type Writer,
} from "./notation.ts";

/** The Legendre-family symbols: `(a/n)` stacked in parentheses. */
const legendre: NotationRule = (args, write) =>
  args.length === 2 ? fence("(", [fraction(write.box(args[0]!), write.box(args[1]!))], ")") : undefined;

/** Parenthesised as Wolfram does, so `(a^b mod n)` never reads as `a^(b mod n)`. */
const residue = (write: Writer, x: MathJsonExpression, n: MathJsonExpression) =>
  fence("(", [write.box(x), "mod", write.box(n)], ")");

/** `n` over `k` without a rule, in `open`/`close`: a binomial, or Knuth's braces for a Stirling number. */
const stacked =
  (open: string, close: string): NotationRule =>
  (args, write) =>
    args.length === 2 ? fence(open, [grid([[write.box(args[0]!)], [write.box(args[1]!)]])], close) : undefined;

const RULES: Notation = {
  // Sequences, by index.
  Fibonacci: indexed("F"),
  LucasL: indexed("L"),
  CatalanNumber: indexed("C"),
  BellNumber: indexed("B"),
  BernoulliB: indexed("B"),
  NthPrime: indexed("p"),
  // Arithmetic functions.
  MoebiusMu: named("μ", 1),
  Totient: named("φ", 1),
  PrimePi: named("π", 1),
  PrimeNu: named("ω", 1),
  PrimeOmega: named("Ω", 1),
  CarmichaelLambda: named("λ", 1),
  DivisorSigma: subscripted("σ", 2),
  MultiplicativeOrder: ([a, n, ...rest], write) =>
    a === undefined || n === undefined || rest.length > 0 ? undefined : write.call(subscript("ord", write.box(n)), [a]),
  PowerMod: ([a, b, n, ...rest], write) =>
    a === undefined || b === undefined || n === undefined || rest.length > 0
      ? undefined
      : residue(write, ["Power", a, b], n),
  ModularInverse: ([a, n, ...rest], write) =>
    a === undefined || n === undefined || rest.length > 0
      ? undefined
      : fence("(", [superscript(write.tight(a), row(["−", "1"])), "mod", write.box(n)], ")"),
  JacobiSymbol: legendre,
  KroneckerSymbol: legendre,
  LegendreSymbol: legendre,
  // Special functions.
  Digamma: named("ψ", 1),
  PolyGamma: ([n, z, ...rest], write) =>
    n === undefined || z === undefined || rest.length > 0
      ? undefined
      : write.call(superscript("ψ", fence("(", [write.box(n)], ")")), [z]),
  GammaLn: named(row(["log", "Γ"]), 1),
  LerchPhi: named("Φ", 3),
  HurwitzZeta: named("ζ", 2),
  Erfc: named("erfc", 1),
  ErfInv: named(superscript("erf", row(["−", "1"])), 1),
  GammaRegularized: named("Q", 2),
  BetaRegularized: subscripted("I", 3),
  // Combinatorial.
  Pochhammer: ([a, n, ...rest], write) =>
    a === undefined || n === undefined || rest.length > 0
      ? undefined
      : subscript(fence("(", [write.box(a)], ")"), write.box(n)),
  Multinomial: (args, write) => {
    if (args.length < 2) return undefined;
    const total = args.every((a) => typeof a === "number")
      ? String((args as number[]).reduce((x, y) => x + y, 0))
      : write.box(["Add", ...args] as MathJsonExpression);
    const parts = row(args.flatMap((a, i) => (i === 0 ? [write.box(a)] : [",", write.box(a)])));
    return fence("(", [fraction(total, parts, { FractionLine: false })], ")");
  },
  Stirling: stacked("{", "}"),
  // Signed, as Wolfram's StirlingS1: lowercase s, not Knuth's unsigned brackets.
  StirlingS1: named("s", 2),
  Subfactorial: ([n, ...rest], write) => (n === undefined || rest.length > 0 ? undefined : row(["!", write.tight(n)])),
};

export const ENGINE_NOTATION: Notation = Object.fromEntries(
  Object.entries(RULES).map(([head, rule]) => [head, scalars(rule)]),
);
