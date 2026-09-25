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
import { type AttributeDoc, collectComponents, type ComponentDoc, propType, wrapperName } from "./reflect.ts";
import { VISUAL_SYMBOLS } from "./symbols.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** Where the element sources are: the sibling package, in a workspace checkout. */
export const defaultSrcDir = resolve(here, "../../notatio-lit/src");

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
  return `// GENERATED by @enumeratio/notatio/generate from the element sources -- do not edit.
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

// Run directly (`node --experimental-strip-types src/generate.ts`): write and report.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = generateAll();
  console.log(`notatio: ${names.vue.length} vue, ${names.react.length} react components generated`);
}
