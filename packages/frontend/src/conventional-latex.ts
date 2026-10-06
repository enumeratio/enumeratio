// Conventional LaTeX for native compute-engine heads that write or read it wrong
//: `Zeta` and `Beta` serialise as `\Zeta`/`\Beta` (not LaTeX
// commands), `LCM` as `\lcm`; `\operatorname{lcm|rank|erf}` don't parse back to
// `LCM`/`MatrixRank`/`Erf`. A fraction's sign goes in front of it, and every logarithm but
// the natural one names its base.
// (`Rank` is array depth, not matrix rank, so it keeps its default `\mathrm{Rank}`.)
// GCD, Determinant, Trace, Sign, Arg, Mod, Max, Min and Sinc were probed and are fine.
// The shared engine carries these via its configureLatex list (engine.ts); engines built
// elsewhere pass `conventionalLatexDictionary()`.

import { LATEX_DICTIONARY, type MathJsonExpression } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry, Serializer } from "@cortex-js/compute-engine/latex-syntax";
import { escapeTeXText } from "@enumeratio/boxes/render";

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

/** A pure-imaginary `Complex(0, b)` factor of a product as `b` times the unit, which native
 *  `Multiply` writes bare (`\imaginaryI\pi`, `-\imaginaryI x`) and native `Add` reads the
 *  sign of (`a-\imaginaryI b`), instead of the bracketed `(-\imaginaryI)x`. */
const unitFactors = (expr: MathJsonExpression): MathJsonExpression => {
  if (!Array.isArray(expr) || expr[0] !== "Multiply") return expr;
  const imaginary = (x: MathJsonExpression): x is ["Complex", 0, number] =>
    Array.isArray(x) && x[0] === "Complex" && x[1] === 0 && typeof x[2] === "number";
  const factors = operands(expr);
  if (!factors.some(imaginary)) return expr;
  return [
    "Multiply",
    ...factors.flatMap((x): MathJsonExpression[] =>
      !imaginary(x) ? [x] : x[2] === 1 ? ["ImaginaryUnit"] : [x[2], "ImaginaryUnit"],
    ),
  ];
};

const multiply: Entry = {
  ...native("Multiply"),
  name: "Multiply",
  serialize: (serializer, expr) => native("Multiply").serialize(serializer, unitFactors(expr)),
};

const add: Entry = {
  ...native("Add"),
  name: "Add",
  serialize: (serializer, expr) => native("Add").serialize(serializer, ["Add", ...operands(expr).map(unitFactors)]),
};

/** A string atom as one escaped `\\text{…}`. compute-engine writes a bare string atom unescaped
 *  and without consulting the dictionary (`\\text{#}` is a TeX error), and hands `String`'s
 *  operands over unquoted, like symbols. So a writer that needs portable TeX wraps each string
 *  atom in this private head first (`withStringsWrapped`), which only this entry writes. */
const TEXT_HEAD = "EscapedText";
const escapedText: Entry = {
  kind: "function",
  name: TEXT_HEAD,
  serialize: (_serializer, expr) => `\\text{${escapeTeXText(operands(expr).map(String).join(""))}}`,
};

const isStringAtom = (x: MathJsonExpression): boolean =>
  typeof x === "string" && x.length >= 2 && x.startsWith("'") && x.endsWith("'");

/** `expr` with every string atom wrapped for `escapedText` above. */
export const withStringsWrapped = (expr: MathJsonExpression): MathJsonExpression =>
  isStringAtom(expr)
    ? [TEXT_HEAD, expr]
    : Array.isArray(expr)
      ? (expr.map((x, i) =>
          i === 0 ? x : withStringsWrapped(x as MathJsonExpression),
        ) as unknown as MathJsonExpression)
      : expr;

/** Euler's constant as `\\gamma`, which it already parses from, not `\\operatorname{EulerGamma}`. */
const eulerGamma: Entry = {
  ...native("EulerGamma"),
  name: "EulerGamma",
  serialize: () => "\\gamma",
};

/** `\lfloor x\rfloor` for one operand; with a step (`Floor(226, 10)`) the brackets would
 *  drop it, so it is written as the call. */
const bracketed = (name: "Floor" | "Ceil", open: string, close: string): Entry => ({
  ...native(name),
  name,
  serialize: (serializer, expr) => {
    const args = operands(expr);
    const inner = (x: MathJsonExpression) => serializer.serialize(x);
    return args.length === 1
      ? `${open}${/^[A-Za-z]/.test(inner(args[0]!)) ? " " : ""}${inner(args[0]!)}${close}`
      : `\\mathrm{${name}}${serializer.wrapArguments(expr as MathJsonExpression)}`;
  },
});

/** A truth value written as the word, as InputForm spells it; ⊤ and ⊥ are TraditionalForm's
 *  and still read. */
const truth = (name: "True" | "False", trigger: string): Entry => ({
  name,
  kind: "symbol",
  standaloneSymbol: true,
  latexTrigger: [trigger],
  serialize: () => `\\mathrm{${name}}`,
});

/** Precedence of the postfix prime (compute-engine's `'` entry). */
const PRIME_PRECEDENCE = 810;

/** `Derivative(f, n)` as a prime, with the operand bracketed when it binds looser than the
 *  prime: `(x\mapsto x^2)'`, `(x^2)'`. Bare, the prime lands on the function body or on a
 *  power's exponent, a double superscript. Several orders keep the native `f^{(a, b)}`.
 *  Upstream: https://github.com/cortex-js/compute-engine/issues/345#issuecomment-6022735477 */
const derivative: Entry = {
  ...native("Derivative"),
  name: "Derivative",
  serialize: (serializer, expr) => {
    const [f, ...orders] = operands(expr);
    const operand = serializer.wrap(f ?? null, PRIME_PRECEDENCE);
    if (orders.length > 1) return `${operand}^{(${orders.map((o) => serializer.serialize(o)).join(", ")})}`;
    const order = orders[0] ?? 1;
    if (order === 1) return `${operand}^{\\prime}`;
    if (order === 2) return `${operand}^{\\doubleprime}`;
    if (order === 3) return `${operand}^{\\tripleprime}`;
    return `${operand}^{(${serializer.serialize(order)})}`;
  },
};

/** The overrides, one per native head that needed one. */
/** A name in a namespace, `a.b.c`, from its `Field` chain; undefined if a part isn't a name. */
function dotted(json: MathJsonExpression | undefined): string | undefined {
  if (typeof json === "string") return /^'.*'$/s.test(json) ? json.slice(1, -1) : json;
  const { sym, str } = (json ?? {}) as { sym?: unknown; str?: unknown };
  if (typeof sym === "string") return sym;
  if (typeof str === "string") return str;
  if (Array.isArray(json) && json[0] === "Field" && json.length === 3) {
    const [base, member] = [dotted(json[1] as MathJsonExpression), dotted(json[2] as MathJsonExpression)];
    return base === undefined || member === undefined ? undefined : `${base}.${member}`;
  }
  return undefined;
}

/** A call by namespace, `\operatorname{enumeratio.PolygonalNumber}(4, 5)`: compute-engine writes
 *  `\mathrm{MemberCall}(enumeratio, …)`. An upstream ask (print `N.m(x)`). */
const memberCall: Entry = {
  name: "MemberCall",
  serialize: (serializer, expr) => {
    const [receiver, member, ...args] = operands(expr);
    const name = dotted(["Field", receiver!, member!] as MathJsonExpression);
    const written = args.map((e) => serializer.serialize(e)).join(", ");
    return name === undefined
      ? `\\mathrm{MemberCall}(${operands(expr)
          .map((e) => serializer.serialize(e))
          .join(", ")})`
      : `\\operatorname{${name}}(${written})`;
  },
};

export const CONVENTIONAL_LATEX: readonly Entry[] = [
  memberCall,
  truth("True", "\\top"),
  truth("False", "\\bot"),
  operatorname("LCM", "lcm"),
  operatorname("MatrixRank", "rank"),
  operatorname("Erf", "erf"),
  operatorname("Erfc", "erfc"),
  // compute-engine writes the Russian `arcctg`.
  operatorname("Arccot", "arccot"),
  bracketed("Floor", "\\lfloor", "\\rfloor"),
  bracketed("Ceil", "\\lceil", "\\rceil"),
  zeta,
  beta,
  betaRoman,
  square,
  escapedText,
  eulerGamma,
  signOut("Divide"),
  signOut("Rational"),
  negate,
  multiply,
  add,
  logBase("Log", 10),
  logBase("Log2", 2),
  logBase("Log10", 10),
  logBase("Lb", 2),
  derivative,
];

/**
 * `LATEX_DICTIONARY` with the default entries for `CONVENTIONAL_LATEX`'s names
 * dropped, and the conventional ones appended in their place. Two entries for the
 * same `name` is a dictionary-shape warning at construction time (not an error —
 * the later entry still wins — but the default is removed first to build clean).
 */
export function conventionalLatexDictionary(): readonly Entry[] {
  const entries = CONVENTIONAL_LATEX;
  const names = new Set(entries.map((e) => e.name));
  const base = LATEX_DICTIONARY.filter((entry) => {
    const name = (entry as { name?: string }).name;
    return !name || !names.has(name);
  });
  return [...base, ...entries];
}
