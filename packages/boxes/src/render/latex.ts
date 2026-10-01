// Boxes as LaTeX -- for MathLive, KaTeX and print. Display only: the reading direction
// is compute-engine's LaTeX parser, which goes to an expression, not to boxes.

import { type Box, type BoxNode, isNode, optionsOfBox, tokenClass } from "../box.ts";
import { texSource } from "./markdown.ts";

const COMMANDS: Record<string, string> = {
  "−": "-",
  "×": "\\times",
  "⋅": "\\cdot",
  "\u2062": "",
  "\u2061": "",
  "≠": "\\ne",
  "≤": "\\le",
  "≥": "\\ge",
  "≈": "\\approx",
  "≡": "\\equiv",
  "∈": "\\in",
  "∉": "\\notin",
  "⊂": "\\subset",
  "⊆": "\\subseteq",
  "⊃": "\\supset",
  "⊇": "\\supseteq",
  "→": "\\to",
  "∧": "\\land",
  "∨": "\\lor",
  "¬": "\\lnot",
  "⇒": "\\Rightarrow",
  "⇔": "\\Leftrightarrow",
  "⊗": "\\otimes",
  mod: "\\bmod",
  "∑": "\\sum",
  "∏": "\\prod",
  "∫": "\\int",
  "{": "\\{",
  "}": "\\}",
  "‖": "\\Vert",
  "⟨": "\\langle",
  "⟩": "\\rangle",
  "⌊": "\\lfloor",
  "⌋": "\\rfloor",
  "⌈": "\\lceil",
  "⌉": "\\rceil",
  "′": "'",
  "″": "''",
  "‴": "'''",
  "∞": "\\infty",
  "∞̃": "\\tilde\\infty",
  "∅": "\\emptyset",
  "°": "^\\circ",
  ℝ: "\\mathbb{R}",
  ℤ: "\\mathbb{Z}",
  ℚ: "\\mathbb{Q}",
  ℂ: "\\mathbb{C}",
  ℕ: "\\mathbb{N}",
  𝔹: "\\mathbb{B}",
  α: "\\alpha",
  β: "\\beta",
  γ: "\\gamma",
  δ: "\\delta",
  ϵ: "\\epsilon",
  ε: "\\varepsilon",
  ζ: "\\zeta",
  η: "\\eta",
  θ: "\\theta",
  ϑ: "\\vartheta",
  ι: "\\iota",
  κ: "\\kappa",
  λ: "\\lambda",
  μ: "\\mu",
  ν: "\\nu",
  ξ: "\\xi",
  π: "\\pi",
  ϖ: "\\varpi",
  ρ: "\\rho",
  ϱ: "\\varrho",
  σ: "\\sigma",
  ς: "\\varsigma",
  τ: "\\tau",
  υ: "\\upsilon",
  ϕ: "\\phi",
  φ: "\\varphi",
  χ: "\\chi",
  ψ: "\\psi",
  ω: "\\omega",
  Γ: "\\Gamma",
  Δ: "\\Delta",
  Θ: "\\Theta",
  Λ: "\\Lambda",
  Ξ: "\\Xi",
  Π: "\\Pi",
  Σ: "\\Sigma",
  Υ: "\\Upsilon",
  Φ: "\\Phi",
  Ψ: "\\Psi",
  Ω: "\\Omega",
};

/** Names LaTeX has an operator command for; other words go in `\operatorname`. */
const OPERATOR_NAMES = new Set(
  "sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh coth ln log lg exp max min gcd lim arg det dim ker deg inf sup".split(
    " ",
  ),
);

const TEXT_SPECIALS = /[\\{}$&#^_%~]/g;
const escapeText = (s: string): string =>
  s.replace(TEXT_SPECIALS, (c) => (c === "\\" ? "\\textbackslash{}" : c === "~" ? "\\textasciitilde{}" : `\\${c}`));

function token(s: string): string {
  const command = COMMANDS[s];
  if (command !== undefined) return command;
  // A pattern name (`_a`, `__rest`, `_1_2`): its underscores are literal.
  if (s.startsWith("_")) return s.replaceAll("_", "\\_");
  if (tokenClass(s) === "identifier" && !/^.$/u.test(s)) {
    return OPERATOR_NAMES.has(s) ? `\\${s}` : `\\operatorname{${s}}`;
  }
  return s;
}

/** A command's argument, braced unless it is a single character. */
const group = (s: string): string => (/^[\w]$/.test(s) ? s : `{${s}}`);

/** A script's base: braced when it is more than one token, so the script binds to all of it. */
const base = (box: Box): string => {
  const s = write(box);
  return typeof box === "string" || isFenced(box) ? s : `{${s}}`;
};

/** A row that opens with a bracket and closes with one: already a unit. */
const isFenced = (box: Box): boolean =>
  Array.isArray(box) && box[0] === "RowBox" && box[1].length > 1 && box[1][0] in FENCES;

/** An environment for a grid fenced by each bracket pair. */
const FENCES: Record<string, { close: string; matrix: string }> = {
  "(": { close: ")", matrix: "pmatrix" },
  "[": { close: "]", matrix: "bmatrix" },
  "|": { close: "|", matrix: "vmatrix" },
  "‖": { close: "‖", matrix: "Vmatrix" },
  "{": { close: "}", matrix: "Bmatrix" },
};

/** A big operator's limits go under and over it; anything else's go in `\underset`. */
const isBigOperator = (box: Box): boolean => box === "∑" || box === "∏" || box === "lim";

function write(box: Box): string {
  if (typeof box === "string") return token(box);
  return writeNode(box);
}

/** Juxtaposed tokens, with a space where two commands or words would run together. */
function joined(parts: readonly string[]): string {
  let out = "";
  for (const part of parts) {
    if (part === "") continue;
    if (/\\[A-Za-z]+$/.test(out) && /^[A-Za-z]/.test(part)) out += " ";
    out += part;
  }
  return out;
}

function writeNode(box: BoxNode): string {
  const options = optionsOfBox(box);
  switch (box[0]) {
    case "RowBox": {
      const [first, second, third] = box[1];
      // `{` over a grid of (value, condition) rows: a piecewise definition.
      if (box[1].length === 2 && first === "{" && isNode(second) && second[0] === "GridBox") {
        return `\\begin{cases}${rows(second[1])}\\end{cases}`;
      }
      const fence = typeof first === "string" ? FENCES[first] : undefined;
      if (box[1].length === 3 && fence !== undefined && third === fence.close && isNode(second)) {
        if (second[0] === "GridBox") return `\\begin{${fence.matrix}}${rows(second[1])}\\end{${fence.matrix}}`;
        // A fraction without its bar, in parentheses: a binomial coefficient.
        if (first === "(" && second[0] === "FractionBox" && optionsOfBox(second).FractionLine === false) {
          return `\\binom{${write(second[1])}}{${write(second[2])}}`;
        }
      }
      return joined(box[1].map(write));
    }
    case "TextBox":
      return `\\text{${escapeText(options.ShowStringCharacters === true ? `“${box[1]}”` : box[1])}}`;
    case "SuperscriptBox":
      return `${base(box[1])}^${group(write(box[2]))}`;
    case "SubscriptBox":
      return `${base(box[1])}_${group(write(box[2]))}`;
    case "SubsuperscriptBox":
      return `${base(box[1])}_${group(write(box[2]))}^${group(write(box[3]))}`;
    case "OverscriptBox":
      // A command after a letter needs its group: `\overline n` is not `\overlinen`.
      if (box[2] === "‾") return `\\overline{${write(box[1])}}`;
      if (box[2] === "→") return `\\vec{${write(box[1])}}`;
      return `\\overset${group(write(box[2]))}${group(write(box[1]))}`;
    case "UnderscriptBox":
      if (isBigOperator(box[1])) return `${write(box[1])}_${group(write(box[2]))}`;
      if (box[2] === "_") return `\\underline{${write(box[1])}}`;
      return `\\underset${group(write(box[2]))}${group(write(box[1]))}`;
    case "UnderoverscriptBox":
      if (isBigOperator(box[1])) return `${write(box[1])}_${group(write(box[2]))}^${group(write(box[3]))}`;
      return `\\overset${group(write(box[3]))}{\\underset${group(write(box[2]))}${group(write(box[1]))}}`;
    case "FractionBox":
      if (options.FractionLine === false) return `\\genfrac{}{}{0pt}{}{${write(box[1])}}{${write(box[2])}}`;
      return `\\frac{${write(box[1])}}{${write(box[2])}}`;
    case "SqrtBox":
      return `\\sqrt{${write(box[1])}}`;
    case "RadicalBox":
      return `\\sqrt[${write(box[2])}]{${write(box[1])}}`;
    case "GridBox":
      return `\\begin{matrix}${rows(box[1])}\\end{matrix}`;
    case "StyleBox": {
      let s = write(box[1]);
      if (box[2].FontWeight === "Bold") s = `\\boldsymbol{${s}}`;
      if (box[2].FontColor !== undefined) s = `\\textcolor{${String(box[2].FontColor)}}{${s}}`;
      return s;
    }
    case "FrameBox":
      return `\\boxed{${write(box[1])}}`;
    case "TagBox":
    case "InterpretationBox":
      return write(box[1]);
    case "ErrorBox":
      return `\\textcolor{red}{${write(box[1])}}`;
    case "ButtonBox":
    case "TextCell":
      return write(box[1]);
    case "TextData":
      return box[1].map((b) => (typeof b === "string" ? `\\text{${escapeText(b)}}` : write(b))).join("");
    case "FormBox":
      return box[2] === "TeXForm" ? texSource(box[1]) : write(box[1]);
    case "TemplateSlot":
    case "TemplateExpression":
      return `\\text{\\$\\{${escapeText(box[1])}\\}}`;
    default:
      throw new Error("unreachable: BoxNode's tags are exhaustive above");
  }
}

const rows = (grid: readonly (readonly Box[])[]): string => grid.map((r) => r.map(write).join("&")).join("\\\\");

/** Boxes as LaTeX. */
export const toLatex = (box: Box): string => write(box);
