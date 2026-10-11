// Quoted example source that opens live: a code span (or an `epsil`/`notatio` fence) that is
// an Epsil expression calling a documented head links to that head's page as
// `?epsil=<source>`, where ReferencePage puts it in a live cell. Prose code that isn't an
// expression (a shell command, a path, a placeholder signature) is left as code.
//
// A page opts out with `autolinkSymbols: false`, as for notatio-symbols.ts.

import { parseExpression } from "@enumeratio/formats/expression";
import { documented } from "./data/reference-node.ts";

const CALL = /\b([A-Z][A-Za-z0-9]*)\(/g;
// A path or an option flag is not an expression, however it happens to parse.
const NOT_SOURCE = /^[~./$-]|\w\/[\w.-]+\/|\w\/[\w-]+\.[a-z]+\b|\)\.[a-z]+$|\s-{1,2}\w/;

const DOCUMENTED: ReadonlySet<string> = new Set(documented.map((entry) => entry.name));

/** The reference page that opens `source` live, or `undefined` if it isn't an expression of a documented head. */
export function sourceLinkHref(source: string, heads: ReadonlySet<string> = DOCUMENTED): string | undefined {
  const text = source.trim();
  if (text === "" || NOT_SOURCE.test(text)) return undefined;
  const head = [...text.matchAll(CALL)].map((m) => m[1]!).find((name) => heads.has(name));
  if (head === undefined) return undefined;
  if (parseExpression(text).errors.length > 0) return undefined;
  return `/reference/symbol/${head}?epsil=${encodeURIComponent(text)}#live`;
}

interface Token {
  type: string;
  content: string;
  info?: string;
  meta?: unknown;
}
interface CoreState {
  tokens: Token[];
  env?: { frontmatter?: Record<string, unknown> };
}
interface MarkdownItLike {
  core: { ruler: { push(name: string, fn: (state: CoreState) => void): void } };
  renderer: { rules: Record<string, unknown> };
}

// Vue compiles the page as a template: braces would be interpolation.
const html = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");

const LIVE_LANGUAGES: ReadonlySet<string> = new Set(["epsil", "notatio"]);

/** Mark the code spans that are expressions, and tag the fences that are. */
function markSources(state: CoreState): void {
  if (state.env?.frontmatter?.["autolinkSymbols"] === false) return;
  for (const token of state.tokens) {
    if (token.type === "fence" && LIVE_LANGUAGES.has((token.info ?? "").trim().split(/\s+/)[0] ?? "")) {
      const href = sourceLinkHref(token.content);
      if (href !== undefined) token.meta = { sourceHref: href };
    }
    const children = (token as unknown as { children?: Token[] }).children;
    if (!children) continue;
    // A nested <a> splits in the HTML parser and fails hydration (see notatio-symbols.ts).
    let inLink = 0;
    for (const child of children) {
      if (child.type === "link_open") inLink++;
      else if (child.type === "link_close") inLink--;
      if (inLink > 0 || child.type !== "code_inline") continue;
      const href = sourceLinkHref(child.content);
      if (href === undefined) continue;
      child.type = "notatio_source";
      child.meta = { sourceHref: href };
    }
  }
}

/** Install the source-link rule on a markdown-it instance. */
export function notatioSourceLinks(md: MarkdownItLike): void {
  md.core.ruler.push("notatio_source_links", markSources);
  const rules = md.renderer.rules as Record<string, (tokens: Token[], i: number, ...rest: unknown[]) => string>;
  rules["notatio_source"] = (tokens, index) => {
    const token = tokens[index]!;
    const href = (token.meta as { sourceHref: string }).sourceHref;
    return `<a class="source-link" href="${html(href)}" title="Open in a live cell"><code>${html(token.content)}</code></a>`;
  };
  const fence = rules["fence"];
  rules["fence"] = (tokens, index, ...rest) => {
    const rendered = fence?.(tokens, index, ...rest) ?? "";
    const href = (tokens[index]!.meta as { sourceHref?: string } | null)?.sourceHref;
    return href === undefined
      ? rendered
      : `${rendered}<p class="source-link-try"><a href="${html(href)}">try it</a></p>\n`;
  };
}
