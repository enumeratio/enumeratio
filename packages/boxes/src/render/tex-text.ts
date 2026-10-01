// TeX as one line of text, without parsing it to an expression: for a held `$…$` island's
// plain text (an outline, a slug, a title, copy), in either of linear.ts's alphabets.

import { type Alphabet, joinSpelled, scriptChars, spell } from "./linear.ts";

const SYMBOLS: Readonly<Record<string, string>> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
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
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Upsilon: "Υ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
  infty: "∞",
  partial: "∂",
  nabla: "∇",
  ell: "ℓ",
  hbar: "ℏ",
  emptyset: "∅",
  varnothing: "∅",
  top: "⊤",
  bot: "⊥",
  sum: "∑",
  prod: "∏",
  int: "∫",
  oint: "∮",
  sqrt: "√",
  cdot: "·",
  times: "×",
  div: "÷",
  pm: "±",
  mp: "∓",
  circ: "∘",
  ast: "∗",
  star: "⋆",
  bullet: "•",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  ne: "≠",
  neq: "≠",
  approx: "≈",
  equiv: "≡",
  sim: "∼",
  simeq: "≃",
  cong: "≅",
  propto: "∝",
  ll: "≪",
  gg: "≫",
  in: "∈",
  notin: "∉",
  ni: "∋",
  subset: "⊂",
  subseteq: "⊆",
  supset: "⊃",
  supseteq: "⊇",
  cup: "∪",
  cap: "∩",
  setminus: "∖",
  wedge: "∧",
  land: "∧",
  vee: "∨",
  lor: "∨",
  neg: "¬",
  lnot: "¬",
  forall: "∀",
  exists: "∃",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  mapsto: "↦",
  Rightarrow: "⇒",
  implies: "⇒",
  Leftarrow: "⇐",
  iff: "⇔",
  Leftrightarrow: "⇔",
  leftrightarrow: "↔",
  ldots: "…",
  dots: "…",
  cdots: "⋯",
  vdots: "⋮",
  ddots: "⋱",
  langle: "⟨",
  rangle: "⟩",
  lfloor: "⌊",
  rfloor: "⌋",
  lceil: "⌈",
  rceil: "⌉",
  vert: "|",
  mid: "|",
  Vert: "‖",
  lbrace: "{",
  rbrace: "}",
  "{": "{",
  "}": "}",
  $: "$",
  "%": "%",
  "&": "&",
  "#": "#",
  _: "_",
  ",": " ",
  ";": " ",
  ":": " ",
  "!": "",
  " ": " ",
  quad: " ",
  qquad: " ",
  sin: "sin",
  cos: "cos",
  tan: "tan",
  cot: "cot",
  sec: "sec",
  csc: "csc",
  sinh: "sinh",
  cosh: "cosh",
  tanh: "tanh",
  log: "log",
  ln: "ln",
  exp: "exp",
  lim: "lim",
  max: "max",
  min: "min",
  sup: "sup",
  inf: "inf",
  det: "det",
  gcd: "gcd",
  arg: "arg",
  deg: "deg",
  Re: "Re",
  Im: "Im",
};

/** Commands whose one argument is the text: styling, fonts, spacing wrappers. */
const TRANSPARENT = new Set([
  "text",
  "textrm",
  "textit",
  "textbf",
  "mathrm",
  "mathit",
  "mathbf",
  "mathsf",
  "mathtt",
  "mathcal",
  "mathscr",
  "mathfrak",
  "boldsymbol",
  "operatorname",
  "displaystyle",
  "textstyle",
  "mbox",
]);
const DOUBLE_STRUCK: Readonly<Record<string, string>> = { N: "ℕ", Z: "ℤ", Q: "ℚ", R: "ℝ", C: "ℂ", P: "ℙ" };
const DROPPED = new Set([
  "left",
  "right",
  "big",
  "Big",
  "bigg",
  "Bigg",
  "bigl",
  "bigr",
  "Bigl",
  "Bigr",
  "limits",
  "nolimits",
]);

class Reader {
  i = 0;
  readonly src: string;
  readonly alphabet: Alphabet;
  constructor(src: string, alphabet: Alphabet) {
    this.src = src;
    this.alphabet = alphabet;
  }

  script(mark: "^" | "_"): string {
    const s = this.arg();
    const chars = this.alphabet === "unicode" ? scriptChars(s, mark) : undefined;
    return chars ?? (Array.from(s).length === 1 ? `${mark}${s}` : `${mark}(${s})`);
  }

  /** Up to `stop` (a closing `}`) or the end. */
  run(stop?: string): string {
    let out = "";
    while (this.i < this.src.length && this.src[this.i] !== stop) out = joinSpelled(out, this.atom(), this.alphabet);
    if (stop !== undefined) this.i++;
    return out;
  }

  /** One argument: a `{…}` group, a command, or one character. */
  arg(): string {
    while (this.src[this.i] === " ") this.i++;
    if (this.src[this.i] === "{") {
      this.i++;
      return this.run("}");
    }
    return this.atom();
  }

  atom(): string {
    const c = this.src[this.i]!;
    this.i++;
    if (c === "{") return this.run("}");
    if (c === "^") return this.script("^");
    if (c === "_") return this.script("_");
    if (c === "~") return " ";
    if (c === "-") return spell("−", this.alphabet);
    if (c !== "\\") return c;
    const name = /^[A-Za-z]+/.exec(this.src.slice(this.i))?.[0] ?? this.src[this.i++] ?? "";
    if (/^[A-Za-z]/.test(name)) this.i += name.length;
    if (DROPPED.has(name)) return "";
    if (TRANSPARENT.has(name)) return this.arg();
    if (name === "mathbb") {
      const a = this.arg();
      return spell(DOUBLE_STRUCK[a] ?? a, this.alphabet);
    }
    if (name === "frac" || name === "dfrac" || name === "tfrac") {
      const [n, d] = [this.arg(), this.arg()];
      const unit = (s: string): string => (Array.from(s).length > 1 && /[^\p{L}\p{N}]/u.test(s) ? `(${s})` : s);
      return `${unit(n)}/${unit(d)}`;
    }
    if (name === "binom") return `C(${this.arg()}, ${this.arg()})`;
    if (name === "sqrt") {
      const a = this.arg();
      if (this.alphabet === "ascii") return `sqrt(${a})`;
      return Array.from(a).length > 1 ? `√(${a})` : `√${a}`;
    }
    return spell(SYMBOLS[name] ?? name, this.alphabet);
  }
}

/** TeX as one line of text in `alphabet`. */
export const texToAlphabet = (tex: string, alphabet: Alphabet): string =>
  new Reader(tex, alphabet)
    .run()
    .replace(/\s{2,}/g, " ")
    .trim();

/** TeX as one line of text. */
export const texToText = (tex: string): string => texToAlphabet(tex, "unicode");

/** TeX as one line of ASCII, spelled as AsciiMath spells it. */
export const texToAscii = (tex: string): string => texToAlphabet(tex, "ascii");
