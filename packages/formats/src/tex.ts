// compute-engine writes LaTeX for MathLive, and some of it only MathLive knows: `\imaginaryI`,
// `\exponentialE`, `\Z`, `\degree`, and the `\error{…}` / `\mathtip{…}{…}` markup it wraps
// round an operand that fails its type check. Exported TeX is for a LaTeX document, so it is
// rewritten into commands amsmath and amssymb provide.

/** A letter for a command, spaced off a command name before it (`\lbrack e`, not `\lbracke`). */
const letter =
  (c: string) =>
  (_: string, command: string | undefined): string =>
    command === undefined ? c : `${command} ${c}`;

const MACROS: readonly (readonly [RegExp, string | ((...args: string[]) => string)])[] = [
  [/(\\[a-zA-Z]+)?\\imaginaryI(?![a-zA-Z])/g, letter("i")],
  [/(\\[a-zA-Z]+)?\\exponentialE(?![a-zA-Z])/g, letter("e")],
  [/\\differentialD(?![a-zA-Z])/g, "\\mathrm{d}"],
  [/\\([NZQRC])(?![a-zA-Z])/g, "\\mathbb{$1}"],
  [/\\degree(?![a-zA-Z])/g, "^{\\circ}"],
  // Neither amsmath nor KaTeX defines a hyperbolic cosecant.
  [/\\csch(?![a-zA-Z])/g, "\\operatorname{csch}"],
  [/\\lparen(?![a-zA-Z])/g, "("],
  [/\\rparen(?![a-zA-Z])/g, ")"],
  [/\\doubleprime(?![a-zA-Z])/g, "\\prime\\prime"],
  [/\\tripleprime(?![a-zA-Z])/g, "\\prime\\prime\\prime"],
  // A string's text, which compute-engine sets upright a second time.
  [/\\text\{\\mathrm\{([^{}]*)\}\}/g, "\\text{$1}"],
  // A string's `^` and `_`, which compute-engine leaves bare: math-only in text mode.
  [
    /\\text\{([^{}]*)\}/g,
    (_: string, text: string) =>
      `\\text{${text.replace(/(?<!\\)\^/g, "\\textasciicircum{}").replace(/(?<!\\)_/g, "\\_")}}`,
  ],
];

/** The balanced `{…}` group opening at `text[start]`, as `[contents, end]`. */
function group(text: string, start: number): [string, number] | undefined {
  if (text[start] !== "{") return undefined;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") i++;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return [text.slice(start + 1, i), i + 1];
  }
  return undefined;
}

/** `\error{x}` → `x`, `\mathtip{x}{tip}` → `x`, innermost first. */
function unwrapMarkup(text: string): string {
  let out = text;
  for (;;) {
    const match = /\\(error|mathtip)(?![a-zA-Z])/.exec(out);
    if (match === null) return out;
    const first = group(out, match.index + match[0].length);
    if (first === undefined) return out;
    let [body, end] = first;
    if (match[1] === "mathtip") end = group(out, end)?.[1] ?? end;
    out = out.slice(0, match.index) + `{${body}}` + out.slice(end);
  }
}

/** `latex` with MathLive-only commands rewritten for a LaTeX document. */
export function portableTeX(latex: string): string {
  let out = unwrapMarkup(latex);
  for (const [pattern, replacement] of MACROS) out = out.replace(pattern, replacement as string);
  return out;
}
