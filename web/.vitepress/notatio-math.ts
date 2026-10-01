// markdown-it's own types are not resolvable from here (VitePress bundles it rather
// than exposing it as a dependency of this package), so describe the handful of
// members these two rules touch rather than adding @types/markdown-it for three
// signatures.
interface Token {
  content: string;
  meta: unknown;
  markup: string;
  map: [number, number] | null;
}
interface StateInline {
  src: string;
  pos: number;
  posMax: number;
  push(type: string, tag: string, nesting: number): Token;
}
interface StateBlock {
  src: string;
  line: number;
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  push(type: string, tag: string, nesting: number): Token;
}

// `$latex$` and `$$latex$$` in markdown pages, typeset by KaTeX at build: TeX held as written,
// recognised by the same rule as record prose (boxes' `closeDollar`), and drawn by the same
// `tex` (prose.ts), so a formula in a guide and in a reference entry are one thing.
import { closeDollar } from "@enumeratio/boxes/render";
import { tex } from "./prose.ts";

// Vue compiles the page as a template, so `{{` would be an interpolation; KaTeX's MathML
// annotation carries the TeX, braces and all, and as entities the browser still reads them as
// braces. The TeX rides in `meta`, not `content`: VitePress's markdown-it-attrs reads a token's
// content and would claim a trailing `{…}` (`\end{pmatrix}` in a table cell) as attributes.
const vueSafe = (html: string): string => html.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");

/** Inline `$…$`. Code spans are consumed whole by the backticks rule before this sees them. */
function mathInline(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
  const end = closeDollar(state.src, state.pos, state.posMax);
  if (end < 0) return false;
  if (!silent) {
    const token = state.push("notatio_math_inline", "", 0);
    token.meta = state.src.slice(state.pos + 1, end);
    token.markup = "$";
  }
  state.pos = end + 1;
  return true;
}

/** Block `$$ … $$`, on its own lines. Rendered in display style. */
function mathBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const open = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max = state.eMarks[startLine]!;
  if (open + 2 > max || state.src.slice(open, open + 2) !== "$$") return false;

  // Either `$$ … $$` on one line, or an opening `$$` and a later closing `$$`.
  const firstLine = state.src.slice(open + 2, max).trim();
  let lastLine = startLine;
  let body = firstLine;
  if (!firstLine.endsWith("$$")) {
    let line = startLine;
    for (;;) {
      line++;
      if (line >= endLine) return false;
      const from = state.bMarks[line]! + state.tShift[line]!;
      const to = state.eMarks[line]!;
      const text = state.src.slice(from, to);
      if (text.trim().endsWith("$$")) {
        body = `${firstLine}\n${state.src.slice(state.bMarks[startLine + 1] ?? from, to)}`;
        lastLine = line;
        break;
      }
    }
  } else {
    lastLine = startLine;
  }
  body = body.replace(/\$\$\s*$/, "").trim();
  if (body === "") return false;
  if (silent) return true;

  const token = state.push("notatio_math_block", "", 0);
  token.meta = body;
  token.map = [startLine, lastLine + 1];
  state.line = lastLine + 1;
  return true;
}

/** The slice of markdown-it's API this plugin uses. */
interface MarkdownItLike {
  inline: { ruler: { before(name: string, rule: string, fn: unknown): void } };
  block: { ruler: { before(name: string, rule: string, fn: unknown, opts?: unknown): void } };
  renderer: { rules: Record<string, unknown> };
}

/** Install the `$…$` / `$$…$$` rules on a markdown-it instance. */
export function notatioMath(md: MarkdownItLike): void {
  md.inline.ruler.before("escape", "notatio_math_inline", mathInline);
  md.block.ruler.before("fence", "notatio_math_block", mathBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  const rules = md.renderer.rules as Record<string, (tokens: { meta: unknown }[], index: number) => string>;
  rules["notatio_math_inline"] = (tokens, index) => vueSafe(tex(tokens[index]!.meta as string, false));
  rules["notatio_math_block"] = (tokens, index) => `${vueSafe(tex(tokens[index]!.meta as string, true))}\n`;
}
