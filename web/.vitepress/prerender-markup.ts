// The build as a kernel, for a page's own markup (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends §9):
// each `<notatio-cell>` and plot (`<graphics-box value="Plot(…)">`) a page writes gets a placeholder,
// `<NotatioPrerendered>`, and what it asks for (its attributes, and the starting values of a
// Manipulate around it) is recorded for the page. `data/prerender-markup.ts` answers it and
// writes the result into the page's HTML; the placeholder reads it back before hydrating, and
// the element takes over.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DIAGRAM_HEADS, PLOT_HEADS } from "@enumeratio/frontend/core";

/** One element a page asks the build to render. */
export interface MarkupSpec {
  readonly at: number;
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** The `params` of each Manipulate around it, outermost first. */
  readonly manipulate: readonly string[];
  /** Inside a notebook or dynamic module, whose session the build doesn't keep. */
  readonly inSession: boolean;
}

const PRERENDERED = new Set(["notatio-cell", "graphics-box"]);

/** Whether a `graphics-box` holds a sampled plot, which the build draws; a `Show` or a diagram is drawn live. */
const holdsPlot = (value: string | undefined): boolean =>
  value !== undefined &&
  new RegExp(`^\\s*(?:${PLOT_HEADS.filter((head) => !DIAGRAM_HEADS.includes(head)).join("|")})\\s*\\(`).test(value);
const SPECS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "cache/prerender-pages");

/** Where a page's specs are kept, by its source path. */
export const specsFile = (relativePath: string): string =>
  resolve(SPECS_DIR, `${encodeURIComponent(relativePath)}.json`);

const TAG =
  /<(\/?)(notatio-[a-z0-9-]+|dynamic-module-box|graphics-box)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

const attributesOf = (source: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [, name, double, single, bare] of source.matchAll(ATTRIBUTE)) out[name!] = double ?? single ?? bare ?? "";
  return out;
};

interface Token {
  type: string;
  content: string;
  children?: Token[] | null;
}

interface PageEnv {
  relativePath?: string;
  frontmatter?: Record<string, unknown>;
}

interface MarkdownItLike {
  core: { ruler: { push(name: string, fn: (state: { tokens: Token[]; env?: PageEnv }) => void): void } };
}

/** Marks a page's cells and plots for the build, unless its frontmatter says `prerender: false`. */
export function prerenderMarkup(md: MarkdownItLike): void {
  md.core.ruler.push("notatio_prerender", (state) => {
    const page = state.env?.relativePath;
    if (page === undefined || state.env?.frontmatter?.["prerender"] === false) return;
    const specs: MarkupSpec[] = [];
    const manipulate: string[] = [];
    let sessions = 0;
    // Inside a `v-pre` element Vue compiles nothing, so the placeholder is its plain markup.
    const verbatim: boolean[] = [];
    const rewrite = (html: string): string =>
      html.replace(TAG, (whole, close: string, tag: string, attrs: string, self: string) => {
        if (close) verbatim.pop();
        else if (!self) verbatim.push(verbatim.at(-1) === true || "v-pre" in attributesOf(attrs));
        if (tag === "notatio-manipulate") {
          if (close) manipulate.pop();
          else if (!self) manipulate.push(attributesOf(attrs)["params"] ?? "");
          return whole;
        }
        if (tag === "notatio-notebook" || tag === "dynamic-module-box") {
          if (close) sessions--;
          else if (!self) sessions++;
          return whole;
        }
        if (close || !PRERENDERED.has(tag)) return whole;
        const attributes = attributesOf(attrs);
        if (attributes["prerender"] === "false") return whole;
        if (tag === "graphics-box" && !holdsPlot(attributes["value"])) return whole;
        const at = specs.length;
        specs.push({ at, tag, attributes, manipulate: [...manipulate], inSession: sessions > 0 });
        const inside = verbatim.at(-1) === true;
        const placeholder = inside
          ? `<span class="notatio-prerendered" data-prerender="${at}"></span>`
          : `<NotatioPrerendered :at="${at}" />`;
        // The element renders its own light DOM beside the placeholder (a cell's rows), and it can
        // upgrade before Vue hydrates; without this Vue logs "more child nodes than client vdom".
        const opened = `<${tag}${attrs} data-allow-mismatch="children">${placeholder}`;
        return self ? `${opened}</${tag}>` : opened;
      });
    for (const token of state.tokens) {
      if (token.type === "html_block") token.content = rewrite(token.content);
      for (const child of token.children ?? [])
        if (child.type === "html_inline") child.content = rewrite(child.content);
    }
    mkdirSync(SPECS_DIR, { recursive: true });
    writeFileSync(specsFile(page), JSON.stringify(specs));
  });
}

// The modules each tag loads on the page, by chunk name: the element's own, and what it reads
// its answers or code with.
const CHUNKS: Readonly<Record<string, readonly string[]>> = {
  "notatio-cell": ["lazy", "notatio-cell", "notatio-in", "notatio-out", "notatio-code", "kernel-client", "katex"],
  "graphics-box": ["lazy", "graphics-box", "plot-view", "plot-kernel", "kernel-client"],
};

/** The prerendered tags `relativePath` uses: a reference page's examples are cells. */
export function pageTags(relativePath: string): Set<string> {
  const tags = new Set<string>();
  if (relativePath.startsWith("reference/symbol/")) tags.add("notatio-cell");
  try {
    for (const spec of JSON.parse(readFileSync(specsFile(relativePath), "utf8")) as MarkupSpec[]) tags.add(spec.tag);
  } catch {
    // a page with none
  }
  return tags;
}

/** Whether `asset` is a chunk one of `tags` loads. */
export function preloads(asset: string, tags: ReadonlySet<string>): boolean {
  const name = /\/chunks\/([\w-]+)\.[\w-]+\.js$/.exec(asset)?.[1];
  return name !== undefined && [...tags].some((tag) => CHUNKS[tag]?.includes(name) === true);
}

let chunks: string[] | undefined;

/** The built client's chunks, as the URLs a page loads them by. */
export function chunksIn(outDir: string): string[] {
  const dir = resolve(outDir, "assets/chunks");
  chunks ??= existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".js"))
        .map((f) => `/assets/chunks/${f}`)
    : [];
  return chunks;
}
