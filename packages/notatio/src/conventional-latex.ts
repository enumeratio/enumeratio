// Conventional LaTeX for native compute-engine heads that write or read it wrong
// (design/upstreaming.md §8): `Zeta` and `Beta` serialise as `\Zeta`/`\Beta` (not LaTeX
// commands), `LCM` as `\lcm`; `\operatorname{lcm|rank|erf}` don't parse back to
// `LCM`/`MatrixRank`/`Erf`. A power's base is bracketed when it binds looser than the
// superscript (boxed's `POWER_LATEX`), a fraction's sign goes in front of it, and every
// logarithm but the natural one names its base.
// (`Rank` is array depth, not matrix rank, so it keeps its default `\mathrm{Rank}`.)
// GCD, Determinant, Trace, Sign, Arg, Mod, Max, Min and Sinc were probed and are fine.
// The shared engine carries these via its configureLatex list (engine.ts); engines built
// elsewhere pass `conventionalLatexDictionary()`.

import { LATEX_DICTIONARY, type MathJsonExpression } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry, Serializer } from "@cortex-js/compute-engine/latex-syntax";
import { POWER_LATEX } from "@enumeratio/boxed";
import { TRADITIONAL_LATEX } from "./traditional.ts";

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

/** The Euler beta, `\mathrm{B}(a, b)` -- a roman capital beta; `\Beta` is not a LaTeX
 *  command. `\Beta` still parses, and so does `\mathrm{B}` applied to arguments. */
const beta: Entry = {
  kind: "function",
  name: "Beta",
  latexTrigger: "\\Beta",
  serialize: (serializer, expr) =>
    `\\mathrm{B}(${operands(expr)
      .map((e) => serializer.serialize(e))
      .join(", ")})`,
  parse: (parser) => ["Beta", ...(parser.parseArguments() ?? [])],
};
const betaRoman: Entry = {
  kind: "function",
  // The literal tokens, not a `symbolTrigger`: that would claim a plain `B(2, 3)` too.
  latexTrigger: ["\\mathrm", "<{>", "B", "<}>"],
  parse: (parser) => {
    const args = parser.parseArguments();
    return args === null ? null : ["Beta", ...args];
  },
};

type Serialize = (serializer: Serializer, expr: MathJsonExpression) => string;
const native = (name: string): Entry & { serialize: Serialize } =>
  LATEX_DICTIONARY.find((e) => (e as { name?: string }).name === name) as Entry & {
    serialize: Serialize;
  };

/** `\log_{b}(x)` for a logarithm whose base the head implies. `\log` alone reads as the
 *  natural log to most people (and to Wolfram); compute-engine's `Log(x)` is base 10. */
const logBase = (name: string, base: number): Entry => ({
  ...native(name),
  name,
  serialize: (serializer, expr) => {
    const [x, b] = operands(expr);
    if (x === undefined) return "\\log";
    return `\\log_{${b === undefined ? base : serializer.serialize(b)}}${serializer.wrapArguments(["Log", x ?? null])}`;
  },
});

/** A leading minus sign: a negative number, a negation, a product led by one. */
const isNegative = (x: MathJsonExpression | undefined): boolean =>
  (typeof x === "number" && x < 0) ||
  (typeof x === "object" && x !== null && "num" in x && String(x.num).startsWith("-")) ||
  (Array.isArray(x) && (x[0] === "Negate" || (x[0] === "Multiply" && isNegative(x[1]))));

/** `x` without its leading minus sign (`isNegative(x)` holds). */
const negated = (x: MathJsonExpression): MathJsonExpression => {
  if (typeof x === "number") return -x;
  if (!Array.isArray(x)) return { num: String((x as { num: string }).num).slice(1) };
  if (x[0] === "Negate") return x[1] as MathJsonExpression;
  const [first, ...rest] = x.slice(1) as MathJsonExpression[];
  const factors = first === -1 ? rest : [negated(first as MathJsonExpression), ...rest];
  return factors.length === 1 ? (factors[0] as MathJsonExpression) : ["Multiply", ...factors];
};

/** `-\frac{1}{2}`, not `\frac{-1}{2}`: the sign of a fraction goes in front of it. */
const signOut = (name: string): Entry => {
  const entry = native(name);
  return {
    ...entry,
    serialize: (serializer, expr) => {
      const [a, b, ...rest] = operands(expr);
      if (a === undefined || b === undefined || rest.length > 0) {
        return entry.serialize(serializer, expr);
      }
      const [na, nb] = [isNegative(a), isNegative(b)];
      if (!na && !nb) return entry.serialize(serializer, expr);
      const positive = [name, na ? negated(a) : a, nb ? negated(b) : b] as MathJsonExpression;
      const written = entry.serialize(serializer, positive);
      return na === nb ? written : `-${written}`;
    },
  };
};

/** Precedence of the prefix minus. */
const NEGATE_PRECEDENCE = 701;
const FRACTIONS = new Set(["Divide", "Rational"]);

/** `-\frac{3}{4}`, not `-(\frac{3}{4})`: a fraction needs no brackets to be negated. */
const negate: Entry = {
  ...native("Negate"),
  name: "Negate",
  serialize: (serializer, expr) => {
    const [x] = operands(expr);
    return Array.isArray(x) && FRACTIONS.has(x[0] as string) && !isNegative(x[1])
      ? `-${serializer.serialize(x)}`
      : `-${serializer.wrap(x ?? null, NEGATE_PRECEDENCE)}`;
  },
};

/** `Square(x)` is written as the power it is, so it brackets its base the same way. */
const square: Entry = {
  ...native("Square"),
  name: "Square",
  serialize: (serializer, expr) => serializer.serialize(["Power", operands(expr)[0] ?? null, 2]),
};

/** Euler's constant as `\\gamma`, which it already parses from, not `\\operatorname{EulerGamma}`. */
const eulerGamma: Entry = {
  ...native("EulerGamma"),
  name: "EulerGamma",
  serialize: () => "\\gamma",
};

/** The overrides, one per native head that needed one. */
export const CONVENTIONAL_LATEX: readonly Entry[] = [
  operatorname("LCM", "lcm"),
  operatorname("MatrixRank", "rank"),
  operatorname("Erf", "erf"),
  zeta,
  beta,
  betaRoman,
  POWER_LATEX,
  square,
  eulerGamma,
  signOut("Divide"),
  signOut("Rational"),
  negate,
  logBase("Log", 10),
  logBase("Log2", 2),
  logBase("Log10", 10),
  logBase("Lb", 2),
];

/**
 * `LATEX_DICTIONARY` with the default entries for `CONVENTIONAL_LATEX`'s names
 * dropped, and the conventional ones appended in their place. Two entries for the
 * same `name` is a dictionary-shape warning at construction time (not an error —
 * the later entry still wins — but the default is removed first to build clean).
 */
export function conventionalLatexDictionary(): readonly Entry[] {
  // The traditional entries ride along: inert unless `toLatex({ traditional: true })`.
  const entries = [...CONVENTIONAL_LATEX, ...TRADITIONAL_LATEX];
  const names = new Set(entries.map((e) => e.name));
  const base = LATEX_DICTIONARY.filter((entry) => {
    const name = (entry as { name?: string }).name;
    return !name || !names.has(name);
  });
  return [...base, ...entries];
}
