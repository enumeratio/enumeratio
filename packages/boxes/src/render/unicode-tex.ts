// Unicode where LaTeX would use a command: `ω`, not `\omega`; `≤`, not `\le`. A symbol is
// listed only when every consumer reads the Unicode as the command: KaTeX (strict, bar
// `katexUnknown` below), compute-engine's parser (ours reads the rest through `commandTeX`),
// and MathLive (same MathML as the command). Left out, with the reason:
//   ε ϵ φ     compute-engine reads `ε` as `\epsilon` and `\varepsilon` as `ϵ`'s symbol
//   √ ∛ ∑ ∏ ∫ MathLive sets the Unicode apart from the command (no radical bar, no limits)
//   ′ ″ ² ₂   MathLive's MathML differs from `^{\prime}`, `^2`, `_2`
//   ·         KaTeX spaces a middle dot as punctuation, not as `\cdot`'s operator
//   ← ∝ ∇ ∄   compute-engine reads no command for them either

export interface UnicodeSymbol {
  readonly char: string;
  readonly command: string;
  /** compute-engine does not read the character as the command yet, and we do not read it for
   *  it: the symbol is written as Unicode only once it does (`markLanded`). */
  readonly landed?: true;
  /** KaTeX's strict mode flags the character (`unknownSymbol`) though it renders it: allowed
   *  by `katexStrict`. */
  readonly katexUnknown?: true;
}

const zip = (chars: string, commands: string): UnicodeSymbol[] =>
  Array.from(chars, (char, i) => ({ char, command: `\\${commands.split(" ")[i]}` }));

const BLACKBOARD = { ℕ: "N", ℤ: "Z", ℚ: "Q", ℝ: "R", ℂ: "C", ℍ: "H", ℙ: "P" } as const;

export const UNICODE_TEX: readonly UnicodeSymbol[] = [
  ...zip(
    "αβγδζηθϑικλμνξπϖρϱσςτυϕχψω",
    "alpha beta gamma delta zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi chi psi omega",
  ),
  ...zip("ΓΔΘΛΞΠΣΥΦΨΩ", "Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega"),
  ...zip("≤≥≠≈≡∈∉∼≅⊂⊆⊃⊇∋", "le ge ne approx equiv in notin sim cong subset subseteq supset supseteq ni"),
  ...zip("→↔⇒⇔↦", "to leftrightarrow Rightarrow Leftrightarrow mapsto"),
  ...zip("×±∓⊗⊕∪∩÷∘∖∧∨¬∂", "times pm mp otimes oplus cup cap div circ setminus land lor lnot partial"),
  ...zip("∞ℓℵℏ", "infty ell aleph hbar"),
  { char: "∅", command: "\\emptyset", katexUnknown: true },
  // compute-engine 0.149 reads ℕ ℤ ℚ ℝ ℂ natively; ℍ and ℙ still parse as strings.
  ...Object.entries(BLACKBOARD).map(([char, letter]): UnicodeSymbol => ({
    char,
    command: `\\mathbb{${letter}}`,
    landed: true,
  })),
];

let landed: ReadonlySet<string> = new Set();
let cache: { chars: Map<string, UnicodeSymbol>; commands: Map<string, string> } | undefined;

/** The listed symbols written as Unicode now. */
export const unicodeSymbols = (): UnicodeSymbol[] => UNICODE_TEX.filter((s) => !s.landed || landed.has(s.char));

/** Declare which `landed` symbols compute-engine now parses natively; later calls replace. */
export function markLanded(chars: Iterable<string>): void {
  landed = new Set(chars);
  cache = undefined;
}

const enabled = () =>
  (cache ??= {
    chars: new Map(unicodeSymbols().map((s) => [s.char, s])),
    commands: new Map(unicodeSymbols().map((s) => [s.command, s.char])),
  });

/** Whether `char` is written as itself in LaTeX output. */
export const isUnicodeTeX = (char: string): boolean => enabled().chars.has(char);

// Text a command holds as written, where a character is a character: not for the parser, and
// already escaped (`\text{$\pi$}`) when it is ours.
const TEXT = /\\(?:text|textrm|textbf|textit|textsf|texttt|mbox)\s*\{/y;

/** `latex` with `f` applied to everything outside `\text{…}` groups. */
function outsideText(latex: string, f: (segment: string) => string): string {
  let out = "";
  let from = 0;
  let i = 0;
  while (i < latex.length) {
    TEXT.lastIndex = i;
    const text = latex[i] === "\\" ? TEXT.exec(latex) : null;
    if (text === null) {
      i += latex[i] === "\\" ? 2 : 1;
      continue;
    }
    let depth = 1;
    let end = i + text[0].length;
    for (; end < latex.length && depth > 0; end++) {
      if (latex[end] === "\\") end++;
      else if (latex[end] === "{") depth++;
      else if (latex[end] === "}") depth--;
    }
    out += f(latex.slice(from, i)) + latex.slice(i, end);
    from = i = end;
  }
  return out + f(latex.slice(from));
}

// A command (`\omega`, `\\`) or `\mathbb{Z}`, with the one space that only delimited it.
const COMMAND = /\\(?:mathbb\{[A-Z]\}|[a-zA-Z]+|[^a-zA-Z])( (?=\S))?/g;

/** `latex` with each listed command written as its Unicode character. */
export function unicodeTeX(latex: string): string {
  const { commands } = enabled();
  return outsideText(latex, (segment) =>
    segment.replace(COMMAND, (match, space: string | undefined, offset: number) => {
      const char = commands.get(space === undefined ? match : match.slice(0, -1));
      if (char === undefined) return match;
      // A letter can't follow a command word bare (`\log\Gamma` is not `\logΓ`).
      const after = /\\([a-zA-Z]+)$/.exec(segment.slice(0, offset))?.[1];
      return after !== undefined && !commands.has(`\\${after}`) && /^\p{L}/u.test(char) ? ` ${char}` : char;
    }),
  );
}

/** `latex` with each listed character written as its command, so the parser reads it as that
 *  command, in whatever context a command takes (`\delta_1`). */
export function commandTeX(latex: string): string {
  const { chars } = enabled();
  return outsideText(latex, (segment) =>
    Array.from(segment, (char) => {
      const symbol = chars.get(char);
      return symbol === undefined || symbol.landed ? char : `${symbol.command} `;
    }).join(""),
  );
}

/** KaTeX's `strict` option: its default (`warn`) for everything but the listed characters it
 *  renders though it flags them. `otherwise` is `"error"` where a flag must fail (tests). */
export function katexStrict(otherwise: "warn" | "error" = "warn") {
  const allowed = new Set(UNICODE_TEX.filter((s) => s.katexUnknown).map((s) => s.char));
  return (code: string, _message: string, token?: { text?: string }): "ignore" | "warn" | "error" =>
    code === "unknownSymbol" && token?.text !== undefined && allowed.has(token.text) ? "ignore" : otherwise;
}
