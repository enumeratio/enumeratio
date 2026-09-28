import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { parseExpression, serializeExpression } from "@enumeratio/formats/expression";

// Wildcard binding: the substitution machinery shared by `<notatio-manipulate>` and
// `<notatio-dynamic-module>`. Both work the same way -- a descendant attribute (or custom-element
// string property) that is an Epsil expression carrying a NAMED WILDCARD (`_a`) is a
// template, and every control move refills it and writes the evaluated result back.
//
// Capturing the parsed template up front is what makes the rewrite non-destructive: the
// attribute in the DOM is overwritten with the *result*, so the source it came from has
// to live somewhere other than the attribute it is written to.

type Json = ReturnType<typeof parseExpression>["json"];

/** One captured template: where the result goes, and the expression it comes from. */
export type Template = { el: Element; json: Json } & ({ attr: string } | { prop: string });

/**
 * Every attribute/property under `root` that is an Epsil expression over `names`.
 *
 * VitePress/Vue set custom-element string bindings as PROPERTIES rather than attributes,
 * so a wildcard may live on either; both are captured. Nodes under `skip` (a control
 * panel of our own making), or for which the `skip` predicate holds, are left alone.
 */
export function captureTemplates(
  root: Element,
  names: ReadonlySet<string>,
  engine: ComputeEngine,
  skip?: Element | ((el: Element) => boolean),
): Template[] {
  const skipped =
    skip === undefined
      ? () => false
      : typeof skip === "function"
        ? skip
        : (el: Element) => el === skip || skip.contains(el);
  const parseLatex = (tex: string) => engine.parse(tex).json;
  const slotted = (src: string): Json | undefined => {
    if (!src.includes("_")) return undefined;
    const { json, wildcards, errors } = parseExpression(src, { parseLatex });
    if (errors.length) return undefined;
    return wildcards.some((w) => names.has(w.slice(1))) ? json : undefined;
  };
  const templates: Template[] = [];
  for (const el of root.querySelectorAll("*")) {
    if (skipped(el)) continue;
    for (const attr of el.getAttributeNames()) {
      const json = slotted(el.getAttribute(attr) ?? "");
      if (json !== undefined) templates.push({ el, attr, json });
    }
    if (el.tagName.includes("-")) {
      const props = (el.constructor as { properties?: Record<string, unknown> }).properties;
      for (const prop of props ? Object.keys(props) : []) {
        const v = (el as unknown as Record<string, unknown>)[prop];
        const json = typeof v === "string" ? slotted(v) : undefined;
        if (json !== undefined) templates.push({ el, prop, json });
      }
    }
  }
  return templates;
}

/**
 * Fill each template's wildcards from `values` (keyed by bare name, without the `_`),
 * evaluate, and write the re-serialized Epsil back. A template that fails to
 * substitute is left as it was rather than blanked.
 */
export function applyTemplates(
  engine: ComputeEngine,
  templates: readonly Template[],
  values: ReadonlyMap<string, BoxedExpression>,
): void {
  const subs: Record<string, BoxedExpression> = {};
  for (const [name, value] of values) subs[`_${name}`] = value;
  for (const t of templates) {
    let next: string;
    try {
      next = serializeExpression(engine.box(t.json).subs(subs).evaluate().json);
    } catch {
      continue;
    }
    if ("attr" in t) {
      if (t.el.getAttribute(t.attr) !== next) t.el.setAttribute(t.attr, next);
    } else {
      const el = t.el as unknown as Record<string, unknown>;
      if (el[t.prop] !== next) el[t.prop] = next;
    }
  }
}
