// The component reference: the attribute tables `@enumeratio/frontend/reflect` reads out
// of the element sources, plus which doc page demos each component.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { type ComponentDoc as Reflected, collectComponents as reflect, headOfTag } from "@enumeratio/frontend/reflect";
import { DRAWING_SYMBOLS } from "@enumeratio/frontend/symbols";
import { docRoute, repoRoot, workspacePackages } from "./repo-docs.ts";

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
  /** The doc page that demos this component, when there is one. */
  playground?: string;
}

// The element sources the package ships: the reference is read out of them.
export const srcDir = join(
  dirname(createRequire(import.meta.url).resolve("@enumeratio/components/package.json")),
  "src",
);
// The pages that demo components live in the package docs of the library each one belongs
// to: the interface in components, a polytope in polytope, combinatorial figures in
// combinatorics. Other pages (guides) mention elements without being their demo.
const DEMO_PAGES = (slug: string, page: string): boolean =>
  slug === "components" || slug === "polytope" || (slug === "combinatorics" && page === "figure");

/** Map each tag to the doc page that demos it, so the pages can link out. */
function demoPages(): Map<string, string> {
  const pages = new Map<string, string>();
  // A page named for the component wins; an overview page, which mentions many of them,
  // is the last resort.
  const found = workspacePackages().flatMap((pkg) =>
    pkg.pages.filter((d) => DEMO_PAGES(pkg.slug, d.page)).map((d) => ({ pkg, d })),
  );
  found.sort((a, b) => Number(a.d.page === "overview") - Number(b.d.page === "overview"));
  for (const { pkg, d } of found) {
    const text = readFileSync(join(repoRoot, d.file), "utf8");
    const leaf = d.page.slice(d.page.lastIndexOf("/") + 1);
    for (const m of text.matchAll(/<(notatio-[a-z0-9-]+)[\s/>]/g)) {
      const named = m[1] === `notatio-${leaf}`;
      if (named || !pages.has(m[1])) pages.set(m[1], docRoute(pkg.slug, d.page));
    }
  }
  return pages;
}

/** Re-read every element module. Called per build (and per change, in dev). */
export function collectComponents(): ComponentDoc[] {
  const playgrounds = demoPages();
  return reflect(srcDir).map((c) => ({
    ...c,
    name: headOfTag(c.tag),
    heads: DRAWING_SYMBOLS.filter((s) => s.tag === c.tag).map((s) => s.head),
    playground: playgrounds.get(c.tag),
  }));
}
