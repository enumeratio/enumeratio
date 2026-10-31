import { carrierSlotOf } from "@enumeratio/frontend/core";
import { catalogOf, type ExplorerCatalog, explorerOf } from "@enumeratio/frontend/explorer";
import { describeNow } from "@enumeratio/manifest";
import type { ReferenceEntry } from "@enumeratio/reference";
import { entries } from "../../.vitepress/data/reference-node.ts";
import { fieldsOf } from "../../.vitepress/data/carrier-fields.ts";
import { definitionsOf } from "../../.vitepress/data/definitions.ts";
import { functionViewFor } from "../../.vitepress/data/function-view.ts";
import { explorerProbes, prerenderExamples } from "../../.vitepress/data/prerender.ts";

/** The table a collection's page shows: its `enumerate:` filled in from what the record implies (the statistics on offer as names only). */
async function explorerFor(entry: ReferenceEntry, catalog: ExplorerCatalog) {
  const spec = entry.grades === undefined ? undefined : await explorerOf(entry, catalog);
  if (spec === undefined) return undefined;
  const { candidates, ...page } = spec;
  return { ...page, statistics: candidates.map((c) => c.name) };
}

const carrierNames = new Set(entries.filter((e) => e.catalogCarrier).map((e) => e.name));

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
    const catalog = { ...catalogOf(entries), ...(await explorerProbes()) };
    const pages = [];
    for (const entry of entries) {
      const parameters = describeNow(entry.name).parameters ?? [];
      pages.push({
        params: {
          name: entry.name,
          entry: clampOutputs(entry),
          prerendered: await prerenderExamples(entry),
          fields: fieldsOf(entry.name),
          explorer: await explorerFor(entry, catalog),
          definitions: definitionsOf(entry.name),
          overloads: describeNow(entry.name).overloads ?? [],
          parameters,
          carrierSlot: await carrierSlotOf(parameters, carrierNames, entries, catalog),
          maxSize: describeNow(entry.name).maxSize,
          optionValues: describeNow(entry.name).optionValues,
          functionView: functionViewFor(entry.name),
        },
      });
    }
    return pages;
  },
};
