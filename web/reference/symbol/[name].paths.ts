import { entries } from "../../.vitepress/data/reference.ts";

// One generated page per reference entry.
export default {
  paths() {
    return entries.map((entry) => ({ params: { name: entry.name } }));
  },
};
