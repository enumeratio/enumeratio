// MathMLForm -- an expression printed as presentation MathML. Output only: there is
// no parser on the other side, so the emitter owes nothing to round-tripping and can
// pick whatever typesetting reads best. It is a pure function of the MathJSON tree
// (no engine, no canonicalization): the same tree always prints the same string,
// attributes in a fixed order, so the output can be golden-tested.
//
// Parenthesization is precedence-driven, the way a TraditionalForm printer works:
// every node reports how tightly it binds, and a parent wraps a child in `<mo>(</mo>
// … <mo>)</mo>` only when the child binds looser than the slot it is going into.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";

export interface MathMLOptions {
  /** `display="block"` on the `<math>` root (default inline). */
  display?: "block" | "inline";
  /** Emit the bare `<mrow>` content without the `<math>` root. */
  fragment?: boolean;
}

// Binding strength, loosest to tightest. A node binding at `ATOM` never needs parens.
const OR = 1;
const AND = 2;
const NOT = 3;
const RELATION = 4;
const ADD = 5;
const MULTIPLY = 6;
const ATOM = 7;

interface Emitted {
  ml: string;
  prec: number;
  /** Prints with a leading minus sign (a `Negate`, or a negative literal). */
  negative?: boolean;
  /** Prints as a bare number (`<mn>`), which decides the multiplication sign. */
  numeric?: boolean;
}

const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mi = (s: string): string => `<mi>${escape(s)}</mi>`;
const mn = (s: string): string => `<mn>${escape(s)}</mn>`;
const mo = (s: string): string => `<mo>${escape(s)}</mo>`;
const mtext = (s: string): string => `<mtext>${escape(s)}</mtext>`;
const mrow = (...parts: string[]): string => `<mrow>${parts.join("")}</mrow>`;
const fenced = (open: string, body: string, close: string): string =>
  mrow(open ? mo(open) : "", body, close ? mo(close) : "");

const INVISIBLE_TIMES = "<mo>&#x2062;</mo>";
const APPLY_FUNCTION = "<mo>&#x2061;</mo>";
const MINUS = "−";

const atom = (ml: string, extra: Partial<Emitted> = {}): Emitted => ({ ml, prec: ATOM, ...extra });
const paren = (e: Emitted, min: number): string => (e.prec < min ? fenced("(", e.ml, ")") : e.ml);
/** Like `paren`, but a leading minus also gets fenced: `a − (−b)`, not `a − −b`. */
const operand = (e: Emitted, min: number): string =>
  e.negative ? fenced("(", e.ml, ")") : paren(e, min);
const list = (items: Emitted[], sep = ","): string => items.map((e) => e.ml).join(mo(sep));

const SYMBOLS: Record<string, string> = {
  Pi: "π",
  ExponentialE: "e",
  ImaginaryUnit: "i",
  EulerGamma: "γ",
  GoldenRatio: "φ",
  CatalanConstant: "G",
  Infinity: "∞",
  PositiveInfinity: "∞",
  ComplexInfinity: "∞̃",
  Degrees: "°",
  True: "true",
  False: "false",
  Nothing: "",
  EmptySet: "∅",
  RealNumbers: "ℝ",
  Integers: "ℤ",
  RationalNumbers: "ℚ",
  ComplexNumbers: "ℂ",
  NonNegativeIntegers: "ℕ",
  Booleans: "𝔹",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ϵ",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  vartheta: "ϑ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  omicron: "ο",
  pi: "π",
  varpi: "ϖ",
  rho: "ρ",
  varrho: "ϱ",
  sigma: "σ",
  varsigma: "ς",
  tau: "τ",
  upsilon: "υ",
  phi: "ϕ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Alpha: "Α",
  Beta: "Β",
  Gamma: "Γ",
  Delta: "Δ",
  Epsilon: "Ε",
  Zeta: "Ζ",
  Eta: "Η",
  Theta: "Θ",
  Iota: "Ι",
  Kappa: "Κ",
  Lambda: "Λ",
  Mu: "Μ",
  Nu: "Ν",
  Xi: "Ξ",
  Omicron: "Ο",
  Rho: "Ρ",
  Sigma: "Σ",
  Tau: "Τ",
  Upsilon: "Υ",
  Phi: "Φ",
  Chi: "Χ",
  Psi: "Ψ",
  Omega: "Ω",
};

/** Heads that print as a named function with an upright name (`sin x`, `ln x`). */
const FUNCTIONS: Record<string, string> = {
  Sin: "sin",
  Cos: "cos",
  Tan: "tan",
  Cot: "cot",
  Sec: "sec",
  Csc: "csc",
  Arcsin: "arcsin",
  Arccos: "arccos",
  Arctan: "arctan",
  Arccot: "arccot",
  Arcsec: "arcsec",
  Arccsc: "arccsc",
  Sinh: "sinh",
  Cosh: "cosh",
  Tanh: "tanh",
  Coth: "coth",
  Sech: "sech",
  Csch: "csch",
  Arsinh: "arsinh",
  Arcosh: "arcosh",
  Artanh: "artanh",
  Ln: "ln",
  Log: "log",
  Lb: "lb",
  Lg: "lg",
  Gamma: "Γ",
  Max: "max",
  Min: "min",
  Gcd: "gcd",
  Lcm: "lcm",
  Sign: "sgn",
  Re: "Re",
  Im: "Im",
  Arg: "arg",
  Mod: "mod",
};

const RELATIONS: Record<string, string> = {
  Equal: "=",
  NotEqual: "≠",
  Less: "<",
  LessEqual: "≤",
  Greater: ">",
  GreaterEqual: "≥",
  Approx: "≈",
  Congruent: "≡",
  Element: "∈",
  NotElement: "∉",
  Subset: "⊂",
  SubsetEqual: "⊆",
  Superset: "⊃",
  SupersetEqual: "⊇",
};

/** Two-character delimiter strings (`"()"`, `"[]"`, …); `.` means no fence. */
const DELIMITERS: Record<string, [string, string]> = {
  "()": ["(", ")"],
  "[]": ["[", "]"],
  "{}": ["{", "}"],
  "||": ["|", "|"],
  "‖‖": ["‖", "‖"],
  "<>": ["⟨", "⟩"],
  "..": ["", ""],
};

const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

const opsOf = (node: unknown): unknown[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? fn.slice(1) : [];
};

/** A string literal's text: `"'abc'"`, `{str: "abc"}`; a bare symbol is not one. */
const stringOf = (node: unknown): string | undefined => {
  if (typeof node === "string") return /^'.*'$/s.test(node) ? node.slice(1, -1) : undefined;
  const s = (node as { str?: unknown })?.str;
  return typeof s === "string" ? s : undefined;
};

const symbolOf = (node: unknown): string | undefined => {
  if (typeof node === "string") return stringOf(node) === undefined ? node : undefined;
  const s = (node as { sym?: unknown })?.sym;
  return typeof s === "string" ? s : undefined;
};

const numberOf = (node: unknown): string | undefined => {
  if (typeof node === "number") return String(node);
  const n = (node as { num?: unknown })?.num;
  return typeof n === "number" ? String(n) : typeof n === "string" ? n : undefined;
};

/** `-2` as `2`; anything not a negative literal is undefined. */
const negatedLiteral = (node: unknown): string | undefined => {
  const n = numberOf(node);
  return n !== undefined && n.startsWith("-") && n !== "-Infinity" ? n.slice(1) : undefined;
};

/** The term an `Add` operand subtracts (`-2`, `Negate(x)`, `-3 x`), or undefined. */
function subtracted(node: unknown): unknown {
  const literal = negatedLiteral(node);
  if (literal !== undefined) return { num: literal };
  if (headOf(node) === "Negate") return opsOf(node)[0];
  if (headOf(node) === "Multiply") {
    const [first, ...rest] = opsOf(node);
    const literal = negatedLiteral(first);
    if (literal === undefined || rest.length === 0) return undefined;
    if (literal === "1") return rest.length === 1 ? rest[0] : ["Multiply", ...rest];
    return ["Multiply", { num: literal }, ...rest];
  }
  return undefined;
}

function emitNumber(text: string): Emitted {
  if (text === "NaN") return atom(mi("NaN"));
  if (text === "Infinity" || text === "+Infinity") return atom(mi("∞"));
  if (text === "-Infinity") return emitSymbol("NegativeInfinity");
  const negative = negatedLiteral({ num: text });
  if (negative !== undefined) {
    const inner = emitNumber(negative);
    return { ml: mrow(mo(MINUS), inner.ml), prec: MULTIPLY, negative: true, numeric: true };
  }
  const sci = /^([^eE]+)[eE]([+-]?\d+)$/.exec(text);
  if (sci) {
    const mantissa = emitNumber(sci[1]);
    const exponent = emitNumber(sci[2].replace(/^\+/, ""));
    const ml = mrow(mantissa.ml, mo("×"), `<msup>${mn("10")}${exponent.ml}</msup>`);
    return { ml, prec: MULTIPLY, numeric: true };
  }
  // `1.(3)` -- the parenthesised digits repeat; typeset with an overline.
  const repeating = /^(.*)\((\d+)\)$/.exec(text);
  if (repeating) {
    return atom(mrow(mn(repeating[1]), `<mover>${mn(repeating[2])}${mo("‾")}</mover>`), {
      numeric: true,
    });
  }
  return atom(mn(text), { numeric: true });
}

function emitSymbol(name: string): Emitted {
  if (name === "NegativeInfinity")
    return { ml: mrow(mo(MINUS), mi("∞")), prec: MULTIPLY, negative: true };
  if (name === "Half") return { ml: `<mfrac>${mn("1")}${mn("2")}</mfrac>`, prec: MULTIPLY };
  const mapped = SYMBOLS[name];
  if (mapped !== undefined) return atom(mi(mapped));
  // `x_1` -- an underscore in a symbol name is a subscript.
  const sub = /^([^_]+)_(.+)$/.exec(name);
  if (sub) {
    const script = /^\d+$/.test(sub[2]) ? mn(sub[2]) : emitSymbol(sub[2]).ml;
    return atom(`<msub>${emitSymbol(sub[1]).ml}${script}</msub>`);
  }
  return atom(mi(name));
}

function emitCall(name: string, ops: unknown[]): Emitted {
  const args = ops.map(emit);
  return atom(mrow(mi(name), APPLY_FUNCTION, fenced("(", list(args), ")")));
}

/** `Sum`/`Product`/`Integrate` bounds: `Limits(n, 1, 10)`, `Tuple(n, 1, 10)`, or bare `n`. */
function bounds(node: unknown): { variable?: Emitted; lower?: Emitted; upper?: Emitted } {
  const head = headOf(node);
  if (head === "Limits" || head === "Tuple" || head === "Triple" || head === "Pair") {
    const [variable, lower, upper] = opsOf(node);
    return {
      variable: variable === undefined ? undefined : emit(variable),
      lower: lower === undefined ? undefined : emit(lower),
      upper: upper === undefined ? undefined : emit(upper),
    };
  }
  return node === undefined ? {} : { variable: emit(node) };
}

/** Canonical trees wrap a summand or integrand in `Function(Block(body), x)`; unwrap it. */
function body(node: unknown): unknown {
  if (headOf(node) !== "Function") return node;
  const inner = opsOf(node)[0];
  return headOf(inner) === "Block" && opsOf(inner).length === 1 ? opsOf(inner)[0] : inner;
}

function bigOperator(symbol: string, node: unknown, over: unknown): string {
  const { variable, lower, upper } = bounds(over);
  const under = variable && lower ? mrow(variable.ml, mo("="), lower.ml) : (variable ?? lower)?.ml;
  const op = mo(symbol);
  if (under && upper) return `<munderover>${op}${under}${upper.ml}</munderover>`;
  if (under) return `<munder>${op}${under}</munder>`;
  return op;
}

function emitFunction(head: string, ops: unknown[]): Emitted {
  switch (head) {
    case "Add": {
      let ml = paren(emit(ops[0]), ADD); // left-associative: no parens on a leading sum
      for (const op of ops.slice(1)) {
        const term = subtracted(op);
        const e = emit(term === undefined ? op : term);
        ml += mo(term === undefined ? "+" : MINUS) + operand(e, ADD + 1);
      }
      return { ml: mrow(ml), prec: ADD };
    }

    case "Subtract": {
      const [a, b] = ops.map(emit);
      return { ml: mrow(paren(a, ADD), mo(MINUS), operand(b, ADD + 1)), prec: ADD };
    }

    case "Negate": {
      const e = emit(ops[0]);
      return { ml: mrow(mo(MINUS), operand(e, MULTIPLY)), prec: MULTIPLY, negative: true };
    }

    case "InvisibleOperator":
    case "Multiply": {
      // `-1 * x` is how a canonical tree spells a negation.
      if (ops.length > 1 && negatedLiteral(ops[0]) === "1") {
        return emitFunction("Negate", [ops.length === 2 ? ops[1] : ["Multiply", ...ops.slice(1)]]);
      }
      const factors = ops.map(emit);
      let ml = "";
      let previous: Emitted | undefined;
      for (const f of factors) {
        const wrapped = previous ? operand(f, MULTIPLY) : paren(f, MULTIPLY);
        // A number after a number (or a fraction) needs a visible dot; `2x` does not.
        if (previous) ml += previous.numeric && f.numeric ? mo("⋅") : INVISIBLE_TIMES;
        ml += wrapped;
        previous = f;
      }
      return { ml: mrow(ml), prec: MULTIPLY, negative: factors[0]?.negative };
    }

    case "Divide":
    case "Rational": {
      const [n, d] = ops.map(emit);
      if (d === undefined) return n;
      return {
        ml: `<mfrac>${n.ml}${d.ml}</mfrac>`,
        prec: MULTIPLY,
        numeric: n.numeric && d.numeric,
      };
    }

    case "Power": {
      const [base, exponent] = ops.map(emit);
      return atom(`<msup>${paren(base, ATOM)}${exponent.ml}</msup>`);
    }
    case "Square":
      return emitFunction("Power", [ops[0], 2]);
    case "Exp":
      return emitFunction("Power", ["ExponentialE", ops[0]]);

    case "Sqrt":
      return atom(`<msqrt>${emit(ops[0]).ml}</msqrt>`);
    case "Root": {
      const [radicand, index] = ops.map(emit);
      return atom(`<mroot>${radicand.ml}${index.ml}</mroot>`);
    }

    case "Subscript": {
      const [base, sub] = ops.map(emit);
      return atom(`<msub>${paren(base, ATOM)}${sub.ml}</msub>`);
    }
    case "Superscript": {
      const [base, sup] = ops.map(emit);
      return atom(`<msup>${paren(base, ATOM)}${sup.ml}</msup>`);
    }

    case "Abs":
      return atom(fenced("|", emit(ops[0]).ml, "|"));
    case "Norm":
      return atom(fenced("‖", emit(ops[0]).ml, "‖"));
    case "Floor":
      return atom(fenced("⌊", emit(ops[0]).ml, "⌋"));
    case "Ceil":
      return atom(fenced("⌈", emit(ops[0]).ml, "⌉"));
    case "Factorial":
      return atom(mrow(paren(emit(ops[0]), ATOM), mo("!")));
    case "Factorial2":
      return atom(mrow(paren(emit(ops[0]), ATOM), mo("!!")));

    // `Log(x, b)` -- the base goes in a subscript, `log_b x`.
    case "Log": {
      if (ops.length < 2) return emitCall("log", ops);
      const [x, base] = ops.map(emit);
      return atom(
        mrow(`<msub>${mi("log")}${base.ml}</msub>`, APPLY_FUNCTION, fenced("(", x.ml, ")")),
      );
    }

    case "Binomial": {
      const [n, k] = ops.map(emit);
      return atom(fenced("(", `<mfrac linethickness="0">${n.ml}${k.ml}</mfrac>`, ")"));
    }

    case "Complex": {
      const [re, im] = ops;
      const zero = (v: unknown) => numberOf(v) === "0";
      const one = (v: unknown) => numberOf(v) === "1";
      if (zero(re) && one(im)) return emitSymbol("ImaginaryUnit");
      if (zero(re)) return emitFunction("Multiply", [im, "ImaginaryUnit"]);
      return emitFunction("Add", [
        re,
        one(im) ? "ImaginaryUnit" : ["Multiply", im, "ImaginaryUnit"],
      ]);
    }

    case "List":
      return atom(fenced("[", list(ops.map(emit)), "]"));
    case "Set":
      return atom(fenced("{", list(ops.map(emit)), "}"));
    case "Tuple":
    case "Pair":
    case "Triple":
      return atom(fenced("(", list(ops.map(emit)), ")"));
    case "Sequence":
      return atom(mrow(list(ops.map(emit))));

    // `Delimiter(x)` keeps the parentheses the expression was written with; a second
    // argument names the pair (`"()"`, `"[]"`, …) and a third the separator.
    case "Delimiter": {
      const [open, close] = DELIMITERS[stringOf(ops[1]) ?? "()"] ?? ["(", ")"];
      const sep = stringOf(ops[2]) ?? ",";
      const body =
        headOf(ops[0]) === "Sequence" ? list(opsOf(ops[0]).map(emit), sep) : emit(ops[0]).ml;
      return atom(fenced(open, body, close));
    }

    // `Interval(a, b)` -- an endpoint wrapped in `Open(x)` gets a round bracket;
    // otherwise it is closed, `[a, b]`.
    case "Interval": {
      const [lo, hi] = ops;
      const openLo = headOf(lo) === "Open";
      const openHi = headOf(hi) === "Open";
      const a = emit(openLo ? opsOf(lo)[0] : lo);
      const b = emit(openHi ? opsOf(hi)[0] : hi);
      return atom(fenced(openLo ? "(" : "[", mrow(a.ml, mo(","), b.ml), openHi ? ")" : "]"));
    }

    // `Which(cond1, val1, cond2, val2, …)` -- CE's spelling of a piecewise function
    // (there is no separate `Piecewise` head). A `True` condition is the "otherwise" case.
    case "Which": {
      const rows: string[] = [];
      for (let i = 0; i + 1 < ops.length; i += 2) {
        const value = emit(ops[i + 1]).ml;
        const condition =
          symbolOf(ops[i]) === "True" ? mtext("otherwise") : mrow(mtext("if "), emit(ops[i]).ml);
        rows.push(`<mtr><mtd>${value}</mtd><mtd>${condition}</mtd></mtr>`);
      }
      return atom(mrow(mo("{"), `<mtable>${rows.join("")}</mtable>`));
    }

    case "Matrix": {
      const rows = opsOf(ops[0]).map((row) => opsOf(row).map(emit));
      const [open, close] = DELIMITERS[stringOf(ops[1]) ?? "()"] ?? ["(", ")"];
      const table = rows
        .map((row) => `<mtr>${row.map((cell) => `<mtd>${cell.ml}</mtd>`).join("")}</mtr>`)
        .join("");
      return atom(fenced(open, `<mtable>${table}</mtable>`, close));
    }

    case "Sum":
    case "Product": {
      const summand = emit(body(ops[0]));
      const op = bigOperator(head === "Sum" ? "∑" : "∏", ops[0], ops[1]);
      return { ml: mrow(op, paren(summand, ADD + 1)), prec: MULTIPLY };
    }

    case "Integrate": {
      const integrand = emit(body(ops[0]));
      const { variable, lower, upper } = bounds(ops[1]);
      const sign = mo("∫");
      const op =
        lower && upper
          ? `<msubsup>${sign}${lower.ml}${upper.ml}</msubsup>`
          : lower
            ? `<msub>${sign}${lower.ml}</msub>`
            : sign;
      const differential = variable ? mrow(mi("d"), variable.ml) : "";
      return { ml: mrow(op, paren(integrand, ADD + 1), differential), prec: MULTIPLY };
    }

    case "Limit": {
      const [fn, to] = ops;
      const variable = headOf(fn) === "Function" ? opsOf(fn)[1] : undefined;
      const approach =
        variable === undefined ? emit(to).ml : mrow(emit(variable).ml, mo("→"), emit(to).ml);
      const op = `<munder>${mi("lim")}${approach}</munder>`;
      return { ml: mrow(op, paren(emit(body(fn)), ADD + 1)), prec: MULTIPLY };
    }

    case "D": {
      // `D(f, x)` -- Leibniz notation, `d/dx f`.
      const [f, x] = ops;
      const operator = `<mfrac>${mi("d")}${mrow(mi("d"), emit(x).ml)}</mfrac>`;
      return { ml: mrow(operator, paren(emit(f), ADD + 1)), prec: MULTIPLY };
    }

    // `Derivative(f, n)` -- the boxed function `f'` / `f''` / `f^(n)`, applied via
    // `Apply` below (`f'(x)` parses to `Apply(Derivative(f, 1), x)`).
    case "Derivative": {
      const [fn, order] = ops;
      const f = emit(fn);
      const n = order === undefined ? "1" : (numberOf(order) ?? "1");
      const primes = { "1": "′", "2": "″", "3": "‴" }[n];
      return atom(
        primes !== undefined
          ? mrow(paren(f, ATOM), mo(primes))
          : `<msup>${paren(f, ATOM)}${fenced("(", mn(n), ")")}</msup>`,
      );
    }

    // `Apply(fn, x, …)` -- an already-boxed function called on its arguments.
    case "Apply": {
      const [fn, ...args] = ops;
      return atom(
        mrow(paren(emit(fn), ATOM), APPLY_FUNCTION, fenced("(", list(args.map(emit)), ")")),
      );
    }

    // `Wedge(a, b, …)` -- the outer product from `@enumeratio/geometric`; associative
    // like `Multiply`, so nesting needs no parens, but not commutative.
    case "Wedge": {
      const parts = ops.map((op) => paren(emit(op), MULTIPLY));
      return { ml: mrow(parts.join(mo("∧"))), prec: MULTIPLY };
    }
    // `Vee(a, b, algebra)` -- the regressive product; the third operand is the ambient
    // algebra, not a factor, so only the first two print.
    case "Vee": {
      const [a, b] = ops.map((op) => paren(emit(op), MULTIPLY));
      return { ml: mrow(a, mo("∨"), b), prec: MULTIPLY };
    }

    case "And":
    case "Or": {
      const level = head === "And" ? AND : OR;
      const parts = ops.map((op) => paren(emit(op), level + 1));
      return { ml: mrow(parts.join(mo(head === "And" ? "∧" : "∨"))), prec: level };
    }
    case "Not":
      return { ml: mrow(mo("¬"), paren(emit(ops[0]), NOT + 1)), prec: NOT };
    case "Implies":
      return { ml: mrow(ops.map((op) => paren(emit(op), OR + 1)).join(mo("⇒"))), prec: OR };
    case "Equivalent":
      return { ml: mrow(ops.map((op) => paren(emit(op), OR + 1)).join(mo("⇔"))), prec: OR };

    case "Error":
      return atom(`<merror>${mrow(...ops.map((op) => emit(op).ml))}</merror>`);

    default: {
      const relation = RELATIONS[head];
      if (relation !== undefined) {
        const parts = ops.map((op) => paren(emit(op), RELATION + 1));
        return { ml: mrow(parts.join(mo(relation))), prec: RELATION };
      }
      return emitCall(FUNCTIONS[head] ?? head, ops);
    }
  }
}

function emit(node: unknown): Emitted {
  const head = headOf(node);
  if (head !== undefined) return emitFunction(head, opsOf(node));

  const text = stringOf(node);
  if (text !== undefined) return atom(`<ms>${escape(text)}</ms>`);
  const number = numberOf(node);
  if (number !== undefined) return emitNumber(number);
  const symbol = symbolOf(node);
  if (symbol !== undefined) return emitSymbol(symbol);

  // A dictionary, or something that isn't MathJSON at all.
  return atom(`<merror><mtext>${escape(JSON.stringify(node) ?? String(node))}</mtext></merror>`);
}

/** Print `json` as presentation MathML. */
export function toMathML(json: MathJsonExpression, options: MathMLOptions = {}): string {
  const inner = emit(json).ml;
  if (options.fragment) return inner;
  const display = options.display === "block" ? ' display="block"' : "";
  return `<math xmlns="http://www.w3.org/1998/Math/MathML"${display}>${inner}</math>`;
}
