// Auto-link inline code spans that name a documented head: `Inversions` in prose becomes
// <Symbol name="Inversions" />, which links to its reference page and hovers its summary.
//
// Only `code_inline` tokens are considered, so a fenced block, an attribute value and a
// `$…$` island are all untouched -- and the cost is one Set lookup per inline code span.
// Names in NEVER_AUTOLINK are skipped: the word is ordinary English more often than it is
// the head. Writing `<Symbol>Sign</Symbol>` by hand still works everywhere.
//
// A page opts out entirely with `autolinkSymbols: false` in its frontmatter.

import { documented } from "./data/reference-node.ts";
import { NEVER_AUTOLINK } from "./data/symbol-links.ts";

// Only DOCUMENTED heads auto-link. The engine stubs would make `Sort`, `First` and `Length`
// links in every sentence that uses the word; a stub is still reachable by `<Symbol>`.
const LINKABLE: ReadonlySet<string> = new Set(
  documented.map((entry) => entry.name).filter((name) => !NEVER_AUTOLINK.has(name)),
);

interface Token {
  type: string;
  content: string;
}

interface MarkdownItLike {
  core: { ruler: { push(name: string, fn: (state: CoreState) => void): void } };
  renderer: { rules: Record<string, unknown> };
}

interface CoreState {
  tokens: Token[];
  env?: { frontmatter?: Record<string, unknown> };
}

/** Walk every inline token's children, marking the code spans that name a head. */
function markSymbols(state: CoreState): void {
  if (state.env?.frontmatter?.["autolinkSymbols"] === false) return;
  for (const token of state.tokens) {
    const children = (token as unknown as { children?: Token[] }).children;
    if (!children) continue;
    for (const child of children) {
      if (child.type !== "code_inline") continue;
      if (!LINKABLE.has(child.content.trim())) continue;
      child.type = "notatio_symbol";
    }
  }
}

/** Install the auto-linking rule on a markdown-it instance. */
export function notatioSymbols(md: MarkdownItLike): void {
  md.core.ruler.push("notatio_symbols", markSymbols);
  const rules = md.renderer.rules as Record<string, (tokens: Token[], i: number) => string>;
  rules["notatio_symbol"] = (tokens, index) => `<Symbol name="${tokens[index]!.content.trim()}" />`;
}
