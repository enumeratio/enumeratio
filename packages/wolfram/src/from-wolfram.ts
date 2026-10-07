// Wolfram Language full-form source → MathJSON. Inverse of `toWolfram`: a small
// recursive-descent parser over `Head[args]` syntax (plus `{...}` list sugar),
// reversing the same `HEADS`/`SYMBOLS` maps `toWolfram` uses so the two stay in
// sync. Reads what a kernel prints as `FullForm` — including precision marks and
// `*^` exponents — so a kernel's answer can be boxed and compared structurally.
// Pure (string in, MathJSON out): no compute-engine dependency.

import { NAMED_CHARACTERS } from "./named-characters.ts";
import { CONTEXT, HEADS, type MathJson, SYMBOLS } from "./to-wolfram.ts";

/** Strip the context off a name `toWolfram` qualified to keep it out of `System``. */
const unqualify = (name: string): string => (name.startsWith(CONTEXT) ? name.slice(CONTEXT.length) : name);

/** Wolfram's domains that are restrictions of `RealNumbers`, read as the interval they are: ours has no
 * head for them. Read-only; an interval does not print back as one of these. */
export const READ_SYMBOLS: Readonly<Record<string, MathJson>> = {
  PositiveReals: ["Interval", ["Open", 0], "PositiveInfinity"],
  NonNegativeReals: ["Interval", 0, "PositiveInfinity"],
  NegativeReals: ["Interval", "NegativeInfinity", ["Open", 0]],
  NonPositiveReals: ["Interval", "NegativeInfinity", 0],
};

/** Wolfram spelling → compute-engine symbol constant. Reverse of `SYMBOLS`. */
const REVERSE_SYMBOLS: Record<string, string> = Object.fromEntries(Object.entries(SYMBOLS).map(([ce, wl]) => [wl, ce]));

/**
 * Where two compute-engine heads share a Wolfram spelling, which one `fromWolfram` should
 * read it back as -- an ambiguity `HEADS`'s own comments called out by hand (e.g. "the reverse
 * map keeps GammaLn, first entry wins" for `LogGamma`/`GammaLn`). `HEADS` is generated now
 * (symbol-metadata step 4: `wolfram-names-data.ts`, alphabetical), so "first entry wins" no
 * longer picks a stable side; this table is the explicit version of the same calls.
 */
const REVERSE_PREFERRED: Readonly<Record<string, string>> = {
  List: "List", // not Tuple
  Log2: "Log2", // not Lb
  BernoulliB: "BernoulliB", // not BernoulliPolynomial
  Pochhammer: "Pochhammer", // not RisingFactorial
  FactorialPower: "FallingFactorial", // not FactorialPower itself
  JacobiSymbol: "JacobiSymbol", // not LegendreSymbol
  LogGamma: "GammaLn", // not LogGamma itself -- GammaLn is what LogGamma lowers to
  PolyGamma: "Digamma", // not PolyGamma itself
  MixedRadix: "MixedRadixNumerals", // not MixedRadix itself
  Re: "Real", // compute-engine canonicalises Re to Real, so an answer holds `Real(x)`
};

/** Wolfram head → compute-engine head. Reverse of `HEADS`, with `REVERSE_PREFERRED`'s nine
 * ties broken explicitly rather than by iteration order. */
export const REVERSE_HEADS: Record<string, string> = {};
for (const [ce, wl] of Object.entries(HEADS)) {
  if (!(wl in REVERSE_HEADS)) REVERSE_HEADS[wl] = ce;
}
for (const [wl, ce] of Object.entries(REVERSE_PREFERRED)) REVERSE_HEADS[wl] = ce;

// Parser state. `fromWolfram` is not reentrant/concurrent, matching the scope
// of this small a grammar.
let src = "";
let pos = 0;
let keepTags = false;

/** What `fromWolfram` can be asked for beyond the expression itself. */
export interface FromWolframOptions {
  /** Keep a real's precision (`` x`15.95 ``) or accuracy (`` x``69.3 ``) mark, as a `precision` or
   * `accuracy` key on its `{ num }`, instead of dropping it: what the number vouches for. */
  readonly tags?: boolean;
}

/** Parse a Wolfram Language full-form expression into a MathJSON value. */
export function fromWolfram(input: string, options: FromWolframOptions = {}): MathJson {
  src = input;
  pos = 0;
  keepTags = options.tags === true;
  const result = parseExpr();
  skipWs();
  if (pos < src.length) {
    throw new Error(`fromWolfram: unexpected trailing input at ${pos}: ${JSON.stringify(src.slice(pos))}`);
  }
  return result;
}

/** An expression, with the one infix form a kernel's answer can still carry inside `FullForm`
 * output: a rule, `lhs -> rhs` / `lhs :> rhs` (right-associative), as in a Graph's trailing
 * `{GraphLayout -> "StarEmbedding"}` options. */
function parseExpr(): MathJson {
  const lhs = parsePrimary();
  skipWs();
  for (const [op, head] of [
    ["->", "Rule"],
    [":>", "RuleDelayed"],
  ] as const) {
    if (src.startsWith(op, pos)) {
      pos += op.length;
      return applyHead(head, [lhs, parseExpr()]);
    }
  }
  return lhs;
}

function parsePrimary(): MathJson {
  skipWs();
  const ch = peek();

  if (ch === '"') return parseString();
  if (ch === "{") return parseList();
  if (ch === "-" && /[0-9]/.test(src[pos + 1] ?? "")) return parseNumber();
  if (/[0-9]/.test(ch)) return parseNumber();
  // `toWolfram` emits `NegativeInfinity` as the raw text "-Infinity" rather than
  // a proper expression; recognise it as a single token so it round-trips.
  if (src.startsWith("-Infinity", pos) && !/[A-Za-z0-9$]/.test(src[pos + "-Infinity".length] ?? "")) {
    pos += "-Infinity".length;
    return "NegativeInfinity";
  }
  if (/[A-Za-z$]/.test(ch)) return parseSymbolOrCall();
  if (ch === "_") return parseBlank();

  throw new Error(`fromWolfram: unexpected character ${JSON.stringify(ch)} at ${pos}`);
}

/** Integer, real (`2.`, `2.5`), with an optional precision mark (`` 2.5`20. ``), accuracy mark
 * (`` 0``69.3 ``) and `*^n` exponent — every number shape `FullForm` prints. The mark is dropped
 * unless `tags` asks for it (`FromWolframOptions`), which keeps the digits as text too: a real
 * past double range (`9.9*^301029`) has no number to be. */
function parseNumber(): MathJson {
  const re = /-?\d+(\.\d*)?(?:(`{1,2})([\d.]*))?(\*\^[+-]?\d+)?/y;
  re.lastIndex = pos;
  const m = re.exec(src);
  if (!m) throw new Error(`fromWolfram: expected a number at ${pos}`);
  pos = re.lastIndex;
  const [, , ticks, marked] = m;
  const text = m[0].replace(/`+[\d.]*/, "").replace("*^", "e");
  const strength = Number(marked);
  if (!keepTags || ticks === undefined || marked === "" || !Number.isFinite(strength)) return Number(text);
  return ticks === "``" ? { num: text, accuracy: strength } : { num: text, precision: strength };
}

/** A Wolfram string literal, as the `'quoted'` MathJSON shorthand compute-engine's
 * own serialisation uses (and `toWolfram` reads). */
function parseString(): MathJson {
  expect('"');
  let out = "";
  while (peek() !== '"') {
    if (pos >= src.length) throw new Error("fromWolfram: unterminated string literal");
    out += peek() === "\\" ? src[pos++] + src[pos++] : src[pos++];
  }
  expect('"');
  return `'${unescapeString(out)}'`;
}

/** A string literal's escapes: JSON's (`toWolfram` writes strings via JSON.stringify), plus
 * Wolfram's own `\:XXXX` (a UTF-16 unit), `\|XXXXXX` (a code point) and `\[Name]` (a named
 * character, `NAMED_CHARACTERS`), which a kernel prints for characters outside its output encoding
 * (`FromCharacterCode[128512]` is `"\|01f600"`, `FromCharacterCode[62520]` is `"\[Limit]"`). */
const unescapeString = (raw: string): string =>
  JSON.parse(
    `"${raw.replace(
      /\\(\\|:([0-9a-fA-F]{4})|\|([0-9a-fA-F]{6})|\[([A-Za-z][A-Za-z0-9]*)\])/g,
      (whole, _, unit?: string, point?: string, name?: string) => {
        const code = name === undefined ? undefined : NAMED_CHARACTERS[name];
        if (name !== undefined) {
          return code === undefined ? `\\\\[${name}]` : JSON.stringify(String.fromCodePoint(code)).slice(1, -1);
        }
        return unit !== undefined
          ? `\\u${unit}`
          : point !== undefined
            ? JSON.stringify(String.fromCodePoint(Number.parseInt(point, 16))).slice(1, -1)
            : whole;
      },
    )}"`,
  ) as string;

/** A blank pattern with no pattern name — `_`, `__`, `___`, each optionally with a head
 * (`_Integer`). `toWolfram` passes such a MathJSON wildcard through as written (see
 * `symbolToWolfram`), so it comes back as the same string. */
function parseBlank(): MathJson {
  const re = /_{1,3}(?:[A-Za-z$][A-Za-z0-9$]*)?/y;
  re.lastIndex = pos;
  const m = re.exec(src)!;
  pos = re.lastIndex;
  return m[0];
}

function parseList(): MathJson {
  expect("{");
  const items = parseArgs("}");
  expect("}");
  return ["List", ...items];
}

function parseSymbolOrCall(): MathJson {
  // A backtick separates a context from a name (`` enumeratio`Area ``), which is how our
  // own heads stay out of `System``. Wolfram allows a nested path, so match any number.
  const re = /[A-Za-z$][A-Za-z0-9$]*(?:`[A-Za-z$][A-Za-z0-9$]*)*/y;
  re.lastIndex = pos;
  const m = re.exec(src);
  if (!m) throw new Error(`fromWolfram: expected an identifier at ${pos}`);
  pos = re.lastIndex;
  const name = m[0];

  skipWs();
  if (peek() === "[") {
    pos++;
    const args = parseArgs("]");
    expect("]");
    // `Derivative[n][f]` is one head applied to `f`; any further `[x]` applies the result.
    let applied: MathJson;
    if (name === "Derivative" && peek() === "[") {
      pos++;
      const operand = parseArgs("]");
      expect("]");
      applied = ["Derivative", ...operand, ...args];
    } else applied = applyHead(name, args);
    while (peek() === "[") {
      pos++;
      const more = parseArgs("]");
      expect("]");
      applied = ["Apply", applied, ...more];
    }
    return applied;
  }
  // Truth values round-trip as the MathJSON symbol strings "True"/"False", matching how
  // this codebase writes them elsewhere (option values, etc.) — not JS booleans.
  if (name === "True") return "True";
  if (name === "False") return "False";
  return READ_SYMBOLS[name] ?? REVERSE_SYMBOLS[name] ?? REVERSE_HEADS[name] ?? unqualify(name);
}

function parseArgs(closer: string): MathJson[] {
  const args: MathJson[] = [];
  skipWs();
  if (peek() === closer) return args;
  args.push(parseExpr());
  skipWs();
  while (peek() === ",") {
    pos++;
    args.push(parseExpr());
    skipWs();
  }
  return args;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/** `p/q` as a MathJSON number. */
const ratio = (p: number, q: number): MathJson => {
  const d = gcd(p, q) || 1;
  return q / d === 1 ? p / d : ["Rational", p / d, q / d];
};

/**
 * `SeriesData[x, x0, {a0, a1, …}, nmin, nmax, den]`, the kernel's series object: the terms
 * `a_k (x - x0)^((nmin + k)/den)` and `O((x - x0)^(nmax/den))`, as the sum our `Series` answers with.
 */
function seriesData(args: MathJson[]): MathJson | undefined {
  const [x, x0, coefficients, nmin, nmax, den] = args;
  if (!isList(coefficients) || typeof nmin !== "number" || typeof nmax !== "number" || typeof den !== "number")
    return undefined;
  const base: MathJson = x0 === 0 ? x! : ["Subtract", x!, x0!];
  const power = (p: number): MathJson => (p === 0 ? 1 : p === den ? base : ["Power", base, ratio(p, den)]);
  const terms: MathJson[] = [];
  coefficients.slice(1).forEach((a, k) => {
    if (a === 0) return;
    const p = power(nmin + k);
    terms.push(p === 1 ? a : a === 1 ? p : ["Multiply", a, p]);
  });
  terms.push(["BigO", power(nmax)]);
  return terms.length === 1 ? terms[0]! : ["Add", ...terms];
}

/** Wolfram names read by call shape, or into a head ours spells differently: `undefined` if none. */
function applyNamed(name: string, args: MathJson[]): MathJson | undefined {
  switch (name) {
    // `Series[f, {x, x0, n}]`.
    case "Series": {
      const it = args[1];
      return args.length === 2 && isList(it) && it.length === 4
        ? ["Series", args[0]!, it[1]!, it[2]!, it[3]!]
        : undefined;
    }
    case "SeriesData":
      return seriesData(args);
    // `Residue[f, {z, z0}]`.
    case "Residue": {
      const it = args[1];
      return args.length === 2 && isList(it) && it.length === 3 ? ["Residue", args[0]!, it[1]!, it[2]!] : undefined;
    }
    // `Insert[list, x, n]` puts the element before the position.
    case "Insert":
      return args.length === 3 ? ["Insert", args[0]!, args[2]!, args[1]!] : undefined;
    // `UnsameQ` is every pair distinct.
    case "UnsameQ": {
      const pairs = args.flatMap((a, i) => args.slice(i + 1).map((b) => ["Not", ["Same", a, b]] as MathJson));
      return pairs.length === 1 ? pairs[0] : pairs.length > 1 ? ["And", ...pairs] : "True";
    }
    // Wolfram's equation and inequality `Reduce`; ours is the fold.
    case "Reduce":
      return ["ReduceConditions", ...args];
    // `Root[p, k]` is a polynomial's root object; ours is the nth root.
    case "Root":
      return ["PolynomialRoot", ...args];
    // The partition number is a count.
    case "PartitionsP":
      return args.length === 1 ? ["Count", ["IntegerPartitions", args[0]!]] : undefined;
    // `Signature[perm]` is the sign of a permutation.
    case "Signature":
      return args.length === 1 && isList(args[0]) ? ["Sign", ["Permutation", args[0]]] : undefined;
    // `ProductLog[k, z]` puts the branch first.
    case "ProductLog":
      return args.length === 2 ? ["LambertW", args[1]!, args[0]!] : undefined;
    // `Modulus -> p` is working over the integers mod `p`.
    case "Rule":
      return args.length === 2 && args[0] === "Modulus"
        ? ["KeyValuePair", "Over", ["QuotientRing", "Integers", args[1]!]]
        : undefined;
    default:
      return undefined;
  }
}

const isList = (node: MathJson): node is MathJson[] => Array.isArray(node) && node[0] === "List";
/** A bare identifier or a non-negative integer — what can sit either side of a `_`. */
const isPlain = (node: MathJson): node is string | number =>
  (typeof node === "string" && /^[A-Za-z][A-Za-z0-9]*$/.test(node)) ||
  (typeof node === "number" && Number.isInteger(node) && node >= 0);

/** The structural forms `toWolfram` emits, reversed where the shape is unambiguous.
 *
 * `Log[b, z]` reverses compute-engine's arg-swap back to `["Log", z, b]`; the 1-arg
 * form `Log[x]` is natural log, compute-engine `["Ln", x]`. Not invertible: the 1-arg
 * base-10 `Log(x)` serialises to `Log[10, x]`, which parses back as an explicit base.
 * Likewise `Union[{…}]` reads as a Union, not a `Set`; and `Root`, `Square`, `Mode`,
 * `IndexOf`, `Degrees` come back as the Wolfram expression they were lowered to. Those directions are lossy by
 * construction and aren't reconstructed. */
function applyHead(name: string, args: MathJson[]): MathJson {
  const named = applyNamed(name, args);
  if (named !== undefined) return named;
  if (name === "Log" && args.length === 1) return ["Ln", args[0]];
  if (name === "Log" && args.length === 2) return ["Log", args[1], args[0]];
  // Divisible(n, m) is "n is divisible by m"; our Divides(a, b) is "a divides b" —
  // same relation, arguments swapped.
  if (name === "Divisible" && args.length === 2) return ["Divides", args[1], args[0]];
  // Digamma is the 1-arg PolyGamma; the 2-arg form is compute-engine's PolyGamma too.
  if (name === "PolyGamma") return [args.length === 1 ? "Digamma" : "PolyGamma", ...args];
  // The incomplete elliptic integrals are Wolfram's EllipticE/EllipticF with an amplitude (2 arguments)
  // and EllipticPi with one (3).
  if ((name === "EllipticE" || name === "EllipticF") && args.length === 2) return [`Incomplete${name}`, ...args];
  if (name === "EllipticPi" && args.length === 3) return ["IncompleteEllipticPi", ...args];
  // `Function[x, body]` and `Function[{x, y}, body]` put the parameters first; compute-engine's
  // `Function` is `[body, ...params]`. Read the other way, `x` is taken for the body.
  if (name === "Function" && args.length === 2) {
    return ["Function", args[1], ...(isList(args[0]) ? args[0].slice(1) : [args[0]])];
  }
  // Midpoint[{p, q}] is our Midpoint(p, q).
  if (name === "Midpoint" && args.length === 1 && isList(args[0]) && args[0].length === 3) {
    return ["Midpoint", args[0][1], args[0][2]];
  }
  // Always `_n`, so compute-engine's bare `_` comes back as `_1`.
  if (name === "Slot" && args.length === 1 && typeof args[0] === "number") return `_${args[0]}`;
  if (name === "Subscript" && args.length === 2 && isPlain(args[0]) && isPlain(args[1])) {
    return `${args[0]}_${args[1]}`;
  }
  if (name === "Clip") {
    const range = args[1];
    return args.length === 2 && isList(range) && range.length === 3
      ? ["Clamp", args[0], range[1], range[2]]
      : ["Clamp", ...args];
  }
  if (name === "Total" && args.length === 1) return ["Sum", args[0]];
  // An iterator `{k, a, b}` is a Tuple on the compute-engine side, not a List.
  if ((name === "Sum" || name === "Product") && args.length >= 2) {
    return [name, args[0], ...args.slice(1).map((it) => (isList(it) ? ["Tuple", ...it.slice(1)] : it))];
  }
  if (name === "Integrate" && args.length >= 2) {
    return [name, args[0], ...args.slice(1).map((it) => (isList(it) ? ["Limits", ...it.slice(1)] : it))];
  }
  if (name === "Interval" && args.length === 1 && isList(args[0]) && args[0].length === 3) {
    return ["Interval", args[0][1], args[0][2]];
  }
  // Mod[a, n, d] is the residue in [d, d + n): d + Mod(a - d, n).
  if (name === "Mod" && args.length === 3) {
    return ["Add", args[2], ["Mod", ["Subtract", args[0], args[2]], args[1]]];
  }
  if (name === "Apply" && args.length === 2 && args[0] === "Multiply") return ["Product", args[1]];
  // `FullForm` spells the infinities as `DirectedInfinity[±1]` and `DirectedInfinity[]`.
  if (name === "DirectedInfinity") {
    if (args.length === 0) return "ComplexInfinity";
    if (args[0] === 1) return "PositiveInfinity";
    if (args[0] === -1) return "NegativeInfinity";
  }
  return [REVERSE_HEADS[name] ?? unqualify(name), ...args];
}

function peek(): string {
  return src[pos] ?? "";
}

function skipWs(): void {
  while (/\s/.test(src[pos] ?? "")) pos++;
}

function expect(ch: string): void {
  if (src[pos] !== ch) {
    throw new Error(`fromWolfram: expected "${ch}" at ${pos}, got ${JSON.stringify(src.slice(pos, pos + 10))}`);
  }
  pos++;
}
