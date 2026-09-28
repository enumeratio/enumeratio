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
// reference entry look identical, and neither needs a second math library. The actual
// span-recognition and escaping live in prose-math.ts, shared with ReferencePage.vue's
// non-markdown record prose.
import { escapeAttr, matchInlineMath, texTag as tex, trimDisplayBody } from "./prose-math.ts";

/**
 * Inline `$…$`. Deliberately conservative, because `$` is load-bearing elsewhere in
 * these docs: `${…}` is Manipulate's template placeholder and `$params` is a VitePress
 * route variable. So the opening `$` must be followed by something that is neither a
 * brace nor whitespace, the closing `$` must not be preceded by whitespace, and the
 * span must not cross a line. (Code spans are consumed whole by the backticks rule
 * before this ever sees them, so `` `${n}` `` is safe regardless.) The match itself is
 * `matchInlineMath` from prose-math.ts, shared with ReferencePage.vue.
 */
function mathInline(state: StateInline, silent: boolean): boolean {
  const m = matchInlineMath(state.src, state.pos, state.posMax);
  if (!m) return false;

  if (!silent) {
    const token = state.push("notatio_math_inline", "", 0);
    token.content = escapeAttr(m.content);
    token.markup = "$";
  }
  state.pos = m.end;
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
  body = trimDisplayBody(body);
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
  const rules = md.renderer.rules as Record<string, (tokens: { content: string }[], index: number) => string>;
  rules["notatio_math_inline"] = (tokens, index) => tex(tokens[index]!.content);
  rules["notatio_math_block"] = (tokens, index) => `${tex(tokens[index]!.content.replace(/\n/g, " "), true)}\n`;
}
