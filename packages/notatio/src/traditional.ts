import type { BoxedExpression, ComputeEngine, MathJsonExpression } from "@cortex-js/compute-engine";
import { LATEX_DICTIONARY } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry, Serializer } from "@cortex-js/compute-engine/latex-syntax";
import { latexOf } from "./latex.ts";

// Conventional ("traditional") notation -- F_n, \mu(n), \psi^{(n)}(z), (a)_n -- for heads
// compute-engine otherwise writes functionally (`\mathrm{Fibonacci}(n)`). Display only: it
// doesn't parse back, so the entries write it only when a serialisation asks for it with
// `toLatex({ traditional: true })` -- the Out cell's TraditionalForm and TeX export -- and
// the editable In keeps the round-trippable spelling. Entries sit in the engine's dictionary
// (engine.ts), so a head nested anywhere is reached, not only at the root.

type Entry = Partial<LatexDictionaryEntry>;
type Args = readonly MathJsonExpression[];
/** The notation, or `undefined` to fall back to the functional spelling. */
type Write = (s: Serializer, args: Args) => string | undefined;
type Serialize = (serializer: Serializer, expr: MathJsonExpression) => string;

const TRADITIONAL = "traditional";
const wanted = (s: Serializer): boolean => (s.options as unknown as Record<string, unknown>)[TRADITIONAL] === true;

const operands = (expr: MathJsonExpression): MathJsonExpression[] =>
  Array.isArray(expr) ? (expr.slice(1) as MathJsonExpression[]) : [];
const isList = (x: MathJsonExpression): boolean => Array.isArray(x) && x[0] === "List";
const native = (name: string): Entry | undefined =>
  LATEX_DICTIONARY.find((e) => (e as { name?: string }).name === name) as Entry | undefined;

/** A head written `write` when traditional notation is asked for, as before otherwise. A call
 *  threaded over a list keeps the functional spelling (`F_{[1, 2, 3]}` reads worse), unless
 *  the head takes a list itself (`listArgument`). */
function head(name: string, write: Write, listArgument = false): Entry {
  const base = native(name);
  const fallback = base?.serialize as Serialize | undefined;
  return {
    ...base,
    name,
    serialize: (s, expr) => {
      const args = operands(expr);
      const written = wanted(s) && (listArgument || !args.some(isList)) ? write(s, args) : undefined;
      return written ?? fallback?.(s, expr) ?? s.serializeFunction(expr);
    },
  };
}

/** A constant written `traditional` when asked, `plain` otherwise. Only a symbol with a
 *  native entry: compute-engine never consults the dictionary to write any other. */
const constant = (name: string, plain: string, traditional: string): Entry => ({
  ...native(name),
  name,
  serialize: (s) => (wanted(s) ? traditional : plain),
});

const tex = (s: Serializer, x: MathJsonExpression | undefined): string => s.serialize(x ?? null);
const call = (s: Serializer, args: Args): string => `(${args.map((a) => tex(s, a)).join(", ")})`;

/** `symbol(args)` for a function of a fixed arity. */
const fn =
  (symbol: string, arity: number): Write =>
  (s, args) =>
    args.length === arity ? `${symbol}${call(s, args)}` : undefined;

/** `symbol_{n}`, or `symbol_{n}(x)` with a second argument. */
const indexed =
  (symbol: string): Write =>
  (s, [n, x, ...rest]) =>
    n === undefined || rest.length > 0
      ? undefined
      : `${symbol}_{${tex(s, n)}}${x === undefined ? "" : `(${tex(s, x)})`}`;

/** `symbol_{k}(x)`: the first argument an index, the rest the call. */
const subscripted =
  (symbol: string, arity: number): Write =>
  (s, [k, ...args]) =>
    k === undefined || args.length !== arity - 1 ? undefined : `${symbol}_{${tex(s, k)}}${call(s, args)}`;

const legendre: Write = (s, args) =>
  args.length === 2 ? `\\left(\\frac{${tex(s, args[0])}}{${tex(s, args[1])}}\\right)` : undefined;

/** Parenthesised as Wolfram does, so `(a^b \bmod n)` never reads as `a^{b \bmod n}`. */
const residue = (s: Serializer, x: MathJsonExpression, n: MathJsonExpression): string =>
  `\\left(${tex(s, x)}\\bmod ${tex(s, n)}\\right)`;

/** Knuth's notation for the partitions of a set, `n` over `k` in braces. A matrix, not
 *  `\\genfrac` or `\\atop`: MathLive has no `\\genfrac`, amsmath deprecates `\\atop`. */
const stacked =
  (open: string, close: string): Write =>
  (s, args) =>
    args.length === 2
      ? `\\left${open}\\begin{matrix}${tex(s, args[0])}\\\\${tex(s, args[1])}\\end{matrix}\\right${close}`
      : undefined;

/** A literal list of numbers, or `undefined`. */
const numbers = (x: MathJsonExpression | undefined): number[] | undefined => {
  if (!Array.isArray(x) || x[0] !== "List") return undefined;
  const items = (x as readonly unknown[]).slice(1);
  return items.every((e) => typeof e === "number") ? (items as number[]) : undefined;
};

/** A composition as it is subscripted: `(1,2)`, or `\\varnothing` for the empty one. */
const composition = (x: MathJsonExpression | undefined): string | undefined => {
  const parts = numbers(x);
  if (parts === undefined) return undefined;
  return parts.length === 0 ? "\\varnothing" : `(${parts.join(",")})`;
};

/** A basis element of a composition-indexed basis, `symbol_{(1,2)}`. */
const byComposition =
  (symbol: string): Write =>
  (_, [alpha, ...rest]) => {
    const index = rest.length === 0 ? composition(alpha) : undefined;
    return index === undefined ? undefined : `${symbol}_{${index}}`;
  };

/** A permutation in one-line notation as a subscript: `213`, or `[10,2,…]` past one digit. */
const oneLine = (x: MathJsonExpression | undefined): string | undefined => {
  const w = numbers(x);
  if (w === undefined) return undefined;
  return w.every((k) => k >= 0 && k <= 9) ? w.join("") : `[${w.join(",")}]`;
};

/** A family of algebras on `n` strands, `symbol_{n}`, or `symbol_{n}(\\delta)` with a parameter. */
const algebra =
  (symbol: string): Write =>
  (s, [n, parameter, ...rest]) =>
    n === undefined || rest.length > 0
      ? undefined
      : `${symbol}_{${tex(s, n)}}${parameter === undefined ? "" : `(${tex(s, parameter)})`}`;

/** A literal `AdicNumeral(p, x, …)` as its prime and value: `v_p(x)` names the prime once. */
const adic = (x: MathJsonExpression | undefined): { p: number; value: MathJsonExpression } | undefined =>
  Array.isArray(x) && x[0] === "AdicNumeral" && typeof x[1] === "number" && x[2] !== undefined
    ? { p: x[1], value: x[2] as MathJsonExpression }
    : undefined;

/** A knot invariant of `K` in `t`: `symbol_{K}(t)`. */
const invariant =
  (symbol: string): Write =>
  (s, [k, ...rest]) =>
    k === undefined || rest.length > 0 ? undefined : `${symbol}_{${tex(s, k)}}(t)`;

export const TRADITIONAL_LATEX: readonly Entry[] = [
  // Sequences, by index.
  head("Fibonacci", indexed("F")),
  head("LucasL", indexed("L")),
  head("CatalanNumber", indexed("C")),
  head("BellNumber", indexed("B")),
  head("BernoulliB", indexed("B")),
  head("NthPrime", indexed("p")),
  head("StieltjesGamma", indexed("\\gamma")),
  head("HarmonicNumber", (s, [n, r, ...rest]) =>
    n === undefined || rest.length > 0 ? undefined : `H_{${tex(s, n)}}${r === undefined ? "" : `^{(${tex(s, r)})}`}`,
  ),
  // Arithmetic functions.
  head("MoebiusMu", fn("\\mu", 1)),
  head("Totient", fn("\\varphi", 1)),
  head("PrimePi", fn("\\pi", 1)),
  head("PrimeNu", fn("\\omega", 1)),
  head("PrimeOmega", fn("\\Omega", 1)),
  head("CarmichaelLambda", fn("\\lambda", 1)),
  head("DivisorSigma", subscripted("\\sigma", 2)),
  head("MultiplicativeOrder", (s, [a, n, ...rest]) =>
    a === undefined || n === undefined || rest.length > 0
      ? undefined
      : `\\operatorname{ord}_{${tex(s, n)}}(${tex(s, a)})`,
  ),
  head("PowerMod", (s, [a, b, n, ...rest]) =>
    a === undefined || b === undefined || n === undefined || rest.length > 0
      ? undefined
      : residue(s, ["Power", a, b], n),
  ),
  head("ModularInverse", (s, [a, n, ...rest]) =>
    a === undefined || n === undefined || rest.length > 0
      ? undefined
      : `\\left(${s.wrapShort(a)}^{-1}\\bmod ${tex(s, n)}\\right)`,
  ),
  head("JacobiSymbol", legendre),
  head("KroneckerSymbol", legendre),
  head("LegendreSymbol", legendre),
  // Special functions.
  head("Digamma", fn("\\psi", 1)),
  head("PolyGamma", (s, [n, z, ...rest]) =>
    n === undefined || z === undefined || rest.length > 0 ? undefined : `\\psi^{(${tex(s, n)})}(${tex(s, z)})`,
  ),
  head("GammaLn", fn("\\log\\Gamma", 1)),
  head("LogGamma", fn("\\log\\Gamma", 1)),
  head("BarnesG", fn("G", 1)),
  head("LogBarnesG", fn("\\log G", 1)),
  head("LerchPhi", fn("\\Phi", 3)),
  head("HurwitzZeta", fn("\\zeta", 2)),
  head("DirichletEta", fn("\\eta", 1)),
  head("DirichletBeta", fn("\\beta", 1)),
  head("DirichletCharacter", (s, [k, j, n, ...rest]) =>
    k === undefined || j === undefined || n === undefined || rest.length > 0
      ? undefined
      : `\\chi_{${tex(s, k)},${tex(s, j)}}(${tex(s, n)})`,
  ),
  head("DirichletL", (s, [k, j, z, ...rest]) =>
    k === undefined || j === undefined || z === undefined || rest.length > 0
      ? undefined
      : `L(${tex(s, z)}, \\chi_{${tex(s, k)},${tex(s, j)}})`,
  ),
  head("Erfc", fn("\\operatorname{erfc}", 1)),
  head("ErfInv", fn("\\operatorname{erf}^{-1}", 1)),
  head("GammaRegularized", fn("Q", 2)),
  head("BetaRegularized", subscripted("I", 3)),
  head("ClausenCl", subscripted("\\operatorname{Cl}", 2)),
  // Combinatorial.
  head("Pochhammer", (s, [a, n, ...rest]) =>
    a === undefined || n === undefined || rest.length > 0 ? undefined : `\\left(${tex(s, a)}\\right)_{${tex(s, n)}}`,
  ),
  head("RisingFactorial", (s, [x, n, ...rest]) =>
    x === undefined || n === undefined || rest.length > 0 ? undefined : `${s.wrapShort(x)}^{\\overline{${tex(s, n)}}}`,
  ),
  head("FallingFactorial", (s, [x, n, ...rest]) =>
    x === undefined || n === undefined || rest.length > 0 ? undefined : `${s.wrapShort(x)}^{\\underline{${tex(s, n)}}}`,
  ),
  head("Multinomial", (s, args) => {
    if (args.length < 2) return undefined;
    const total = args.every((a) => typeof a === "number")
      ? String((args as number[]).reduce((x, y) => x + y, 0))
      : tex(s, ["Add", ...args]);
    return `\\binom{${total}}{${args.map((a) => tex(s, a)).join(",")}}`;
  }),
  head("Stirling", stacked("\\lbrace", "\\rbrace")),
  // Signed, as Wolfram's StirlingS1: lowercase s, not Knuth's unsigned brackets.
  head("StirlingS1", fn("s", 2)),
  head("Subfactorial", (s, [n, ...rest]) => (n === undefined || rest.length > 0 ? undefined : `{!}${s.wrapShort(n)}`)),
  // enumeratio's own heads, where the mathematics has a settled notation.
  // Valuations and norms, p taken from a literal numeral.
  head("IntegerExponent", (s, [n, b, ...rest]) =>
    n === undefined || rest.length > 0 ? undefined : `v_{${b === undefined ? "10" : tex(s, b)}}(${tex(s, n)})`,
  ),
  head("AdicValuation", (s, [x, ...rest]) => {
    const a = adic(x);
    return a === undefined || rest.length > 0 ? undefined : `v_{${a.p}}(${tex(s, a.value)})`;
  }),
  head("AdicNorm", (s, [x, ...rest]) => {
    const a = adic(x);
    return a === undefined || rest.length > 0 ? undefined : `\\left|${tex(s, a.value)}\\right|_{${a.p}}`;
  }),
  // Algebras and their bases.
  head("CliffordAlgebra", (s, [p, q, ...rest]) =>
    p === undefined || q === undefined || rest.length > 0
      ? undefined
      : `\\operatorname{Cl}_{${tex(s, p)},${tex(s, q)}}(\\mathbb{R})`,
  ),
  head("MulticomplexAlgebra", indexed("\\mathbb{C}")),
  head("AlgebraDimension", fn("\\dim", 1)),
  head("PartitionAlgebra", algebra("P")),
  head("PlanarPartitionAlgebra", algebra("PP")),
  head("BrauerAlgebra", algebra("B")),
  head("TemperleyLiebAlgebra", algebra("\\mathrm{TL}")),
  head("MotzkinAlgebra", algebra("M")),
  head("RookAlgebra", algebra("R")),
  head("SymmetricGroupAlgebra", (s, [n, ...rest]) =>
    n === undefined || rest.length > 0 ? undefined : `k[S_{${tex(s, n)}}]`,
  ),
  head("HeckeAlgebra", (s, [n, ...rest]) => (n === undefined || rest.length > 0 ? undefined : `H_{${tex(s, n)}}(q)`)),
  head(
    "HeckeT",
    (_, [w, ...rest]) => {
      const index = rest.length === 0 ? oneLine(w) : undefined;
      return index === undefined ? undefined : `T_{${index}}`;
    },
    true,
  ),
  head("QSymM", byComposition("M"), true),
  head("QSymF", byComposition("F"), true),
  head("NSymH", byComposition("H"), true),
  head("NSymR", byComposition("R"), true),
  head("Coproduct", fn("\\Delta", 1)),
  head("Counit", fn("\\varepsilon", 1)),
  head("Antipode", fn("S", 1)),
  head("HopfTensor", (s, args) => (args.length < 2 ? undefined : args.map((a) => s.wrap(a, 390)).join("\\otimes "))),
  // Posets and their incidence algebras.
  head("DivisorLattice", indexed("D")),
  head("BooleanLattice", indexed("B")),
  head("Chain", indexed("C")),
  head("IncidenceAlgebra", fn("I", 1)),
  head("MoebiusFunction", (s, [poset, x, y, ...rest]) =>
    poset === undefined || x === undefined || y === undefined || rest.length > 0
      ? undefined
      : `\\mu_{${tex(s, poset)}}(${tex(s, x)}, ${tex(s, y)})`,
  ),
  // Quivers: the linearly oriented A_n, and the path algebra kQ.
  head("LinearQuiver", (s, [n, ...rest]) =>
    n === undefined || rest.length > 0 ? undefined : `\\vec{A}_{${tex(s, n)}}`,
  ),
  head("PathAlgebra", (s, [q, ...rest]) => (q === undefined || rest.length > 0 ? undefined : `k${tex(s, q)}`)),
  // Groups.
  head("CyclicGroup", indexed("C")),
  head("DihedralGroup", indexed("D")),
  head("GroupDirectProduct", (s, args) => (args.length < 2 ? undefined : args.map((a) => tex(s, a)).join("\\times "))),
  head("GroupAlgebra", (s, [g, ...rest]) => (g === undefined || rest.length > 0 ? undefined : `k[${tex(s, g)}]`)),
  head("GroupOrder", (s, [g, ...rest]) =>
    g === undefined || rest.length > 0 ? undefined : `\\left|${tex(s, g)}\\right|`,
  ),
  // The modular group.
  head("ModularMatrix", (s, args) =>
    args.length === 4
      ? `\\begin{pmatrix}${tex(s, args[0])}&${tex(s, args[1])}\\\\${tex(s, args[2])}&${tex(s, args[3])}\\end{pmatrix}`
      : undefined,
  ),
  head("DedekindSum", fn("s", 2)),
  head("FormClassNumber", fn("h", 1)),
  head("RademacherPhi", fn("\\Phi", 1)),
  head("RademacherSymbol", fn("\\Psi", 1)),
  // Braids and knots.
  head(
    "Braid",
    (_, [n, word, ...rest]) => {
      const letters = numbers(word);
      if (n === undefined || letters === undefined || rest.length > 0) return undefined;
      if (letters.length === 0) return "1";
      // A run of one generator is its power: σ₁σ₁σ₁ is σ₁³, σ₂⁻¹σ₂⁻¹ is σ₂⁻².
      const runs: [number, number][] = [];
      for (const k of letters) {
        const last = runs.at(-1);
        if (last !== undefined && last[0] === k) last[1]++;
        else runs.push([k, 1]);
      }
      return runs
        .map(([k, times]) => {
          const power = Math.sign(k) * times;
          return `\\sigma_{${Math.abs(k)}}${power === 1 ? "" : `^{${power}}`}`;
        })
        .join("");
    },
    true,
  ),
  head("BraidPower", (s, [b, k, ...rest]) =>
    b === undefined || k === undefined || rest.length > 0 ? undefined : `\\left(${tex(s, b)}\\right)^{${tex(s, k)}}`,
  ),
  head("TorusBraid", (s, [p, q, ...rest]) =>
    p === undefined || q === undefined || rest.length > 0 ? undefined : `T_{${tex(s, p)},${tex(s, q)}}`,
  ),
  head("PretzelKnot", (s, args) => (args.length < 1 ? undefined : `P${call(s, args)}`)),
  head("AlexanderPolynomial", invariant("\\Delta")),
  head("JonesPolynomial", invariant("V")),
  head("KauffmanBracket", (s, [k, ...rest]) =>
    k === undefined || rest.length > 0 ? undefined : `\\langle ${tex(s, k)}\\rangle`,
  ),
  head("SeifertGenus", fn("g", 1)),
  head("BraidWrithe", fn("w", 1)),
  // Constants and truth values.
  constant("True", "\\top", "\\mathrm{True}"),
  constant("False", "\\bot", "\\mathrm{False}"),
];

/** `expr` in traditional notation (dictionaries written out, as `latexOf` does). */
export function traditionalLatexOf(ce: ComputeEngine, expr: BoxedExpression): string {
  return latexOf(ce, expr, { [TRADITIONAL]: true });
}

/** A MathJSON value in traditional notation. */
export function toTraditionalLatex(node: unknown, ce: ComputeEngine): string {
  return traditionalLatexOf(ce, ce.box(node as Parameters<ComputeEngine["box"]>[0]));
}
