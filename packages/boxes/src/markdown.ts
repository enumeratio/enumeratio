// Markdown as prose boxes, and back (https://github.com/enumeratio/enumeratio/wiki/Speculative-Prose-Pipeline). One pass, no
// parser behind it: a `$…$` island is TeX held as written (`FormBox(tex, "TeXForm")`), and
// a `${…}` hole is found by scanning, in running text and inside TeX alike, as Observable
// does. The subset is what records and guides use: paragraphs, ATX headings, lists, block
// quotes, fenced code, `$$` display blocks; emphasis, strong, code spans, links, `[[Head]]`.

import { type Box, type BoxNode, isBoxSequence, isNode, type Options, optionsOfBox } from "./box.ts";

const HEADINGS = ["Title", "Section", "Subsection", "Subsubsection", "Subsubsubsection", "Subsubsubsubsection"];
const ITEMS = ["Item", "Subitem", "Subsubitem"];
const NUMBERED = ["ItemNumbered", "SubitemNumbered", "SubsubitemNumbered"];

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9]*$/;

// ---------------------------------------------------------------------------------------
// Inline

/** The index just past the `}` closing the `{` at `open`, or -1. */
function closeBrace(s: string, open: number, max = s.length): number {
  let depth = 0;
  for (let i = open; i < max; i++) {
    if (s[i] === "\\") i++;
    else if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i + 1;
  }
  return -1;
}

/** A `${…}` hole at `i`: `undefined` when it isn't one (`${}` is TeX's empty group). */
function holeAt(s: string, i: number, max = s.length): { box: Box; end: number } | undefined {
  if (s[i] !== "$" || s[i + 1] !== "{") return undefined;
  const end = closeBrace(s, i + 1, max);
  if (end < 0) return undefined;
  const source = s.slice(i + 2, end - 1).trim();
  if (source === "") return undefined;
  return { box: IDENTIFIER.test(source) ? ["TemplateSlot", source] : ["TemplateExpression", source], end };
}

/** TeX with its holes: a string, or a `RowBox` of TeX fragments around them. */
function texWithHoles(tex: string): Box {
  const parts: Box[] = [];
  let run = "";
  for (let i = 0; i < tex.length;) {
    if (tex[i] === "\\") {
      run += tex.slice(i, i + 2);
      i += 2;
      continue;
    }
    const hole = holeAt(tex, i);
    if (hole) {
      if (run) parts.push(run);
      parts.push(hole.box);
      run = "";
      i = hole.end;
      continue;
    }
    run += tex[i++];
  }
  if (run) parts.push(run);
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : ["RowBox", parts];
}

const tex = (source: string): Box => ["FormBox", texWithHoles(source), "TeXForm"];

/**
 * The `$` closing an inline island opened at `start`, as Pandoc has it: the opener isn't
 * followed by a space, the closer isn't preceded by one or followed by a digit, and a hole
 * inside is skipped whole. -1 when there's no island (a bare `$` is a dollar sign).
 */
function closeDollar(s: string, start: number, max: number): number {
  const after = s[start + 1];
  if (after === undefined || after === "$" || /\s/.test(after)) return -1;
  for (let i = start + 1; i < max; i++) {
    const c = s[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "$" && s[i + 1] === "{") {
      const hole = holeAt(s, i, max);
      if (hole) {
        i = hole.end - 1;
        continue;
      }
    }
    if (c === "$") return /\s/.test(s[i - 1]!) || /\d/.test(s[i + 1] ?? "") ? -1 : i;
  }
  return -1;
}

const PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

class Inline {
  readonly items: Box[] = [];
  private run = "";
  private readonly s: string;
  constructor(s: string) {
    this.s = s;
  }

  private push(box: Box): void {
    if (this.run) this.items.push(this.run);
    this.run = "";
    this.items.push(box);
  }

  /** Where the delimiter run `d` closes, from `from`: preceded by a non-space. */
  private closer(d: string, from: number): number {
    for (let i = from; i < this.s.length; i++) {
      if (this.s[i] === "\\") i++;
      else if (this.s[i] === "`") {
        const run = /^`+/.exec(this.s.slice(i))![0];
        const end = this.s.indexOf(run, i + run.length);
        if (end > 0) i = end + run.length - 1;
      } else if (this.s.startsWith(d, i) && !/\s/.test(this.s[i - 1]!) && i > from) {
        // `_` closes only at a word's end, so `a_1` in prose is text.
        if (d[0] === "_" && /[\p{L}\p{N}]/u.test(this.s[i + d.length] ?? "")) continue;
        // `*` closing `*…*` isn't half of a `**`.
        if (d.length === 1 && this.s[i + 1] === d) {
          i++;
          continue;
        }
        return i;
      }
    }
    return -1;
  }

  read(): Box[] {
    const s = this.s;
    for (let i = 0; i < s.length;) {
      const c = s[i]!;
      if (c === "\\" && PUNCTUATION.test(s[i + 1] ?? "")) {
        this.run += s[i + 1];
        i += 2;
        continue;
      }
      if (c === "`") {
        const run = /^`+/.exec(s.slice(i))![0];
        const end = s.indexOf(run, i + run.length);
        if (end > 0) {
          const code = s.slice(i + run.length, end);
          const trimmed = /^ .* $/.test(code) && code.trim() !== "" ? code.slice(1, -1) : code;
          this.push(["StyleBox", trimmed, { BaseStyle: "InlineCode" }]);
          i = end + run.length;
          continue;
        }
        this.run += run;
        i += run.length;
        continue;
      }
      if (c === "$") {
        const hole = holeAt(s, i);
        if (hole) {
          this.push(hole.box);
          i = hole.end;
          continue;
        }
        if (s[i + 1] === "$") {
          const end = s.indexOf("$$", i + 2);
          if (end > i + 2) {
            this.push(tex(s.slice(i + 2, end).trim()));
            i = end + 2;
            continue;
          }
        }
        const end = closeDollar(s, i, s.length);
        if (end > 0) {
          this.push(tex(s.slice(i + 1, end)));
          i = end + 1;
          continue;
        }
      }
      if (c === "[" && s[i + 1] === "[") {
        const m = /^\[\[([A-Za-z][A-Za-z0-9]*)\]\]/.exec(s.slice(i));
        if (m) {
          this.push(["ButtonBox", m[1]!, { BaseStyle: "Link", ButtonData: m[1]! }]);
          i += m[0].length;
          continue;
        }
      }
      if (c === "[") {
        const close = this.bracket(i);
        const m = close < 0 ? null : /^\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/.exec(s.slice(close + 1));
        if (m) {
          const label = new Inline(s.slice(i + 1, close)).read();
          this.push(["ButtonBox", textDataOf(label), { BaseStyle: "Hyperlink", ButtonData: m[1]! }]);
          i = close + 1 + m[0].length;
          continue;
        }
      }
      if ((c === "*" || c === "_") && !/\s/.test(s[i + 1] ?? " ")) {
        const d = s[i + 1] === c ? c + c : c;
        const wordBefore = c === "_" && /[\p{L}\p{N}]/u.test(s[i - 1] ?? "");
        const end = wordBefore ? -1 : this.closer(d, i + d.length);
        if (end > 0) {
          const inner = new Inline(s.slice(i + d.length, end)).read();
          const options: Options = d.length === 2 ? { FontWeight: "Bold" } : { FontSlant: "Italic" };
          this.push(["StyleBox", textDataOf(inner), options]);
          i = end + d.length;
          continue;
        }
      }
      this.run += c;
      i++;
    }
    if (this.run) this.items.push(this.run);
    return this.items;
  }

  /** The `]` matching the `[` at `open`, or -1. */
  private bracket(open: number): number {
    let depth = 0;
    for (let i = open; i < this.s.length; i++) {
      if (this.s[i] === "\\") i++;
      else if (this.s[i] === "[") depth++;
      else if (this.s[i] === "]" && --depth === 0) return i;
    }
    return -1;
  }
}

/** A single item stands alone; several are a `TextData`. */
const textDataOf = (items: readonly Box[]): Box =>
  items.length === 1 && typeof items[0] === "string" ? items[0] : ["TextData", items];

/** One line (or paragraph) of inline markdown as a `TextData`. */
export const readInlineMarkdown = (source: string): Box => ["TextData", new Inline(source).read()];

// ---------------------------------------------------------------------------------------
// Blocks

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)/;
const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;
const RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;

const startsBlock = (line: string): boolean =>
  FENCE.test(line) || HEADING.test(line) || ITEM.test(line) || QUOTE.test(line) || /^\s*\$\$/.test(line);

/** Markdown as a sequence of `TextCell`s. */
export function readMarkdown(source: string): Box[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const cells: Box[] = [];
  const cell = (content: Box, style: string, options?: Options): void => {
    cells.push(options ? ["TextCell", content, style, options] : ["TextCell", content, style]);
  };
  // List indents seen so far, so a sub-item's level is its place among them, not a fixed width.
  let indents: number[] = [];

  for (let i = 0; i < lines.length;) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const [, marker, language] = fence;
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i]!.trimStart().startsWith(marker!); i++) body.push(lines[i]!);
      i++;
      cell(body.join("\n"), "Program", language ? { Language: language } : undefined);
      indents = [];
      continue;
    }
    if (/^\s*\$\$/.test(line)) {
      const rest = line.trim().slice(2);
      const body: string[] = [];
      if (rest.trimEnd().endsWith("$$") && rest.trim() !== "") {
        body.push(rest.trimEnd().slice(0, -2));
        i++;
      } else {
        body.push(rest);
        for (i++; i < lines.length && !lines[i]!.trimEnd().endsWith("$$"); i++) body.push(lines[i]!);
        if (i < lines.length) body.push(lines[i]!.trimEnd().slice(0, -2));
        i++;
      }
      cell(tex(body.join("\n").trim()), "DisplayFormula");
      indents = [];
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      cell(readInlineMarkdown(heading[2] ?? ""), HEADINGS[heading[1]!.length - 1]!);
      indents = [];
      i++;
      continue;
    }
    if (RULE.test(line)) {
      i++;
      continue;
    }
    const quote = QUOTE.exec(line);
    if (quote) {
      const body: string[] = [];
      for (; i < lines.length && QUOTE.test(lines[i]!); i++) body.push(QUOTE.exec(lines[i]!)![1]!);
      for (const inner of readMarkdown(body.join("\n"))) {
        const node = inner as BoxNode & readonly ["TextCell", Box, string];
        cell(node[1], node[2] === "Text" ? "Quote" : node[2]);
      }
      continue;
    }
    const item = ITEM.exec(line);
    if (item) {
      const indent = item[1]!.length;
      indents = indents.filter((n) => n < indent);
      indents.push(indent);
      const level = Math.min(indents.length, ITEMS.length) - 1;
      const text = [item[3]!];
      // Continuation lines, indented or lazy, up to a blank line or the next block.
      for (i++; i < lines.length && lines[i]!.trim() !== "" && !startsBlock(lines[i]!); i++) {
        text.push(lines[i]!.trim());
      }
      const numbered = /\d/.test(item[2]!);
      cell(readInlineMarkdown(text.join(" ")), (numbered ? NUMBERED : ITEMS)[level]!);
      continue;
    }
    const text: string[] = [];
    for (; i < lines.length && lines[i]!.trim() !== "" && !startsBlock(lines[i]!); i++) text.push(lines[i]!.trim());
    cell(readInlineMarkdown(text.join(" ")), "Text");
    indents = [];
  }
  return cells;
}

// ---------------------------------------------------------------------------------------
// Back to markdown

/** A hole as written. */
const holeSource = (box: BoxNode): string => `\${${box[1] as string}}`;

/** A TeX box's source, holes written back in. */
export function texSource(box: Box): string {
  if (typeof box === "string") return box;
  if (box[0] === "RowBox") return box[1].map(texSource).join("");
  if (box[0] === "TemplateSlot" || box[0] === "TemplateExpression") return holeSource(box);
  return "";
}

const escapeMarkdown = (s: string): string => s.replace(/([\\`*_[\]$])/g, "\\$1");

function inlineMarkdown(box: Box): string {
  if (typeof box === "string") return escapeMarkdown(box);
  const options = optionsOfBox(box);
  switch (box[0]) {
    case "TextData":
      return box[1].map(inlineMarkdown).join("");
    case "StyleBox": {
      if (options.BaseStyle === "InlineCode") {
        const code = typeof box[1] === "string" ? box[1] : "";
        const ticks = "`".repeat(Math.max(0, ...[...code.matchAll(/`+/g)].map((m) => m[0].length)) + 1);
        return /^`|`$/.test(code) ? `${ticks} ${code} ${ticks}` : `${ticks}${code}${ticks}`;
      }
      const inner = inlineMarkdown(box[1]);
      if (options.FontWeight === "Bold") return `**${inner}**`;
      if (options.FontSlant === "Italic") return `*${inner}*`;
      return inner;
    }
    case "ButtonBox":
      if (options.BaseStyle === "Link") return `[[${String(options.ButtonData)}]]`;
      return `[${inlineMarkdown(box[1])}](${String(options.ButtonData ?? "")})`;
    case "FormBox":
      return box[2] === "TeXForm" ? `$${texSource(box[1])}$` : "";
    case "TemplateSlot":
    case "TemplateExpression":
      return holeSource(box);
    default:
      return "";
  }
}

/** Prose boxes as CommonMark, `$…$` islands and holes as written. */
export function toMarkdown(boxes: Box | readonly Box[]): string {
  const cells = isBoxSequence(boxes) ? boxes : [boxes];
  const out: string[] = [];
  let previous = "";
  for (const box of cells) {
    if (!isNode(box) || box[0] !== "TextCell") {
      out.push(inlineMarkdown(box));
      previous = "";
      continue;
    }
    const [, content, style] = box;
    const heading = HEADINGS.indexOf(style);
    const item = Math.max(ITEMS.indexOf(style), NUMBERED.indexOf(style));
    let block: string;
    if (heading >= 0) block = `${"#".repeat(heading + 1)} ${inlineMarkdown(content)}`;
    else if (item >= 0)
      block = `${"  ".repeat(item)}${NUMBERED.includes(style) ? "1." : "-"} ${inlineMarkdown(content)}`;
    else if (style === "Program") {
      const language = optionsOfBox(box).Language;
      block = `\`\`\`${language === undefined ? "" : String(language)}\n${typeof content === "string" ? content : ""}\n\`\`\``;
    } else if (style === "DisplayFormula") block = `$$\n${isNode(content) ? texSource(content[1] as Box) : ""}\n$$`;
    else if (style === "Quote") block = `> ${inlineMarkdown(content)}`;
    else block = inlineMarkdown(content);
    // Consecutive items stay one list; everything else is its own paragraph.
    const listed = item >= 0 ? "list" : "";
    out.push(listed && previous === listed ? `\n${block}` : `${out.length ? "\n\n" : ""}${block}`);
    previous = listed;
  }
  return out.join("");
}
