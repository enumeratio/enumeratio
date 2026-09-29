export { declareCollections } from "./library.ts";
export { allEntries } from "./families/index.ts";
export {
  type Cost,
  type Count,
  countNumber,
  type Declared,
  type FamilyKernel,
  type NumberKernel,
  numberKernel,
  type Param,
} from "./families/types.ts";
export { declareStats, type StatsOptions } from "./stats.ts";

// Reference entries live in the package-root `reference/` (shared with the domains area,
// since @enumeratio/entry/node's recordDirs looks for one `reference/` per package) -- they
// import the ReferenceEntry type from another src-only package, which tsdown's dts step can't
// follow, so they stay out of the runtime build.
