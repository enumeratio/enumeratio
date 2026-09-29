// The reference as the theme sees it, in the browser and in SSR: the assembled entries come from
// the `virtual:reference-entries` module (reference-data.ts), whole in dev and slim in a build,
// where a symbol page gets its own entry through its route.

import loaded from "virtual:reference-entries";
import { lookups } from "./reference-lookups.ts";

export type { HeadInfo } from "./reference-lookups.ts";
export const { entries, getEntry, resolveHead, entriesByDomain } = lookups(loaded);
