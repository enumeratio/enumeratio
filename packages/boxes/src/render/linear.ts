// What linear text shares between boxes and TeX: two alphabets. `unicode` is the glyphs
// themselves, with super- and subscript characters where every character has one; `ascii`
// spells them as AsciiMath does (`<=`, `alpha`, `oo`, `RR`, `x^(n+1)`), plain ASCII anyone
// can retype.

export type Alphabet = "unicode" | "ascii";

/** A glyph's AsciiMath spelling. */
const ASCII: Readonly<Record<string, string>> = {
  "−": "-",
  "×": "xx",
  "⋅": "*",
  "·": "*",
  "÷": "-:",
  "±": "+-",
  "∓": "-+",
  "∘": "@",
  "∗": "**",
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~~",
  "≡": "-=",
  "∼": "~",
  "≃": "~=",
  "≅": "~=",
  "∝": "prop",
  "∈": "in",
  "∉": "!in",
  "∋": "ni",
  "⊂": "sub",
  "⊆": "sube",
  "⊃": "sup",
  "⊇": "supe",
  "∪": "uu",
  "∩": "nn",
  "∖": "\\\\",
  "∧": "^^",
  "∨": "vv",
  "¬": "not",
  "∀": "AA",
  "∃": "EE",
  "→": "->",
  "←": "<-",
  "↦": "|->",
  "⇒": "=>",
  "⇐": "<=",
  "⇔": "<=>",
  "↔": "<->",
  "∞": "oo",
  "∂": "del",
  "∇": "grad",
  "∅": "O/",
  "∑": "sum",
  "∏": "prod",
  "∫": "int",
  "∮": "oint",
  "√": "sqrt",
  "…": "...",
  "⋯": "cdots",
  "⋮": "vdots",
  "⋱": "ddots",
  "⟨": "(:",
  "⟩": ":)",
  "⌊": "|__",
  "⌋": "__|",
  "⌈": "|~",
  "⌉": "~|",
  "‖": "||",
  ℕ: "NN",
  ℤ: "ZZ",
  ℚ: "QQ",
  ℝ: "RR",
  ℂ: "CC",
  ℙ: "PP",
  ℓ: "l",
  ℏ: "hbar",
  "°": "deg",
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "epsilon",
  ζ: "zeta",
  η: "eta",
  θ: "theta",
  ϑ: "vartheta",
  ι: "iota",
  κ: "kappa",
  λ: "lambda",
  μ: "mu",
  ν: "nu",
  ξ: "xi",
  π: "pi",
  ϖ: "varpi",
  ρ: "rho",
  ϱ: "varrho",
  σ: "sigma",
  ς: "varsigma",
  τ: "tau",
  υ: "upsilon",
  ϕ: "phi",
  φ: "varphi",
  χ: "chi",
  ψ: "psi",
  ω: "omega",
  Γ: "Gamma",
  Δ: "Delta",
  Θ: "Theta",
  Λ: "Lambda",
  Ξ: "Xi",
  Π: "Pi",
  Σ: "Sigma",
  Υ: "Upsilon",
  Φ: "Phi",
  Ψ: "Psi",
  Ω: "Omega",
};

/**
 * A token in the alphabet. AsciiMath spells a glyph as a word, so a word spelling gets a
 * space from a neighbouring letter (`αβ` is `alpha beta`, `2π` stays `2pi`).
 */
export function spell(token: string, alphabet: Alphabet): string {
  if (alphabet === "unicode") return token;
  let out = "";
  for (const c of Array.from(token)) {
    const s = ASCII[c] ?? c;
    out += s.length > 1 && /[A-Za-z]$/.test(out) && /^[A-Za-z]/.test(s) ? ` ${s}` : s;
  }
  return out;
}

/** Join two spelled pieces, spacing words that would run together. */
export function joinSpelled(left: string, right: string, alphabet: Alphabet): string {
  if (alphabet === "unicode" || left === "" || right === "") return left + right;
  const a = /([A-Za-z]+)$/.exec(left)?.[1] ?? "";
  const b = /^([A-Za-z]+)/.exec(right)?.[1] ?? "";
  return a && b && (a.length > 1 || b.length > 1) ? `${left} ${right}` : left + right;
}

const SUPER: Readonly<Record<string, string>> = Object.fromEntries(
  Array.from("0123456789+-=()ni").map((c, i) => [c, Array.from("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ")[i]!]),
);
const SUB: Readonly<Record<string, string>> = Object.fromEntries(
  Array.from("0123456789+-=()aeoxhklmnpst").map((c, i) => [c, Array.from("₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜ")[i]!]),
);

/** A script as Unicode script characters, or `undefined` when one of them has none. */
export function scriptChars(s: string, mark: "^" | "_"): string | undefined {
  const table = mark === "^" ? SUPER : SUB;
  const chars = Array.from(s.replace(/−/g, "-"));
  return chars.length > 0 && chars.every((c) => table[c] !== undefined)
    ? chars.map((c) => table[c]).join("")
    : undefined;
}
