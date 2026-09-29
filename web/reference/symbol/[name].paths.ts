import { entries } from "../../.vitepress/data/reference-node.ts";

// One generated page per reference entry, carrying the entry itself: the shared reference
// data a build ships is slim (reference-data.ts), so this is where a page's examples come from.
export default {
  paths() {
    return entries.map((entry) => ({ params: { name: entry.name, entry } }));
  },
};
