// The reference as the theme sees it, in the browser and in SSR: the entries come from the
// `virtual:reference-entries` module (reference-data.ts), which the loader fills from every
// package's YAML at build time and refreshes in dev.

import loaded from "virtual:reference-entries";
import { assemble } from "./reference-assemble.ts";

export type { HeadInfo } from "./reference-assemble.ts";
export const { documented, entries, getEntry, resolveHead, entriesByDomain } = assemble(loaded);
