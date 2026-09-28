// The symbols as framework components, generated: one component per element, its props
// the element's attributes (read out of the element source by `reflect.ts`), rendering
// the element with only the props the page set -- an absent prop must not overwrite the
// element's own default, and a boolean is bound only when true, since an attribute that
// is present is an attribute that is on. A page then writes `<Plot value="Sin(x)" />` or
// `<Histogram data="[1,2,2,3]" />` and gets a compile-time check on the spelling: the
// same names the engine knows, in the template language or in JSX
// (design/components-and-symbols.md §2, design/vdom.md).
//
// Two kinds of component come out of one reading of the sources:
//   - one per element, named for its tag (`notatio-plot-3d` -> `Plot3D`);
//   - one per family member in `symbols.ts` (`Histogram` -> `<notatio-chart type="histogram">`),
//     the family's props with the member's attribute fixed.
//
// Vue gets a `defineComponent` each; React a function component (React 19 sets a custom
// element's known properties, so numbers and booleans reach a Lit element as
// properties). Emitted into `src/vue-generated.ts` and `src/react-generated.ts`
// (gitignored) by the build, or by whoever loads this module first -- the docs site's
// config does, so the files exist for the theme.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { optionsOf } from "@enumeratio/formats";
import { serializeExpression } from "@enumeratio/formats/expression";
import { type AttributeDoc, collectComponents, type ComponentDoc, propType, wrapperName } from "./reflect.ts";
import {
  controlNames,
  headOf,
  lowerOptions,
  opsOf,
  strOf,
  visualSymbol,
  VISUAL_SYMBOLS,
  type VisualSymbol,
} from "./symbols.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** Where the element sources are: the sibling package, in a workspace checkout. */
export const defaultSrcDir = resolve(here, "../../components/src");

export type Framework = "vue" | "react";

/** Where a framework's components are written. */
export const generatedPath = (framework: Framework): string => resolve(here, `./${framework}-generated.ts`);

/** Escape for a JSDoc line inside the generated file. */
const doc = (text: string): string => text.replace(/\*\//g, "*\\/").replace(/\n+/g, " ");

const vueType = (a: AttributeDoc): string => ({ boolean: "Boolean", number: "Number", string: "String" })[propType(a)];

const vueComponent = (
  name: string,
  component: ComponentDoc,
  props: readonly AttributeDoc[],
  fixed: Readonly<Record<string, string>>,
): string => {
  const lines = props.map((a) => {
    const comment = a.description ? `    /** ${doc(a.description)} */\n` : "";
    return `${comment}    ${a.property}: { type: ${vueType(a)}, required: false },`;
  });
  return `/** \`<${name}>\` is \`<${component.tag}>\`: props are the element's attributes, typed. */
export const ${name} = defineComponent({
  name: ${JSON.stringify(name)},
  props: {
${lines.join("\n")}
  },
  setup(props, { slots }) {
    return () => h(${JSON.stringify(component.tag)}, bound(props, ${JSON.stringify(fixed)}), slots.default?.());
  },
});
`;
};

const reactComponent = (
  name: string,
  component: ComponentDoc,
  props: readonly AttributeDoc[],
  fixed: Readonly<Record<string, string>>,
): string => {
  const lines = props.map((a) => {
    const comment = a.description ? `  /** ${doc(a.description)} */\n` : "";
    return `${comment}  ${a.property}?: ${propType(a)};`;
  });
  return `/** \`<${name}>\` is \`<${component.tag}>\`: props are the element's attributes, typed. */
export interface ${name}Props extends Common {
${lines.join("\n")}
}
export function ${name}(props: ${name}Props): ReactElement {
  const { children, ...rest } = props;
  return createElement(${JSON.stringify(component.tag)}, bound(rest, ${JSON.stringify(fixed)}), children);
}
`;
};

const HEADER: Record<Framework, string> = {
  vue: `import { defineComponent, h } from "vue";
`,
  react: `import { createElement, type ReactElement, type ReactNode } from "react";

/** What every component takes besides its element's attributes. */
interface Common {
  children?: ReactNode;
  className?: string;
  style?: Record<string, string | number>;
}
`,
};

const NAME_PATTERN: Record<Framework, RegExp> = {
  vue: /^export const (\w+) = defineComponent/gm,
  react: /^export function (\w+)\(/gm,
};

function componentSource(
  framework: Framework,
  name: string,
  component: ComponentDoc,
  fixed: Readonly<Record<string, string>> = {},
): string {
  const props = component.attributes.filter((a) => !a.propertyOnly && !(a.attribute in fixed));
  return (framework === "vue" ? vueComponent : reactComponent)(name, component, props, fixed);
}

/** The whole generated module: the components, and a table of them by name. */
export function generatedSource(framework: Framework, srcDir: string = defaultSrcDir): string {
  const components = collectComponents(srcDir);
  const byTag = new Map(components.map((c) => [c.tag, c]));
  const sources = new Map<string, string>();
  for (const component of components) {
    const name = wrapperName(component.tag);
    sources.set(name, componentSource(framework, name, component));
  }
  // A family member is the family's component with the member's attribute fixed; a
  // symbol whose tag is its own name is already covered above.
  for (const symbol of VISUAL_SYMBOLS) {
    if (sources.has(symbol.head) || symbol.fixed === undefined) continue;
    const component = byTag.get(symbol.tag);
    if (component) {
      sources.set(symbol.head, componentSource(framework, symbol.head, component, symbol.fixed));
    }
  }
  const names = [...sources.keys()];
  return `// GENERATED by @enumeratio/frontend/generate from the element sources -- do not edit.
${HEADER[framework]}
/** Only what the page set, and a boolean only when true: the element keeps its own defaults. */
function bound(
  props: Record<string, unknown>,
  fixed: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fixed };
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    out[k] = v;
  }
  return out;
}

${[...sources.values()].join("\n")}
/** Every generated component by name, for a loop that registers them. */
export const components = { ${names.join(", ")} };
`;
}

/** Write a framework's module if it changed. Returns the component names. */
export function generate(
  framework: Framework,
  srcDir: string = defaultSrcDir,
  out: string = generatedPath(framework),
): string[] {
  const source = generatedSource(framework, srcDir);
  if (!existsSync(out) || readFileSync(out, "utf8") !== source) writeFileSync(out, source);
  return [...source.matchAll(NAME_PATTERN[framework])].map((m) => m[1]!);
}

/** Both frameworks' modules. */
export function generateAll(srcDir: string = defaultSrcDir): Record<Framework, string[]> {
  return { vue: generate("vue", srcDir), react: generate("react", srcDir) };
}

// -- Usage markup: an expression as the real component(s) a person would write it with -- //
//
// Below is not the generator above: that emits component DEFINITIONS from the element
// sources; this walks one runtime expression and prints its INSTANCE -- real prop names,
// real types, the same names the definitions declare. It mirrors `render`/`renderingOf` in
// symbols.ts (same VisualSymbol lookup, same options lowering) but keeps each node's head
// name, which `renderingOf`'s Rendering tree throws away once it settles on a DOM tag -- the
// one thing needed to tell a family member (`Histogram`, over the shared `notatio-chart`)
// from the tag's own by-tag component (`Chart`).

/** One prop on a usage node, already resolved to the type its real component declares. */
export interface UsageAttr {
  /** The prop's name as declared (camelCase) -- `rowLabels`, not `row-labels`. */
  readonly prop: string;
  /** The value, as attribute text (unescaped, unquoted). */
  readonly value: string;
  /** A String prop is a plain attribute; anything else needs a binding to keep its type. */
  readonly kind: "boolean" | "number" | "string";
}

/** The real component(s) an expression draws, with real prop names/types -- what a person
 * would actually write in Vue or React, not the generic vdom of `structuralOf`. */
export type ComponentUsage =
  | {
      readonly kind: "component";
      readonly name: string;
      readonly attrs: readonly UsageAttr[];
      readonly children: readonly ComponentUsage[];
    }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "image"; readonly src: string }
  /** Not resolved to a specific component -- printed as `<Notatio expr>`, which always works. */
  | { readonly kind: "expr"; readonly expr: string };

/** kebab DOM attribute -> the camelCase prop name Vue/React components declare. */
const propNameOf = (attr: string): string => attr.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

let componentsCache: { srcDir: string; byTag: Map<string, ComponentDoc> } | undefined;

/** Every element's doc, by tag, cached per `srcDir` -- read once per process. */
function componentsByTag(srcDir: string): Map<string, ComponentDoc> {
  if (componentsCache?.srcDir !== srcDir) {
    componentsCache = { srcDir, byTag: new Map(collectComponents(srcDir).map((c) => [c.tag, c])) };
  }
  return componentsCache.byTag;
}

/** The real generated component name for a drawing symbol: its own head when it fixes an
 * attribute (a family member, over the shared tag), else the tag's own by-tag name -- the
 * same rule `generatedSource` applies when it decides which components to emit. */
function usageComponentName(symbol: VisualSymbol): string {
  return symbol.fixed ? symbol.head : wrapperName(symbol.tag);
}

/** A symbol's attribute -> prop type, from the element's real declared types, minus whatever
 * a family member fixes (that prop isn't on its own named component at all). */
function usagePropTypes(symbol: VisualSymbol, srcDir: string): Map<string, "boolean" | "number" | "string"> {
  const fixed = new Set(Object.keys(symbol.fixed ?? {}));
  const types = new Map<string, "boolean" | "number" | "string">();
  for (const a of componentsByTag(srcDir).get(symbol.tag)?.attributes ?? []) {
    if (!fixed.has(a.attribute)) types.set(a.attribute, propType(a));
  }
  return types;
}

/**
 * The usage tree for an expression -- `undefined` when there's nothing to draw (mirrors
 * `renderingOf`'s own `undefined`) or when the tree needs something this doesn't reconstruct
 * yet: a control (no story exercises one) or an option whose value is itself drawn as a
 * slotted child (`Epilog -> Point(...)`) -- `lowerOptions` already lowers that value straight
 * to a DOM `Rendering`, which has no head left to name a component by. Neither shape occurs
 * in today's stories; a caller falls back to `<Notatio expr>` for the whole story when this
 * returns `undefined`, which is always correct even if less illustrative.
 */
export function usageOf(
  expr: MathJsonExpression,
  srcDir: string = defaultSrcDir,
  inManipulate = false,
): ComponentUsage | undefined {
  if (!inManipulate && controlNames(expr).size > 0) return undefined;
  return usageRender(expr, srcDir, inManipulate);
}

function usageRender(expr: MathJsonExpression, srcDir: string, inScope: boolean): ComponentUsage | undefined {
  const head = headOf(expr);
  if (head === "Image") {
    const uri = strOf(opsOf(expr)[0]);
    return uri === undefined ? undefined : { kind: "image", src: uri };
  }
  const text = strOf(expr);
  if (text !== undefined && inScope) return { kind: "text", text };
  const symbol = head === undefined ? undefined : visualSymbol(head);
  if (symbol === undefined) return inScope ? { kind: "expr", expr: serializeExpression(expr) } : undefined;
  const { ops, options } = optionsOf(expr);
  const lowered = lowerOptions(symbol, options);
  if (lowered.children.length > 0) return undefined; // see the doc comment above
  const raw: Record<string, string> = { ...symbol.fixed, ...symbol.attributes(ops), ...lowered.attributes };
  const fixedKeys = new Set(Object.keys(symbol.fixed ?? {}));
  const types = usagePropTypes(symbol, srcDir);
  const attrs: UsageAttr[] = [];
  for (const [attr, value] of Object.entries(raw)) {
    if (fixedKeys.has(attr)) continue;
    attrs.push({ prop: propNameOf(attr), value, kind: types.get(attr) ?? "string" });
  }
  const children = (symbol.children?.(ops) ?? []).map(
    (c) => usageRender(c, srcDir, true) ?? { kind: "expr" as const, expr: serializeExpression(c) },
  );
  return { kind: "component", name: usageComponentName(symbol), attrs, children };
}

const escapeAttr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const escapeText = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** A tag over its attribute lines and children, one line if it fits, else one attribute a line. */
function printTag(pad: string, name: string, attrs: readonly string[], children: readonly string[]): string {
  const attrText = attrs.map((a) => ` ${a}`).join("");
  if (children.length === 0) {
    const oneLine = `${pad}<${name}${attrText} />`;
    if (attrs.length <= 1 || oneLine.length <= 100) return oneLine;
    return `${pad}<${name}\n${attrs.map((a) => `${pad}  ${a}`).join("\n")}\n${pad}/>`;
  }
  const openOneLine = `${pad}<${name}${attrText}>`;
  const open =
    attrs.length <= 1 || openOneLine.length <= 100
      ? openOneLine
      : `${pad}<${name}\n${attrs.map((a) => `${pad}  ${a}`).join("\n")}\n${pad}>`;
  return `${open}\n${children.join("\n")}\n${pad}</${name}>`;
}

/**
 * A usage tree as Vue template markup: a String prop is a plain attribute, same as a person
 * would type it -- anything else binds with `:prop="…"`, since a bare attribute would hand
 * the element a string instead of the typed value the prop expects (Vue does not coerce a
 * template attribute's type the way it does a bound one).
 */
export function vueMarkupOf(node: ComponentUsage, depth = 0): string {
  const pad = "  ".repeat(depth);
  if (node.kind === "text") return `${pad}${escapeText(node.text)}`;
  if (node.kind === "image") return `${pad}<img src="${escapeAttr(node.src)}" />`;
  if (node.kind === "expr") return `${pad}<Notatio expr="${escapeAttr(node.expr)}" />`;
  const attrs = node.attrs.map((a) =>
    a.kind === "string" ? `${a.prop}="${escapeAttr(a.value)}"` : `:${a.prop}="${a.value}"`,
  );
  return printTag(
    pad,
    node.name,
    attrs,
    node.children.map((c) => vueMarkupOf(c, depth + 1)),
  );
}

/** A usage tree as JSX: props are already camelCase; anything not a plain string takes a
 * `{…}` expression, same as any other JSX value that isn't a string literal. */
export function reactMarkupOf(node: ComponentUsage, depth = 0): string {
  const pad = "  ".repeat(depth);
  if (node.kind === "text") return `${pad}${escapeText(node.text)}`;
  if (node.kind === "image") return `${pad}<img src="${escapeAttr(node.src)}" />`;
  if (node.kind === "expr") return `${pad}<Notatio expr="${escapeAttr(node.expr)}" />`;
  const attrs = node.attrs.map((a) =>
    a.kind === "string" ? `${a.prop}="${escapeAttr(a.value)}"` : `${a.prop}={${a.value}}`,
  );
  return printTag(
    pad,
    node.name,
    attrs,
    node.children.map((c) => reactMarkupOf(c, depth + 1)),
  );
}

// Run directly (`node --experimental-strip-types src/generate.ts`): write and report.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = generateAll();
  console.log(`notatio: ${names.vue.length} vue, ${names.react.length} react components generated`);
}
