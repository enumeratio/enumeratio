// Record prose (summaries, details, captions, notes) through the prose boxes
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Prose-Pipeline): markdown read into boxes, then HTML, with `$…$`
// typeset by KaTeX from its TeX as written. Synchronous, so the same call renders at build
// and in the browser.

import { type Box } from "@enumeratio/boxes";
import { katexStrict, readInlineMarkdown, readMarkdown, toHtml } from "@enumeratio/boxes/render";
import katex from "katex";

const typeset = new Map<string, string>();

/** HTML for TeX, memoised: a page repeats its formulas, and the site repeats its pages. */
export function tex(latex: string, display: boolean): string {
  const key = `${display ? "D" : "I"}${latex}`;
  let html = typeset.get(key);
  if (html === undefined) {
    html = katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      output: "htmlAndMathml",
      strict: katexStrict(),
    });
    typeset.set(key, html);
  }
  return html;
}

export interface ProseOptions {
  /** The href for `[[Head]]`, or `undefined` to leave the name as text. */
  readonly link?: (head: string) => string | undefined;
}

/** One line of prose (a summary, a caption) as inline HTML. */
export const renderInline = (markdown: string, options: ProseOptions = {}): string =>
  toHtml(readInlineMarkdown(markdown), { tex, ...options });

/** Prose as block HTML; a single paragraph stays inline, for a list item or a table cell. */
export function renderBlock(markdown: string, options: ProseOptions = {}): string {
  const cells = readMarkdown(markdown);
  const only = cells.length === 1 ? (cells[0] as readonly [string, Box, string]) : undefined;
  return toHtml(only?.[2] === "Text" ? only[1] : cells, { tex, ...options });
}

/** A whole markdown document (a record's body) as block HTML. */
export const renderProse = (markdown: string, options: ProseOptions = {}): string =>
  toHtml(readMarkdown(markdown), { tex, ...options });
