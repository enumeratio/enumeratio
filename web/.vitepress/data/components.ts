// The component reference: the attribute tables `@enumeratio/frontend/reflect` reads out
// of the element sources, plus which playground page exercises each component.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ComponentDoc as Reflected, collectComponents as reflect, headOfTag } from "@enumeratio/frontend/reflect";
import { DRAWING_SYMBOLS } from "@enumeratio/frontend/symbols";

export type { AttributeDoc } from "@enumeratio/frontend/reflect";

export interface ComponentDoc extends Reflected {
  /** The head (`BarChart3D`) -- the page's own name, and its route. Read
   * here (Node, filesystem-free) rather than reimplemented client-side, since `headOfTag`
   * itself is pure; the browser build just can't pull in this module for one function
   * (`collectComponents` reads the filesystem at import time). */
  name: string;
  /** The heads drawn by this element (symbols.ts's head-to-tag map), read here so a page
   *  needn't load the symbol table to link a head to its component. */
  heads: readonly string[];
  /** The playground page that exercises this component, when there is one. */
  playground?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
export const srcDir = resolve(here, "../../../packages/components/src");
const playgroundDir = resolve(here, "../../playground");

/** Every markdown page under the playground, as a path relative to it. */
function playgroundFiles(dir = playgroundDir, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...playgroundFiles(join(dir, entry.name), `${prefix}${entry.name}/`));
    else if (entry.name.endsWith(".md")) found.push(prefix + entry.name);
  }
  return found;
}

/** Map each tag to the playground page that uses it, so the pages can link out. */
function playgroundPages(): Map<string, string> {
  const pages = new Map<string, string>();
  // A page named for the component wins; an index page, which mentions many of them,
  // is the last resort.
  const files = playgroundFiles().toSorted((a, b) => Number(a.endsWith("index.md")) - Number(b.endsWith("index.md")));
  for (const file of files) {
    const text = readFileSync(join(playgroundDir, file), "utf8");
    const slug = file.replace(/(?:\/?index)?\.md$/, "");
    const leaf = slug.slice(slug.lastIndexOf("/") + 1);
    for (const m of text.matchAll(/<(notatio-[a-z0-9-]+)[\s/>]/g)) {
      const named = m[1] === `notatio-${leaf}`;
      if (named || !pages.has(m[1])) pages.set(m[1], `/playground/${slug}`);
    }
  }
  return pages;
}

/** Re-read every element module. Called per build (and per change, in dev). */
export function collectComponents(): ComponentDoc[] {
  const playgrounds = playgroundPages();
  return reflect(srcDir).map((c) => ({
    ...c,
    name: headOfTag(c.tag),
    heads: DRAWING_SYMBOLS.filter((s) => s.tag === c.tag).map((s) => s.head),
    playground: playgrounds.get(c.tag),
  }));
}
