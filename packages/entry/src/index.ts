// The shape of a reference entry, and nothing else: what a package's `entries.ts` is typed
// against, the crosswalk pointer an entry may carry, and the rule its `implementations`
// block has to satisfy. No runtime dependencies, so `collections`, `statistics`, `domains`
// can depend on this while `reference` depends on them — the cycle this package exists
// to break.

export type * from "./types.ts";
export type * from "./reference.ts";
export { type CrosswalkSource, type CrosswalkSystem, isCrosswalkSystem, SOURCES, SYSTEM_ORDER } from "./sources.ts";
export { checkImplementations, type Exists, type Problem } from "./validate.ts";
export { isCanonicalYaml, parseYaml, type StringifyOptions, stringifyYaml } from "./yaml.ts";
export { orderImplementations } from "./order.ts";
export { captionId, dedupeId, EXAMPLE_ID, EXAMPLE_ID_MAX, slugId } from "./id.ts";
