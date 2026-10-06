// Expressions written as markup in a page (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup):
// `<Binomial>5 2</Binomial>`, `<PolyLog s="2">z</PolyLog>` or `<ToExpression value="…" />` in
// prose is read at build, its named slots placed by the head's parameters, and shown as its
// value: an evaluated `<notatio-out>`, inline in a sentence, or displayed when it has lines of
// its own. A tag that is a head but also a Vue component (`<Symbol>`, VitePress's `<Content>`)
// stays the component. Markup that doesn't read fails the build.

import { GRAPHICS_HEADS, GRAPHICS_OPTIONS } from "@enumeratio/formats";
import { parseExpression } from "@enumeratio/formats/expression";
import { readMarkupText } from "@enumeratio/formats/markup";
import { SYMBOLS } from "@enumeratio/manifest";

/** The components a page can use by a PascalCase tag: the theme's, VitePress's and Vue's. */
export const VUE_COMPONENTS: ReadonlySet<string> = new Set([
  // web/.vitepress/theme/index.mts (held to it by notatio-markup.test.ts)
  "Playground",
  "ElementsDemo",
  "ReferencePage",
  "ReferenceIndex",
  "ReferenceCatalog",
  "Story",
  "GlyphGallery",
  "LiveInput",
  "SourceOutput",
  "EnvironmentPreview",
  "ComponentIndex",
  "CliReference",
  "Symbol",
  "ComponentPage",
  "BenchViewer",
  // where the build writes what it rendered (prerender-markup.ts)
  "NotatioPrerendered",
  // VitePress and Vue
  "Badge",
  "ClientOnly",
  "Content",
  "Component",
  "KeepAlive",
  "Suspense",
  "Teleport",
  "Transition",
  "TransitionGroup",
]);

const HEADS: ReadonlySet<string> = new Set([...Object.keys(SYMBOLS), ...GRAPHICS_HEADS]);
const NAME = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/;

/** Whether a tag starts markup: `ToExpression`, a namespaced head, or a head no component claims. */
export function isMarkupTag(tag: string): boolean {
  if (VUE_COMPONENTS.has(tag)) return false;
  if (tag === "ToExpression") return true;
  // A namespace is lowercase as often as not (`enumeratio.PolygonalNumber`); the member is the head.
  if (tag.includes(".")) return /\.[A-Z][\w$]*$/.test(tag);
  return HEADS.has(tag);
}

/** The markup tag at `start` (just past a `<`), if one starts there. */
export function markupTagAt(src: string, start: number): string | undefined {
  const tag = NAME.exec(src.slice(start, start + 200))?.[0];
  return tag !== undefined && isMarkupTag(tag) && /[\s/>]/.test(src[start + tag.length] ?? "") ? tag : undefined;
}

/** The end of the element opening at `start`, past its closing tag, or -1 if it doesn't close by `max`. */
export function markupEnd(src: string, start: number, max = src.length): number {
  let depth = 0;
  let i = start;
  while (i < max) {
    if (src[i] !== "<") {
      i++;
      continue;
    }
    const closing = src[i + 1] === "/";
    let j = i + 1;
    let quote: string | undefined;
    for (; j < max; j++) {
      const c = src[j]!;
      if (quote !== undefined) {
        if (c === quote) quote = undefined;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
    }
    if (j >= max) return -1;
    depth += closing ? -1 : src[j - 1] === "/" ? 0 : 1;
    i = j + 1;
    if (depth <= 0) return i;
  }
  return -1;
}

/** The published libraries' parameter names (theme/libraries.ts), loaded with the site's config. */
let libraryParams: Readonly<Record<string, readonly string[]>> = {};

/** Give markup the libraries' parameter names, before any page is read. */
export const useLibraryParams = (params: Readonly<Record<string, readonly string[]>>): void => {
  libraryParams = params;
};

const paramsOf = (head: string): readonly string[] | undefined => SYMBOLS[head]?.params ?? libraryParams[head];

/** Markup text as MathJSON, or an error naming the page. */
export function readPageMarkup(text: string, page?: string): unknown {
  const { json, errors } = readMarkupText(text, {
    parseText: (epsil) => parseExpression(epsil),
    paramsOf,
    optionsOf: (head) => GRAPHICS_OPTIONS[head],
  });
  if (errors.length > 0 || json === undefined) {
    throw new Error(`${page ?? "a page"}: ${errors.join("; ") || "markup: nothing read"} in ${text}`);
  }
  return json;
}

// `{`/`}` as entities too: VitePress's markdown-it-attrs reads a trailing `{…}` as attributes.
const attribute = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");

/**
 * The element that shows `json`'s value. Inline, in a `<span>`: VitePress takes a line that
 * starts with any other tag as a block, which would end the sentence.
 */
export function outOf(json: unknown, display: boolean): string {
  const out = `<notatio-out format="mathjson" evaluate ${display ? "display" : "inline"} value="${attribute(JSON.stringify(json))}"></notatio-out>`;
  return display ? out : `<span>${out}</span>`;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * A page's source with each element of markup replaced by the element showing its value:
 * displayed when it has its lines to itself, inline otherwise. Fenced code and code spans are
 * left alone. On source, not tokens: VitePress takes a line starting with a PascalCase tag as a
 * component before any inline rule sees it.
 */
export function replaceMarkup(src: string, page?: string): string {
  let out = "";
  let i = 0;
  let fence: string | undefined;
  while (i < src.length) {
    const lineEnd = src.indexOf("\n", i) < 0 ? src.length : src.indexOf("\n", i) + 1;
    const line = src.slice(i, lineEnd);
    const marker = FENCE.exec(line)?.[1];
    if (fence !== undefined || marker !== undefined) {
      if (fence === undefined) fence = marker;
      else if (marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      out += line;
      i = lineEnd;
      continue;
    }
    // Through the line, a code span at a time; markup may run on past it.
    let j = i;
    while (j < lineEnd) {
      const c = src[j]!;
      if (c === "`") {
        const run = /^`+/.exec(src.slice(j))![0];
        const close = src.indexOf(run, j + run.length);
        const end = close < 0 || close > lineEnd ? j + run.length : close + run.length;
        out += src.slice(j, end);
        j = end;
        continue;
      }
      if (c === "<" && markupTagAt(src, j + 1) !== undefined) {
        const end = markupEnd(src, j);
        if (end > 0) {
          const after = src.indexOf("\n", end) < 0 ? src.length : src.indexOf("\n", end);
          const display = src.slice(i, j).trim() === "" && src.slice(end, after).trim() === "";
          const json = readPageMarkup(src.slice(j, end), page);
          // A displayed element keeps the lines it took, so what follows keeps its line numbers.
          const lines = src.slice(j, end).split("\n").length - 1;
          out += display ? outOf(json, true) + "\n".repeat(lines) : outOf(json, false);
          j = end;
          if (j > lineEnd) break;
          continue;
        }
      }
      out += c;
      j++;
    }
    i = Math.max(j, lineEnd);
  }
  return out;
}

// markdown-it's types aren't resolvable from here (see notatio-math.ts); these are the members used.
interface CoreState {
  src: string;
  env?: { relativePath?: string };
}
interface MarkdownItLike {
  core: { ruler: { after(name: string, rule: string, fn: (state: CoreState) => void): void } };
}

/** Install the markup rewrite on a markdown-it instance. */
export function notatioMarkup(md: MarkdownItLike): void {
  md.core.ruler.after("normalize", "notatio_markup", (state) => {
    state.src = replaceMarkup(state.src, state.env?.relativePath);
  });
}
