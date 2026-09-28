// Shared by notatio-math.ts (the `$…$` / `$$…$$` markdown-it plugin, for full markdown
// pages) and ReferencePage.vue (record prose -- summaries, details, captions, notes --
// which is raw text, not markdown, so it never goes through markdown-it at all). Both
// used to run their own regex for the inline case; this is the one implementation, so a
// formula reads the same whether it's in a guide or a reference entry.

// Braces are escaped as entities as well as the usual four: VitePress's markdown pages run
// markdown-it-attrs, which claims a trailing `{…}` in a table cell as an attribute block
// and would swallow the `{-1}` out of `$\sqrt{-1}$`. Vue would also read a `{{` as an
// interpolation. The browser decodes the entities either way, so the element still sees
// the LaTeX it was given.
export const escapeAttr = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");

/** Plain HTML-escaping for prose text that isn't going into an attribute. */
export const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `<notatio-out>` for a math span. `escapedLatex` must already be `escapeAttr`-ed -- this
 * does not escape it again, so a caller that already built the attribute value (as
 * notatio-math.ts's token content does) can pass it straight through. */
export const texTag = (escapedLatex: string, display = false): string =>
  `<notatio-out ${display ? "display" : "inline"} format="latex" value="${escapedLatex}"></notatio-out>`;

/**
 * Find one inline `$…$` span starting at `src[start]` (which must be `$`). Deliberately
 * conservative, because `$` is load-bearing elsewhere: `${…}` is Manipulate's template
 * placeholder, `$params` is a VitePress route variable, and a handful of reference entries
 * use Wolfram's own `$Aborted`/`$Assumptions`-style system symbols in prose. So the opening
 * `$` must be followed by something that is neither a brace nor whitespace, the closing `$`
 * must not be preceded by whitespace, and the span must not cross a newline.
 *
 * Returns the raw (unescaped) LaTeX and the index just past the closing `$`, or `undefined`
 * if `start` isn't a valid opening -- in which case the `$` is a literal character, not a
 * math delimiter.
 *
 * `max` bounds the scan (defaults to the end of `src`) -- markdown-it's inline state can
 * restrict parsing to a sub-range of a larger buffer via `posMax`, so this takes the same
 * bound rather than assuming the whole string is in play.
 */
export function matchInlineMath(
  src: string,
  start: number,
  max = src.length,
): { content: string; end: number } | undefined {
  if (src.charCodeAt(start) !== 0x24 /* $ */) return undefined;
  const after = src[start + 1];
  if (after === undefined || after === "{" || after === "$" || /\s/.test(after)) return undefined;

  let end = start + 1;
  while (end < max) {
    const ch = src[end]!;
    if (ch === "\n") return undefined;
    if (ch === "$" && src[end - 1] !== "\\" && !/\s/.test(src[end - 1]!)) break;
    end++;
  }
  if (end >= max || src[end] !== "$") return undefined;
  return { content: src.slice(start + 1, end), end: end + 1 };
}

/** Trim a display span's body the same way whether it came from a markdown `$$…$$` block
 * or a plain-text one: drop a trailing `$$` left over from a same-line close, then trim. */
export const trimDisplayBody = (s: string): string => s.replace(/\$\$\s*$/, "").trim();

/**
 * Render one prose field -- a record's summary, a detail bullet, an example caption, an
 * implementation note -- as inline HTML. This is raw text, not markdown: nothing but `$…$`
 * inline math, `$$…$$` display math, and `\$` for a literal dollar sign is recognized.
 * Everything else is HTML-escaped, since this is meant for `v-html` and the text is
 * authored prose that may contain `<`, `>` or `&` (a bare inequality like `x < 0`, a type
 * like `tuple<list<integer>, integer>`) with no intention of it being read as markup.
 */
export function renderProseMath(text: string): string {
  let out = "";
  let plain = "";
  const flush = (): void => {
    if (plain !== "") {
      out += escapeHtml(plain);
      plain = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === "\\" && text[i + 1] === "$") {
      plain += "$";
      i += 2;
      continue;
    }
    if (ch === "$" && text[i + 1] === "$") {
      const close = text.indexOf("$$", i + 2);
      const body = close === -1 ? "" : trimDisplayBody(text.slice(i + 2, close));
      if (close !== -1 && body !== "") {
        flush();
        out += texTag(escapeAttr(body), true);
        i = close + 2;
        continue;
      }
    }
    if (ch === "$") {
      const m = matchInlineMath(text, i);
      if (m) {
        flush();
        out += texTag(escapeAttr(m.content));
        i = m.end;
        continue;
      }
    }
    plain += ch;
    i++;
  }
  flush();
  return out;
}
