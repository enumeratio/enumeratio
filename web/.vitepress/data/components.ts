// The component reference: the attribute tables `@enumeratio/notatio/reflect` reads out
// of the element sources, plus which playground page exercises each component.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ComponentDoc as Reflected,
  collectComponents as reflect,
} from "@enumeratio/notatio/reflect";

export type { AttributeDoc } from "@enumeratio/notatio/reflect";

export interface ComponentDoc extends Reflected {
  /** The playground page that exercises this component, when there is one. */
  playground?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
export const srcDir = resolve(here, "../../../packages/notatio-lit/src");
const playgroundDir = resolve(here, "../../playground");

/** Every markdown page under the playground, as a path relative to it. */
function playgroundFiles(dir = playgroundDir, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      found.push(...playgroundFiles(join(dir, entry.name), `${prefix}${entry.name}/`));
    else if (entry.name.endsWith(".md")) found.push(prefix + entry.name);
  }
  return found;
}

/** Map each tag to the playground page that uses it, so the pages can link out. */
function playgroundPages(): Map<string, string> {
  const pages = new Map<string, string>();
  // A page named for the component wins; an index page, which mentions many of them,
  // is the last resort.
  const files = playgroundFiles().sort(
    (a, b) => Number(a.endsWith("index.md")) - Number(b.endsWith("index.md")),
  );
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
  return reflect(srcDir).map((c) => ({ ...c, playground: playgrounds.get(c.tag) }));
}
