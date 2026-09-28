// Rebuild `src/stories-data.ts` from every `reference/<Name>.stories.yaml` -- the component
// reference pages read this file, not the YAML, the same way the crosswalk reads
// `curated-data.ts` instead of parsing records at runtime (they run in the browser and the
// site build, and cannot parse YAML there). A story's `expr` is the source of truth (design/
// vdom.md: a MathJSON node and a vdom node are the same tree under a renaming); its source
// panel shows it in several equivalent written forms, each derived here and pinned so the page
// never re-derives one:
//
//   - `epsil`, the expression as Epsil text (`toInputForm`) -- what a notebook cell, the CLI
//     or `<Notatio expr>` actually takes, and the default tab;
//   - `vue` / `react`, the real generated per-symbol component (`@enumeratio/frontend/generate`'s
//     `usageOf`) with its real prop names and types -- a String prop stays a plain attribute,
//     anything else binds (`:prop="…"` / `{…}`), since a plain template attribute doesn't coerce;
//   - `html`, the lit-tag markup a plain-HTML host would write (`renderingOf`/`vdomOf` -- the
//     same lowering that draws the live render -- plus `markupOf`);
//   - `vdom`, the expression's own tree verbatim (`structuralOf`/`structuralMarkupOf`): every
//     head a tag, every argument a child, PascalCase heads and all. Kept rather than dropped:
//     it shows the AST shape design/vdom.md is about, which `vue`/`react`/`html` all obscure
//     the moment a component maps an argument to an attribute (a chart's `data`, say) instead
//     of a child -- `vue` doesn't cover it, so it stays, last.
//
// `usageOf` returns `undefined` for a shape it doesn't reconstruct (a control, or an option
// itself drawn as a slotted child) -- neither occurs in today's stories, and a story that hit
// one would fall back to `<Notatio expr>` for its `vue`/`react` forms, always correct even if
// less illustrative. The live render on the page still goes through `vdomOf`/`toVNode` at
// runtime: that lowering is cheap, pure and can only get more correct as the engine does, so
// pinning it would just be something else to regenerate.
//
//   vp node packages/components/scripts/collect-stories.ts

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COMPONENT_STORIES_SCHEMA, validateSchema } from "@enumeratio/entry/schema";
import { readStories, STORIES_SUFFIX, writeFormatted } from "@enumeratio/entry/node";
import { toInputForm } from "@enumeratio/formats";
import { reactMarkupOf, usageOf, vueMarkupOf } from "@enumeratio/frontend/generate";
import { markupOf, renderingOf } from "@enumeratio/frontend/symbols";
import { structuralMarkupOf } from "@enumeratio/frontend/reflect";
import { structuralOf, vdomOf } from "@enumeratio/frontend/vdom";
import type { ComponentStory } from "@enumeratio/entry";

const referenceDir = new URL("../reference/", import.meta.url);
const referencePath = fileURLToPath(referenceDir);

const names = readdirSync(referencePath)
  .filter((f) => f.endsWith(STORIES_SUFFIX))
  .map((f) => f.slice(0, -STORIES_SUFFIX.length))
  .sort();

/** One written form of a story's source, shown as a tab in the source panel. */
export interface StoryForm {
  /** Which tab; stable across regeneration -- `epsil`, `vue`, `react`, `html`, `vdom` today. */
  readonly id: string;
  /** The tab's label. */
  readonly label: string;
  /** Where this form is actually written -- shown under the tab. */
  readonly caption: string;
  /** The markup itself. */
  readonly text: string;
}

export interface StoryData extends ComponentStory {
  /** The story's source, one entry per written form -- see the forms named above. */
  readonly forms: readonly StoryForm[];
}

const escapeAttr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** `<Notatio expr>` over the raw Epsil -- the always-correct fallback for a usage tree
 * `usageOf` couldn't reconstruct; valid as both a Vue template and JSX verbatim. */
const notatioFallback = (json: never): string => `<Notatio expr="${escapeAttr(toInputForm(json))}" />`;

/** Every written form of `expr`, in tab order -- see the module doc comment above. */
function formsOf(expr: ComponentStory["expr"]): StoryForm[] {
  const json = expr as never;
  const usage = usageOf(json);
  return [
    {
      id: "epsil",
      label: "Epsil",
      caption: "notebook cells, the CLI, <Notatio expr>",
      text: toInputForm(json),
    },
    {
      id: "vue",
      label: "Vue",
      caption: "VitePress, Vue SFCs, Nuxt",
      text: usage ? vueMarkupOf(usage) : notatioFallback(json),
    },
    {
      id: "react",
      label: "React",
      caption: "MDX, Next, any React",
      text: usage ? reactMarkupOf(usage) : notatioFallback(json),
    },
    {
      id: "html",
      label: "Web component",
      caption: "plain HTML",
      // `renderingOf` falls back to `vdomOf`'s `notatio-out` only for an expression with no
      // component of its own -- not a story's, which is always over its component's head.
      text: markupOf(renderingOf(json) ?? vdomOf(json)),
    },
    {
      id: "vdom",
      label: "vdom",
      caption: "the expression's own tree -- every head a tag, every argument a child",
      text: structuralMarkupOf(structuralOf(json)),
    },
  ];
}

const data: Record<string, StoryData[]> = {};
const issues: string[] = [];
for (const name of names) {
  const stories = readStories(referenceDir, name);
  for (const message of validateSchema(COMPONENT_STORIES_SCHEMA, stories))
    issues.push(`${name}${STORIES_SUFFIX}: ${message}`);
  const seen = new Set<string>();
  for (const story of stories) {
    if (seen.has(story.id)) issues.push(`${name}${STORIES_SUFFIX}: duplicate story id "${story.id}"`);
    seen.add(story.id);
  }
  data[name] = stories.map((story) => ({
    ...story,
    forms: formsOf(story.expr),
  }));
}
if (issues.length > 0) throw new Error(`collect-stories: ${issues.map((i) => `\n  ${i}`).join("")}`);

await writeFormatted(
  new URL("../src/stories-data.ts", import.meta.url),
  `// GENERATED by scripts/collect-stories.ts — do not edit by hand.
//
// Every component's stories (reference/<Name>.stories.yaml), keyed by component name, each
// with its source forms derived from its expr and pinned. Regenerate with:
//
//   vp node packages/components/scripts/collect-stories.ts

export type MathJSON = number | string | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

export interface StoryForm {
  readonly id: string;
  readonly label: string;
  readonly caption: string;
  readonly text: string;
}

export interface StoryData {
  readonly id: string;
  readonly caption: string;
  readonly category?: string;
  readonly notes?: string;
  readonly expr: MathJSON;
  readonly forms: readonly StoryForm[];
}

export const STORIES_DATA: Readonly<Record<string, readonly StoryData[]>> = ${JSON.stringify(data, null, 2)};
`,
);

console.log(`${names.length} component(s), ${Object.values(data).flat().length} stories collected`);
