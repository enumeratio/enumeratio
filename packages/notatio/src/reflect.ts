// The components' attribute tables, read straight out of the element sources. Nothing
// is generated into the repo: a table is derived from each element's own `static
// properties`, `declare` types and constructor defaults, so it cannot drift from the
// source. The reference reads it for its pages, the Vue and React packages for their
// wrappers -- one reading, three uses. Node only (it reads files); a subpath export.
//
// What a component author controls:
//   * the JSDoc block on the exported class becomes the component's summary;
//   * a `/** … */` immediately above an entry in `static properties` becomes that
//     attribute's description.
// Everything else (attribute name, type, default, whether it reflects) is read from the
// code itself. Entries whose name starts with `_` are internal reactive state and are
// skipped.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  attributes: AttributeDoc[];
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

/**
 * The JSDoc block that ends right before `at`, with only whitespace between, or "".
 * Found by walking back from `at` rather than by one regex, which would start at the
 * file's first `/**` and swallow every line of code down to the class.
 */
function docBefore(text: string, at: number): string {
  const head = text.slice(0, at).trimEnd();
  if (!head.endsWith("*/")) return "";
  const open = head.lastIndexOf("/**");
  return open === -1 ? "" : head.slice(open);
}

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

/** The attribute table declared in one class body, and what it extends. */
interface ClassDoc {
  className: string;
  parent: string;
  attributes: AttributeDoc[];
}

/**
 * Every exported class in a source file with its own `static properties`, so a
 * component that extends another (`NotatioAnimator extends NotatioSlider`, or any
 * control over `ChoiceControl`) can inherit the attributes it did not redeclare.
 */
function classesIn(text: string): ClassDoc[] {
  const out: ClassDoc[] = [];
  const decl = /export (?:abstract )?class (\w+) extends (\w+)/g;
  for (const m of text.matchAll(decl)) {
    const from = m.index ?? 0;
    const at = text.indexOf("static", from);
    const next = text.indexOf("export class", from + 1);
    const own =
      at !== -1 && (next === -1 || at < next) && /static (?:override )?properties/.test(text.slice(at, at + 40));
    const open = own ? text.indexOf("{", text.indexOf("properties", at)) : -1;
    const body = open === -1 ? "" : balanced(text, open);
    out.push({ className: m[1], parent: m[2], attributes: attributesIn(text, body) });
  }
  return out;
}

function attributesIn(text: string, body: string): AttributeDoc[] {
  const attributes: AttributeDoc[] = [];
  // Each entry is `name: { … },`, optionally preceded by its own JSDoc block.
  const entry = /(\w+)\s*:\s*\{([^}]*)\}/g;
  for (const m of body.matchAll(entry)) {
    const [, property, options] = m;
    const doc = docBefore(body, m.index ?? 0);
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
  return attributes;
}

/** Every class with an attribute table, across the whole source tree, by name. */
function classTable(srcDir: string): Map<string, ClassDoc> {
  const table = new Map<string, ClassDoc>();
  for (const f of readdirSync(srcDir).filter((f) => f.endsWith(".ts"))) {
    for (const c of classesIn(readFileSync(join(srcDir, f), "utf8"))) table.set(c.className, c);
  }
  return table;
}

/** A class's attributes with its ancestors' first, each attribute once. */
function inherited(className: string, table: Map<string, ClassDoc>): AttributeDoc[] {
  const chain: AttributeDoc[][] = [];
  const seen = new Set<string>();
  for (let c = table.get(className); c && !seen.has(c.className); c = table.get(c.parent)) {
    seen.add(c.className);
    chain.unshift(c.attributes);
  }
  const out = new Map<string, AttributeDoc>();
  for (const attrs of chain) for (const a of attrs) out.set(a.property, a);
  return [...out.values()];
}

function parse(srcDir: string, file: string, table: Map<string, ClassDoc>): ComponentDoc | undefined {
  const text = readFileSync(join(srcDir, file), "utf8");

  // A tag is defined directly or through `defineControl`, which also registers it.
  const define = text.match(/(?:customElements\.define|defineControl)\(\s*"([^"]+)"/);
  const cls = text.match(/export class (\w+) extends \w+/);
  if (!define || !cls) return undefined;
  const doc = docBefore(text, cls.index ?? 0);

  return {
    tag: define[1],
    className: cls[1],
    source: `packages/notatio-lit/src/${file}`,
    summary: doc ? cleanDoc(doc) : "",
    attributes: inherited(cls[1], table),
  };
}

/**
 * Read every element module under `srcDir` (the lit package's `src`). Called per build,
 * and per change in dev.
 */
export function collectComponents(srcDir: string): ComponentDoc[] {
  const table = classTable(srcDir);
  return readdirSync(srcDir)
    .filter((f) => f.startsWith("notatio-") && f.endsWith(".ts"))
    .map((f) => parse(srcDir, f, table))
    .filter((c): c is ComponentDoc => c !== undefined)
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/** `notatio-plot-3d` -> `Plot3D`, `notatio-collection-table` -> `CollectionTable`: a wrapper's name. */
export function wrapperName(tag: string): string {
  return tag
    .replace(/^notatio-/, "")
    .split("-")
    .map((part) => (/^\d/.test(part) ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join("");
}

/** The TypeScript type a wrapper prop takes, from the element's declared property type. */
export function propType(a: AttributeDoc): "boolean" | "number" | "string" {
  if (/\bboolean\b/.test(a.type)) return "boolean";
  if (/\bnumber\b/.test(a.type)) return "number";
  return "string";
}
