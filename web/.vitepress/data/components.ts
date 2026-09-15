// The component reference, read straight out of `@enumeratio/components` at build
// time. Nothing is generated into the repo: the attribute tables are derived from each
// element's own `static properties`, `declare` types and constructor defaults, so they
// cannot drift from the source.
//
// What a component author controls:
//   * the JSDoc block on the exported class becomes the component's summary;
//   * a `/** … */` immediately above an entry in `static properties` becomes that
//     attribute's description.
// Everything else (attribute name, type, default, whether it reflects) is read from the
// code itself. Entries whose name starts with `_` are internal reactive state and are
// skipped.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface AttributeDoc {
  /** The DOM attribute, e.g. `x-domain`. */
  attribute: string;
  /** The property on the element instance, e.g. `xDomain`. */
  property: string;
  /** The declared TypeScript type, when the element declares one. */
  type: string;
  /** The constructor default, as written. */
  default: string;
  /** Whether the property reflects back to the attribute. */
  reflects: boolean;
  /** Set from script only (`attribute: false`): no attribute, so no wrapper prop either. */
  propertyOnly: boolean;
  /** Prose from a `/** … *\/` above the entry in `static properties`. */
  description: string;
}

export interface ComponentDoc {
  /** The custom-element tag, e.g. `notatio-plot-3d`. */
  tag: string;
  /** The exported class name, e.g. `NotatioPlot3D`. */
  className: string;
  /** The source file, relative to the repo root. */
  source: string;
  /** The class JSDoc, as markdown. */
  summary: string;
  /** The playground page that exercises this component, when there is one. */
  playground?: string;
  attributes: AttributeDoc[];
}

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../../../packages/components/src");
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

/** Strip the leading `*`s and the delimiters from a JSDoc block. */
const cleanDoc = (block: string): string =>
  block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n")
    .trim();

/** The `{ … }` body that starts at `open`, honouring nesting. */
function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(open + 1, i);
  }
  return "";
}

/** camelCase → kebab-case, the attribute name Lit infers when none is given. */
const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function parse(file: string, playgrounds: Map<string, string>): ComponentDoc | undefined {
  const text = readFileSync(join(srcDir, file), "utf8");

  const define = text.match(/customElements\.define\(\s*"([^"]+)"/);
  const cls = text.match(/(\/\*\*[\s\S]*?\*\/)?\s*export class (\w+) extends LitElement/);
  if (!define || !cls) return undefined;

  const open = text.indexOf("{", text.indexOf("static properties"));
  const body = open === -1 ? "" : balanced(text, open);

  const attributes: AttributeDoc[] = [];
  // Each entry is `name: { … },`, optionally preceded by its own JSDoc block.
  const entry = /(\/\*\*[\s\S]*?\*\/)?\s*(\w+)\s*:\s*\{([^}]*)\}/g;
  for (const m of body.matchAll(entry)) {
    const [, doc, property, options] = m;
    if (property.startsWith("_")) continue; // reactive state, not public surface
    const named = options.match(/attribute\s*:\s*"([^"]+)"/);
    const declared = text.match(new RegExp(`declare ${property}\\s*:\\s*([^;]+);`));
    const assigned = text.match(new RegExp(`this\\.${property}\\s*=\\s*([^;]+);`));
    attributes.push({
      attribute: named ? named[1] : kebab(property),
      property,
      type: declared ? declared[1].trim().replace(/\s+/g, " ") : "",
      default: assigned ? assigned[1].trim() : "",
      reflects: /reflect\s*:\s*true/.test(options),
      propertyOnly: /attribute\s*:\s*false/.test(options),
      description: doc ? cleanDoc(doc) : "",
    });
  }

  return {
    tag: define[1],
    className: cls[2],
    source: `packages/components/src/${file}`,
    summary: cls[1] ? cleanDoc(cls[1]) : "",
    playground: playgrounds.get(define[1]),
    attributes,
  };
}

/** Re-read every element module. Called per build (and per change, in dev). */
export function collectComponents(): ComponentDoc[] {
  const playgrounds = playgroundPages();
  return readdirSync(srcDir)
    .filter((f) => f.startsWith("notatio-") && f.endsWith(".ts"))
    .map((f) => parse(f, playgrounds))
    .filter((c): c is ComponentDoc => c !== undefined)
    .sort((a, b) => a.tag.localeCompare(b.tag));
}
