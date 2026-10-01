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

// The packages' macros (`PackageNotation.macros`): MathLive's, by command name, `#1`… for
// arguments. A host registers them before it typesets.
let registered: Readonly<Record<string, string>> = {};
let registeredPattern: RegExp | undefined;

// A macro whose definition names itself would expand forever: past this many expansions the
// rest is left as written.
const MAX_EXPANSIONS = 1000;

/** Register the packages' LaTeX macros, which `portableTeX` expands. Later calls add to them. */
export function registerTeXMacros(macros: Readonly<Record<string, string>>): void {
  registered = { ...registered, ...macros };
  // A command name is letters only (`\permutation`); anything else can't be written as one.
  const names = Object.keys(registered).filter((n) => /^[a-zA-Z]+$/.test(n));
  registeredPattern = names.length === 0 ? undefined : new RegExp(`\\\\(${names.join("|")})(?![a-zA-Z])`);
}

/** The registered macros, as MathLive's `macros` option takes them. */
export const texMacros = (): Readonly<Record<string, string>> => registered;

/** `\permutation(2, 3, 1)` → `{\operatorname{Permutation}}(2, 3, 1)`, outermost first. */
function expandMacros(text: string): string {
  if (registeredPattern === undefined) return text;
  let out = text;
  for (let n = 0; n < MAX_EXPANSIONS; n++) {
    const match = registeredPattern.exec(out);
    if (match === null) return out;
    const definition = registered[match[1] as string] as string;
    const arity = Math.max(0, ...[...definition.matchAll(/#(\d)/g)].map((m) => Number(m[1])));
    const args: string[] = [];
    let end = match.index + match[0].length;
    for (let i = 0; i < arity; i++) {
      const arg = group(out, end);
      if (arg === undefined) return out;
      [args[i], end] = arg;
    }
    const body = definition.replace(/#(\d)/g, (_, k: string) => args[Number(k) - 1] ?? "");
    out = out.slice(0, match.index) + `{${body}}` + out.slice(end);
  }
  return out;
}

/** `latex` with MathLive-only commands, and the packages' macros, rewritten for a LaTeX
 *  document. */
export function portableTeX(latex: string): string {
  let out = expandMacros(unwrapMarkup(latex));
  for (const [pattern, replacement] of MACROS) out = out.replace(pattern, replacement as string);
  return out;
}
