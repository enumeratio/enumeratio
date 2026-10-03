// Prose boxes as HTML. The typesetter is passed in -- KaTeX's `renderToString` on a page,
// at build or in the browser -- so this package keeps no runtime dependency.

import { type Box, type BoxNode, isBoxSequence, isNode, optionsOfBox } from "../box.ts";
import { toLatex } from "./latex.ts";
import { texSource } from "./markdown.ts";

export interface HtmlOptions {
  /** HTML for a formula's TeX. */
  readonly tex: (latex: string, display: boolean) => string;
  /** The href for a `[[Head]]` link, or `undefined` to leave it as text. */
  readonly link?: (head: string) => string | undefined;
  /**
   * A hole's fill: HTML in running text, TeX inside a formula. Unfilled (`undefined`), a
   * hole shows as written.
   */
  readonly hole?: (hole: Hole, where: "text" | "tex") => string | undefined;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const HEADING: Readonly<Record<string, string>> = {
  Title: "h1",
  Section: "h2",
  Subsection: "h3",
  Subsubsection: "h4",
  Subsubsubsection: "h5",
  Subsubsubsubsection: "h6",
};
const LIST: Readonly<Record<string, readonly [level: number, tag: "ul" | "ol"]>> = {
  Item: [0, "ul"],
  Subitem: [1, "ul"],
  Subsubitem: [2, "ul"],
  ItemNumbered: [0, "ol"],
  SubitemNumbered: [1, "ol"],
  SubsubitemNumbered: [2, "ol"],
};

export type Hole = Extract<BoxNode, readonly ["TemplateSlot" | "TemplateExpression", ...unknown[]]>;

const isHole = (box: Box): box is Hole => isNode(box) && (box[0] === "TemplateSlot" || box[0] === "TemplateExpression");

const written = (hole: Hole): string => `\${${hole[1] as string}}`;

class Writer {
  private readonly options: HtmlOptions;
  constructor(options: HtmlOptions) {
    this.options = options;
  }

  /** A TeX box's source, holes filled (or written in `\text`). */
  private texOf(box: Box): string {
    if (typeof box === "string") return box;
    if (isHole(box)) return this.options.hole?.(box, "tex") ?? `\\text{\\$\\{${box[1] as string}\\}}`;
    if (box[0] === "RowBox") return box[1].map((b) => this.texOf(b)).join("");
    return texSource(box);
  }

  formula(box: BoxNode & readonly ["FormBox", Box, string], display: boolean): string {
    const latex = box[2] === "TeXForm" ? this.texOf(box[1]) : toLatex(box[1]);
    return this.options.tex(latex, display);
  }

  /** Link each head called in inline code (`Count(Subsets(n))`) to its page, where the site has one. */
  linkCalls(html: string): string {
    const link = this.options.link;
    if (!link) return html;
    return html.replace(/\b[A-Z][A-Za-z0-9]*(?=\()/g, (name) => {
      const href = link(name);
      return href === undefined ? name : `<a href="${escapeHtml(href)}">${name}</a>`;
    });
  }

  inline(box: Box): string {
    if (typeof box === "string") return escapeHtml(box);
    const options = optionsOfBox(box);
    switch (box[0]) {
      case "TextData":
        return box[1].map((b) => this.inline(b)).join("");
      case "StyleBox": {
        if (options.BaseStyle === "InlineCode") return `<code>${this.linkCalls(this.inline(box[1]))}</code>`;
        let html = this.inline(box[1]);
        if (options.FontSlant === "Italic") html = `<em>${html}</em>`;
        if (options.FontWeight === "Bold") html = `<strong>${html}</strong>`;
        return html;
      }
      case "ButtonBox": {
        const label = this.inline(box[1]);
        const target = String(options.ButtonData ?? "");
        const href = options.BaseStyle === "Link" ? this.options.link?.(target) : target;
        return href === undefined ? label : `<a href="${escapeHtml(href)}">${label}</a>`;
      }
      case "FormBox":
        return this.formula(box, false);
      case "TemplateSlot":
      case "TemplateExpression":
        return this.options.hole?.(box, "text") ?? escapeHtml(written(box));
      case "TextCell":
        return this.inline(box[1]);
      default:
        // Formula boxes in running text: typeset them.
        return this.options.tex(toLatex(box), false);
    }
  }

  cells(boxes: readonly Box[]): string {
    let html = "";
    // Open lists, outermost first.
    const open: ("ul" | "ol")[] = [];
    const closeTo = (depth: number): void => {
      while (open.length > depth) html += `</li></${open.pop()}>`;
    };
    for (const box of boxes) {
      if (!isNode(box) || box[0] !== "TextCell") {
        closeTo(0);
        html += this.inline(box);
        continue;
      }
      const [, content, style] = box;
      const list = LIST[style];
      if (list) {
        const [level, tag] = list;
        closeTo(level + 1);
        if (open.length === level + 1 && open[level] !== tag) closeTo(level);
        if (open.length === level + 1) html += "</li><li>";
        while (open.length <= level) {
          const t = open.length === level ? tag : "ul";
          open.push(t);
          html += `<${t}><li>`;
        }
        html += this.inline(content);
        continue;
      }
      closeTo(0);
      const heading = HEADING[style];
      if (heading) html += `<${heading}>${this.inline(content)}</${heading}>`;
      else if (style === "Program") {
        const language = optionsOfBox(box).Language;
        const cls = language === undefined ? "" : ` class="language-${escapeHtml(String(language))}"`;
        html += `<pre><code${cls}>${escapeHtml(typeof content === "string" ? content : "")}</code></pre>`;
      } else if (style === "DisplayFormula" && isNode(content) && content[0] === "FormBox") {
        html += this.formula(content, true);
      } else if (style === "Quote") html += `<blockquote><p>${this.inline(content)}</p></blockquote>`;
      else html += `<p>${this.inline(content)}</p>`;
    }
    closeTo(0);
    return html;
  }
}

/** Prose boxes as HTML: a sequence of `TextCell`s as blocks, anything else inline. */
export function toHtml(boxes: Box | readonly Box[], options: HtmlOptions): string {
  const writer = new Writer(options);
  if (isBoxSequence(boxes)) return writer.cells(boxes);
  return isNode(boxes) && boxes[0] === "TextCell" ? writer.cells([boxes]) : writer.inline(boxes);
}
