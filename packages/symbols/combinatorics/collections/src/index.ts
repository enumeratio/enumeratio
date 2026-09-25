export { declareCollections } from "./library.ts";
export { allEntries } from "./families/index.ts";
export { type Count, countNumber, type FamilyKernel, type NumberKernel, numberKernel } from "./families/types.ts";
export { declareStats, type StatsOptions } from "./stats.ts";

// Reference entries live at the buildless `@enumeratio/collections/reference`
// subpath -- they import the ReferenceEntry type from another src-only package,
// which tsdown's dts step can't follow, so they stay out of the runtime build.
