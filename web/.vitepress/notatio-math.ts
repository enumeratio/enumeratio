// markdown-it's own types are not resolvable from here (VitePress bundles it rather
// than exposing it as a dependency of this package), so describe the handful of
// members these two rules touch rather than adding @types/markdown-it for three
// signatures.
interface Token {
  content: string;
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

// `$latex$` and `$$latex$$` in markdown, rendered by MathLive through
// <notatio-out format="latex"> — the same path ReferencePage.vue already uses for
// the `$…$` in reference summaries. Routing prose math through the same component is the point:
// one renderer for the whole site, so a formula in a guide and a formula in a
// reference entry look identical, and neither needs a second math library.

// Braces are escaped as entities as well as the usual four: VitePress runs
// markdown-it-attrs, which claims a trailing `{…}` in a table cell as an attribute
// block and would swallow the `{-1}` out of `$\sqrt{-1}$`. Vue would also read a `{{`
// as an interpolation. The browser decodes the entities, so the element still sees
// the LaTeX it was given.
const escapeAttr = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");

// NOTE: tokens carry ALREADY-ESCAPED LaTeX. markdown-it-attrs runs after inline
// parsing and claims a trailing `{…}` in a table header cell as an attribute block,
// which ate the `{-1}` out of `$\sqrt{-1}$`. Escaping at token-creation time means no
// literal brace is left in the token for it to find.
const tex = (escaped: string, display = false): string =>
  `<notatio-out ${display ? "display" : "inline"} format="latex" value="${escaped}"></notatio-out>`;

/**
 * Inline `$…$`. Deliberately conservative, because `$` is load-bearing elsewhere in
 * these docs: `${…}` is Manipulate's template placeholder and `$params` is a VitePress
 * route variable. So the opening `$` must be followed by something that is neither a
 * brace nor whitespace, the closing `$` must not be preceded by whitespace, and the
 * span must not cross a line. (Code spans are consumed whole by the backticks rule
 * before this ever sees them, so `` `${n}` `` is safe regardless.)
 */
function mathInline(state: StateInline, silent: boolean): boolean {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;
  const after = state.src[start + 1];
  if (after === undefined || after === "{" || after === "$" || /\s/.test(after)) return false;

  let end = start + 1;
  while (end < state.posMax) {
    const ch = state.src[end]!;
    if (ch === "\n") return false;
    if (ch === "$" && state.src[end - 1] !== "\\" && !/\s/.test(state.src[end - 1]!)) break;
    end++;
  }
  if (end >= state.posMax || state.src[end] !== "$") return false;

  if (!silent) {
    const token = state.push("notatio_math_inline", "", 0);
    token.content = escapeAttr(state.src.slice(start + 1, end));
    token.markup = "$";
  }
  state.pos = end + 1;
  return true;
}

/** Block `$$ … $$`, on its own lines. Rendered in display style. */
function mathBlock(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
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
  token.content = escapeAttr(body);
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
  const rules = md.renderer.rules as Record<
    string,
    (tokens: { content: string }[], index: number) => string
  >;
  rules["notatio_math_inline"] = (tokens, index) => tex(tokens[index]!.content);
  rules["notatio_math_block"] = (tokens, index) =>
    `${tex(tokens[index]!.content.replace(/\n/g, " "), true)}\n`;
}
