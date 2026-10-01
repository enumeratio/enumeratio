import { entries } from "../../.vitepress/data/reference-node.ts";
import { prerenderExamples } from "../../.vitepress/data/prerender.ts";

// One generated page per reference entry, carrying the entry itself: the shared reference
// data a build ships is slim (reference-data.ts), so this is where a page's examples come from.
// Each example comes answered (data/prerender.ts), so the page shows it before its scripts run.
export default {
  async paths() {
    const pages = [];
    for (const entry of entries)
      pages.push({ params: { name: entry.name, entry, prerendered: await prerenderExamples(entry) } });
    return pages;
  },
};
