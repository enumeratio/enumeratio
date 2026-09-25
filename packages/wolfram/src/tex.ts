// Wolfram's `TeXForm` and notatio write the same mathematics in different TeX. These translate
// the spelling only -- the same expression, written the other way -- so the two can be read
// side by side; a difference in what was computed stays a difference.
//
// Wolfram → notatio:
//   \log(x)                    \ln(x)            (a bare \log is Wolfram's natural log)
//   \sin^{-1}(x), \text{sech}^{-1}(x), …   \arcsin(x), \mathrm{arsech}(x), …
//   \sin^2(x)                  \sin(x)^2
//   \exp(a)                    e^{a}              (a number or a symbol)
//   \text{Plus}[x], N[x]       \operatorname{Add}(x), \operatorname{N}(x)   (compute-engine names)
//   \{a, b\}                   \lbrack a, b\rbrack           (a list)
//   \text{Union}[\{a, b\}]     \lbrace a, b\rbrace           (a set, as toWolfram writes one)
//   \text{ComplexInfinity}     \tilde\infty
//   \geq \leq \neq \neg |      \ge \le \ne \lnot \vert
//   \phi, \nu(n)               \varphi, \omega(n)            (EulerPhi/GoldenRatio, PrimeNu)
//   2\ 5, 5 4!                 2\times 5, 5\times 4!
//   \left(\begin{array}{cc}1&2\\3&4\\\end{array}\right)   \lbrack\lbrack 1, 2\rbrack, …\rbrack
//   \text{1.5$\grave{ }$*${}^{\wedge}$-7}   1.5\cdot10^{-7}   (and a precision mark dropped)
//   \text{ctx$\grave{ }$Name}  \text{Name}                   (a context dropped)
//   (n;a,b)                    \binom{n}{a,b}                (Multinomial)
//   \mathcal{S}_n^{(k)}, S_n^{(k)}   the Stirling brace, s(n, k)
//   \text{log$\Gamma $}, \text{logG}  \log\Gamma, \log G
//   \{a\}[[i]]                 \lbrack a\rbrack[i]
// and `toWolframTeX` the other way. One way only, since Wolfram's choice turns on the shape of
// the held input: `\exp(a)`, `b^{\frac{1}{n}}` → `\sqrt[n]{b}`, `b^{-n}` → `\frac{1}{b^n}`,
// `\left(L_5\right){}^2` → `L_5^2`, and the dropped precision and context marks.

import { REVERSE_HEADS } from "./from-wolfram.ts";
import { isSystemName } from "./system-names.ts";
import { HEADS } from "./to-wolfram.ts";

/** A Wolfram head's compute-engine name, which notatio writes for a head without notation. */
const ceName = (name: string | undefined): string =>
  name === undefined ? "" : (REVERSE_HEADS[name] ?? name);

type Rule = readonly [RegExp, string | ((...match: string[]) => string)];

const apply = (tex: string, rules: readonly Rule[]): string =>
  rules.reduce((t, [pattern, to]) => t.replace(pattern, to as never), tex);

const OPEN = /^(?:\\left|\\bigl|\\Bigl)?(?:\\\{|\\lbrace|\\lbrack|[([{])/;
const CLOSE = /^(?:\\right|\\bigr|\\Bigr)?(?:\\\}|\\rbrace|\\rbrack|[)\]}])/;

/** The bracketed group opening at `text[start]`, as `[open, contents, close, end]`: any
 *  pairing of `( [ { \{`, with `\left`/`\right` sizing, balanced as one kind. */
function bracketed(text: string, start: number): [string, string, string, number] | undefined {
  const open = OPEN.exec(text.slice(start))?.[0];
  if (open === undefined) return undefined;
  let depth = 0;
  for (let i = start; i < text.length;) {
    const rest = text.slice(i);
    const o = OPEN.exec(rest)?.[0];
    const c = o === undefined ? CLOSE.exec(rest)?.[0] : undefined;
    if (o !== undefined) {
      depth++;
      i += o.length;
    } else if (c !== undefined) {
      if (--depth === 0) {
        return [open, text.slice(start + open.length, i), c, i + c.length];
      }
      i += c.length;
    } else i += rest[0] === "\\" ? (/^\\[a-zA-Z]+|^\\./.exec(rest)?.[0].length ?? 1) : 1;
  }
  return undefined;
}

/** Rewrite each `pattern` match followed by a bracketed group, innermost groups first:
 *  `to(match, open, contents, close)` replaces the match and the group. */
function withGroup(
  tex: string,
  pattern: RegExp | string,
  to: (match: RegExpExecArray, open: string, contents: string, close: string) => string | undefined,
): string {
  const sticky = new RegExp(typeof pattern === "string" ? pattern : pattern.source, "y");
  let out = "";
  for (let i = 0; i < tex.length;) {
    sticky.lastIndex = i;
    const match = sticky.exec(tex);
    const group = match && bracketed(tex, i + match[0].length);
    if (match && group) {
      const [open, contents, close, end] = group;
      const written = to(match, open, withGroup(contents, pattern, to), close);
      if (written !== undefined) {
        out += written;
        i = end;
        continue;
      }
    }
    out += tex[i];
    i++;
  }
  return out;
}

const size = (open: string): string => (open.startsWith("\\left") ? "\\left" : "");
const sizeClose = (close: string): string => (close.startsWith("\\right") ? "\\right" : "");

/** Wolfram's inverse-function spelling, and ours. */
const INVERSES: readonly (readonly [string, string])[] = [
  ["\\sin", "\\arcsin"],
  ["\\cos", "\\arccos"],
  ["\\tan", "\\arctan"],
  ["\\cot", "\\mathrm{arcctg}"],
  ["\\sec", "\\mathrm{arcsec}"],
  ["\\csc", "\\mathrm{arccsc}"],
  ["\\sinh", "\\mathrm{arsinh}"],
  ["\\cosh", "\\mathrm{arcosh}"],
  ["\\tanh", "\\mathrm{artanh}"],
  ["\\coth", "\\mathrm{arcoth}"],
  ["\\text{sech}", "\\mathrm{arsech}"],
  ["\\text{csch}", "\\mathrm{arcsch}"],
];

const escape = (s: string): string => s.replace(/[\\{}$^()[\]|.*+?]/g, "\\$&");
const word = (command: string): string => `${escape(command)}(?![a-zA-Z])`;

const SYNONYMS: readonly (readonly [string, string])[] = [
  ["\\geq", "\\ge"],
  ["\\leq", "\\le"],
  ["\\neq", "\\ne"],
  ["\\neg", "\\lnot"],
  ["\\phi", "\\varphi"],
  ["\\text{ComplexInfinity}", "\\tilde\\infty"],
  ["\\text{log$\\Gamma $}", "\\log\\Gamma"],
  ["\\text{logG}", "\\log G"],
];

/** A function that Wolfram powers as `\sin^2(x)`. */
const POWERED = String.raw`\\(?:sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|coth|ln|log)(?![a-zA-Z])`;
/** A TeX script argument: `2`, `x`, `{…}` one level deep. */
const SCRIPT = String.raw`(?:\{[^{}]*\}|[a-zA-Z0-9])`;
/** A head name Wolfram writes before `[`: `\text{Foo}` or a bare `N`. */
const HEAD = String.raw`(?:\\text\{([A-Za-z][A-Za-z0-9]*)\}|(?<![\\a-zA-Z])([A-Z][A-Za-z0-9]*))\s*`;

const unbrace = (s: string): string => (/^\{.*\}$/.test(s) ? s.slice(1, -1) : s);

/** `text` cut at each top-level `separator`, bracketed groups kept whole. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length;) {
    const group = bracketed(text, i);
    if (group !== undefined) i = group[3];
    else if (text.startsWith(separator, i)) {
      parts.push(text.slice(start, i));
      i += separator.length;
      start = i;
    } else i += text[i] === "\\" ? 2 : 1;
  }
  return [...parts, text.slice(start)];
}

/** Wolfram's number marks: `1.5$\grave{ }$20.` (a precision) and `…*${}^{\wedge}$-7`
 *  (an exponent) inside `\text{…}`, and `ctx$\grave{ }$Name` (a context). */
const MARKED_NUMBER =
  /\\text\{(-?\d+\.\d*)\$\\grave\{ ?\}\$(?:\d+\.?\d*)?(?:\*\$\{\}\^\{\\wedge ?\}\$(-?\d+))?\}/g;
const CONTEXT = /\\text\{[A-Za-z][A-Za-z0-9]*\$\\grave\{ ?\}\$([A-Za-z][A-Za-z0-9]*)\}/g;

/** A matrix: Wolfram writes a rectangular list of lists as an array. */
const ARRAY =
  /\\left\(\s*\\begin\{array\}\{c+\}((?:(?!\\begin\{array\}).)*?)\\end\{array\}\s*\\right\)/gs;
const toRows = (_: string, body: string): string => {
  const rows = body.split("\\\\").filter((row) => row.trim() !== "");
  const list = (cells: string[]): string => `\\lbrack ${cells.join(", ")}\\rbrack `;
  return list(rows.map((row) => list(row.split("&").map((cell) => cell.trim()))));
};

/** How notatio writes a head it has no notation for, by compute-engine name: the TeX before
 *  its argument parentheses (`Round` → `\mathrm{round}`). Only notatio knows its spelling, so
 *  it passes these in; a head without one is `\operatorname{Name}`. */
export interface TeXOptions {
  readonly heads?: ReadonlyMap<string, string>;
}

/** A power's base: a number, a letter, a command, a `{…}` or `(…)` group -- not a command's
 *  argument (`\text{erf}^{-1}`) or a call's (`\sin(x)^2`). */
const BASE = String.raw`(\d+|[a-zA-Z]|\\[a-zA-Z]+|(?<![\\a-zA-Z}])(?:\{[^{}]*\}|\([^()]*\)))`;
const bare = (base: string): string => (/^[{(].*[)}]$/.test(base) ? base.slice(1, -1) : base);

/** Wolfram `TeXForm` output in notatio's spelling. */
export function fromWolframTeX(tex: string, options: TeXOptions = {}): string {
  const written = (name: string | undefined): string =>
    options.heads?.get(ceName(name)) ?? `\\operatorname{${ceName(name)}}`;
  let out = apply(tex, [
    [/\\log(?![a-zA-Z])(?!\s*_)/g, "\\ln"],
    // A subscripted base, powered: `\left(L_5\right){}^2`.
    [/\\left\(\s*([A-Za-z]_(?:\{[^{}]*\}|\w))\s*\\right\)\{\}\^/g, "$1^"],
    // Part: `x[[i]]`, which notatio writes `x[i]`.
    [/\[\[((?:(?!\]\]).)*)\]\]/g, "[$1]"],
    // Roots and reciprocals, as notatio writes them (Wolfram does too, but inside a PowerMod).
    [
      new RegExp(String.raw`${BASE}\^\{\\frac\{1\}\{(\d+|[a-z])\}\}`, "g"),
      (_, b, n) => (n === "2" ? `\\sqrt{${bare(b)}}` : `\\sqrt[${n}]{${bare(b)}}`),
    ],
    [
      new RegExp(String.raw`${BASE}\^\{-(\d+)\}`, "g"),
      (_, b, n) => (n === "1" ? `\\frac{1}{${bare(b)}}` : `\\frac{1}{${b}^{${n}}}`),
    ],
    [
      MARKED_NUMBER,
      (_, m, e) => (e === undefined ? m : `${m}\\cdot10^{${e}}`).replace(/\.(?=\\|$)/, ""),
    ],
    [CONTEXT, "\\text{$1}"],
    [ARRAY, toRows],
    ...INVERSES.map(([w, ours]): Rule => [new RegExp(`${word(w)}\\s*\\^\\{-1\\}`, "g"), ours]),
  ]);
  out = withGroup(out, `(${POWERED})\\s*\\^(${SCRIPT})`, (m, o, x, c) =>
    o.includes("[") ? undefined : `${m[1]}${o}${x}${c}^{${unbrace(m[2] as string)}}`,
  );
  // notatio writes `e^{x}` for a number or a symbol, `\exp(…)` for anything longer.
  out = withGroup(out, /\\exp(?![a-zA-Z])\s*/, (_, o, x) =>
    o.endsWith("(") && /^\s*(?:-?\d+(?:\.\d+)?|[a-zA-Z]|\\[a-zA-Z]+)\s*$/.test(x)
      ? `e^{${x.trim()}}`
      : undefined,
  );
  // A set, as `toWolfram` writes one, before its list is taken for a list.
  out = withGroup(out, /\\text\{Union\}\s*/, (_, o, x) => {
    const inner = bracketed(x.trim(), 0);
    return o.includes("[") && inner?.[0].includes("\\{") && inner[3] === x.trim().length
      ? `\\lbrace ${inner[1]}\\rbrace`
      : undefined;
  });
  out = withGroup(out, HEAD, (m, o, x, c) =>
    o.endsWith("[") ? `${written(m[1] ?? m[2])}${size(o)}(${x}${sizeClose(c)})` : undefined,
  );
  // A head named on its own, as an argument: `\text{Plus}`.
  out = out.replace(/\\text\{([A-Z][A-Za-z0-9]*)\}/g, (t, name: string) =>
    options.heads?.has(ceName(name)) || ceName(name) !== name ? written(name) : t,
  );
  // Multinomial's `(n;a,b)`: a bare parenthesis, not a call's.
  out = withGroup(out, /(?<![\\a-zA-Z}_^])(?=(?:\\left)?\()/, (_, o, x) => {
    const multinomial = /^([^;]+);(.*)$/s.exec(x);
    return o.endsWith("(") && multinomial
      ? `\\binom{${multinomial[1]}}{${multinomial[2]}}`
      : undefined;
  });
  return apply(out, [
    [/\\\{/g, "\\lbrack "],
    [/\\\}/g, "\\rbrack "],
    ...SYNONYMS.map(([w, ours]): Rule => [new RegExp(word(w), "g"), ours]),
    [/\\nu(?![a-zA-Z])(?=\s*(?:\\left)?\()/g, "\\omega"],
    [/(?<!\\)\|/g, "\\vert "],
    [/(?<=\d)(?:\s*\\ \s*|\s+)(?=\d)/g, "\\times "],
    [
      new RegExp(`\\\\mathcal\\{S\\}_(${SCRIPT})\\^\\{\\(([^{}()]*)\\)\\}`, "g"),
      (_, n, k) =>
        `\\left\\lbrace\\begin{matrix}${unbrace(n as string)}\\\\${k}\\end{matrix}\\right\\rbrace`,
    ],
    [
      new RegExp(`(?<![\\\\a-zA-Z])S_(${SCRIPT})\\^\\{\\(([^{}()]*)\\)\\}`, "g"),
      (_, n, k) => `s(${unbrace(n as string)}, ${k})`,
    ],
  ]);
}

/** notatio's TeX in Wolfram's spelling. */
export function toWolframTeX(tex: string, options: TeXOptions = {}): string {
  const names = new Map([...(options.heads ?? [])].map(([ce, w]) => [w, ce]));
  let out = apply(tex, [
    [/(?<=(?:\\rbrack|\])\s*)\[([^[\]]*)\]/g, "[[$1]]"],
    [/\\ln(?![a-zA-Z])/g, "\\log"],
    [/(?<=\d)\\,(?=\d)/g, ""],
    [
      /(-?\d+\.\d*)\\cdot10\^\{(-?\d+)\}/g,
      (_, m, e) => `\\text{${m}$\\grave{ }$*\${}^{\\wedge }$${e}}`,
    ],
    ...INVERSES.map(([w, ours]): Rule => [new RegExp(word(ours), "g"), `${w}^{-1}`]),
  ]);
  // A list of equal-length lists is a matrix.
  out = withGroup(out, /(?=(?:\\bigl)?\\lbrack)/, (_, o, x) => {
    if (!o.endsWith("\\lbrack")) return undefined;
    const cells = splitTop(x, ",").map((text) => {
      const row = bracketed(text.trim(), 0);
      return row?.[0].endsWith("\\lbrack") && row[3] === text.trim().length
        ? splitTop(row[1], ",")
        : undefined;
    });
    const width = cells[0]?.length ?? 0;
    if (width === 0 || cells.some((row) => row?.length !== width)) return undefined;
    const body = (cells as string[][]).map((row) => row.map((c) => c.trim()).join(" & "));
    return `\\left(\\begin{array}{${"c".repeat(width)}}${body.map((row) => `${row} \\\\ `).join("")}\\end{array}\\right)`;
  });
  out = out.replace(
    new RegExp(`(${POWERED})((?:\\\\left)?\\([^()]*(?:\\\\right)?\\))\\^(${SCRIPT})`, "g"),
    (_, f, arg, p) => `${f}^${unbrace(p).length === 1 ? unbrace(p) : p}${arg}`,
  );
  out = apply(out, [
    [
      /\\left\\lbrace\\begin\{matrix\}([^\\]*)\\\\([^\\]*)\\end\{matrix\}\\right\\rbrace/g,
      "\\mathcal{S}_{$1}^{($2)}",
    ],
    [/(?<![\\a-zA-Z])s\(([^,()]+),\s*([^,()]+)\)/g, "S_{$1}^{($2)}"],
    [/\\binom\{([^{}]*)\}\{([^{},]*,[^{}]*)\}/g, "($1;$2)"],
  ]);
  // Wolfram writes a head it has no notation for as its name and brackets.
  out = withGroup(out, /(\\(?:operatorname|mathrm)\{([A-Za-z][A-Za-z0-9]*)\})\s*/, (m, o, x, c) => {
    const bareName = m[2] as string;
    const name =
      names.get(m[1] as string) ??
      (/^[A-Z]./.test(bareName) || isSystemName(bareName) ? bareName : undefined);
    return o.endsWith("(") && name !== undefined
      ? `\\text{${HEADS[name] ?? name}}${size(o)}[${x}${sizeClose(c)}]`
      : undefined;
  });
  return apply(out, [
    [/(?:\\(?:bigl|Bigl|left))?\\lbrace\s*/g, "\\text{Union}[\\{"],
    [/(?:\\(?:bigr|Bigr|right))?\\rbrace/g, "\\}]"],
    [/(?:\\(?:bigl|Bigl|left))?\\lbrack\s*/g, "\\{"],
    [/(?:\\(?:bigr|Bigr|right))?\\rbrack/g, "\\}"],
    ...SYNONYMS.map(([w, ours]): Rule => [new RegExp(word(ours), "g"), w]),
    [/\\omega(?![a-zA-Z])(?=\s*(?:\\left)?\()/g, "\\nu"],
    [/\\vert(?![a-zA-Z])\s*/g, "|"],
    [/(?<=\d)\s*\\times\s*(?=\d)/g, "\\ "],
  ]);
}
