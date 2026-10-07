import { describeNow } from "@enumeratio/manifest";
import type { ReferenceEntry } from "@enumeratio/reference";
import { entries } from "../../.vitepress/data/reference-node.ts";
import { fieldsOf } from "../../.vitepress/data/carrier-fields.ts";
import { prerenderExamples } from "../../.vitepress/data/prerender.ts";

/** Longest other-system output a page carries; a longer one (a million-element list) is cut. */
const MAX_OUTPUT_CHARS = 2000;

/** The entry with each other system's output clamped, so one huge answer isn't inlined in the page's data. */
function clampOutputs(entry: ReferenceEntry): ReferenceEntry {
  return {
    ...entry,
    examples: entry.examples.map((example) => {
      if (!example.others) return example;
      const others = Object.fromEntries(
        Object.entries(example.others).map(([system, run]) => [
          system,
          run.output.length <= MAX_OUTPUT_CHARS
            ? run
            : {
                ...run,
                output: `${run.output.slice(0, MAX_OUTPUT_CHARS)} … (${run.output.length - MAX_OUTPUT_CHARS} more characters)`,
              },
        ]),
      );
      return { ...example, others };
    }),
  };
}

// One generated page per reference entry, carrying the entry itself: the shared reference
// data a build ships is slim (reference-data.ts), so this is where a page's examples come from.
// Each example comes answered (data/prerender.ts), so the page shows it before its scripts run.
// `overloads` are the manifest's typed call forms with the package behind each.
export default {
  async paths() {
    const pages = [];
    for (const entry of entries)
      pages.push({
        params: {
          name: entry.name,
          entry: clampOutputs(entry),
          prerendered: await prerenderExamples(entry),
          fields: fieldsOf(entry.name),
          overloads: describeNow(entry.name).overloads ?? [],
        },
      });
    return pages;
  },
};
