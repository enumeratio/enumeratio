import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { parseExpression, serializeExpression } from "@enumeratio/formats/expression";

// Wildcard binding: the substitution machinery shared by `<notatio-manipulate>` and
// `<dynamic-module-box>`. Both work the same way -- a descendant attribute (or custom-element
// string property) that is an Epsil expression carrying a NAMED WILDCARD (`_a`) is a
// template, and every control move refills it and writes the evaluated result back.
//
// Capturing the parsed template up front is what makes the rewrite non-destructive: the
// attribute in the DOM is overwritten with the *result*, so the source it came from has
// to live somewhere other than the attribute it is written to.

type Json = ReturnType<typeof parseExpression>["json"];

/** One captured template: where the result goes, and the expression it comes from. */
/** `list`: the slot holds an argument list (a generic element's `value`), not one expression. */
export type Template = { el: Element; json: Json; list?: true } & ({ attr: string } | { prop: string });

/**
 * A `value` template on an element that reads its wildcards' values itself (a plot sampling
 * code its kernel compiled, a `Show` whose rules the engine must not canonicalize): it gets
 * `bindings` and keeps its `value` as written.
 */
export const takesBindings = (t: Template): boolean =>
  ("attr" in t ? t.attr : t.prop) === "value" &&
  ((
    customElements.get(t.el.localName) as { elementProperties?: Map<PropertyKey, unknown> } | undefined
  )?.elementProperties?.has("bindings") ??
    false);

/** How long a scope waits for its templates' elements to be defined (they load on use). */
const DEFINE_WAIT_MS = 2000;

/** Wait (a while) for the classes of `templates`' elements: whether one takes bindings is its class's to say. */
export async function whenTemplatesDefined(templates: readonly Template[]): Promise<void> {
  const pending = [...new Set(templates.map((t) => t.el.localName))].filter(
    (tag) => tag.includes("-") && customElements.get(tag) === undefined,
  );
  if (pending.length === 0) return;
  await Promise.race([
    Promise.all(pending.map((tag) => customElements.whenDefined(tag))),
    new Promise((resolve) => setTimeout(resolve, DEFINE_WAIT_MS)),
  ]);
}

/** A generic element's `value` is its arguments, `n, 2`: a template there is read as `[n, 2]`. */
const holdsArguments = (el: Element, slot: string): boolean =>
  slot === "value" && el.hasAttribute("data-notatio-generic");

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
  includeRoot = false,
): Template[] {
  const skipped =
    skip === undefined
      ? () => false
      : typeof skip === "function"
        ? skip
        : (el: Element) => el === skip || skip.contains(el);
  const parseLatex = (tex: string) => engine.parse(tex).json;
  const slotted = (src: string, list = false): Json | undefined => {
    if (!src.includes("_")) return undefined;
    const { json, wildcards, errors } = parseExpression(list ? `[${src}]` : src, { parseLatex });
    if (errors.length) return undefined;
    return wildcards.some((w) => names.has(w.slice(1))) ? json : undefined;
  };
  const templates: Template[] = [];
  for (const el of includeRoot ? [root, ...root.querySelectorAll("*")] : root.querySelectorAll("*")) {
    if (skipped(el)) continue;
    for (const attr of el.getAttributeNames()) {
      // A scope's declarations name its wildcards; they are not a template over them.
      if (attr === "variables") continue;
      const list = holdsArguments(el, attr);
      const json = slotted(el.getAttribute(attr) ?? "", list);
      if (json !== undefined) templates.push({ el, attr, json, ...(list ? { list: true as const } : {}) });
    }
    if (el.tagName.includes("-")) {
      const props = (el.constructor as { properties?: Record<string, unknown> }).properties;
      for (const prop of props ? Object.keys(props).filter((p) => p !== "variables") : []) {
        const v = (el as unknown as Record<string, unknown>)[prop];
        const list = holdsArguments(el, prop);
        const json = typeof v === "string" ? slotted(v, list) : undefined;
        if (json !== undefined) templates.push({ el, prop, json, ...(list ? { list: true as const } : {}) });
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
      const filled = engine.box(t.json).subs(subs).evaluate().json;
      next = t.list ? serializeExpression(filled).replace(/^\[|\]$/g, "") : serializeExpression(filled);
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
