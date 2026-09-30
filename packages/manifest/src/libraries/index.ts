// @enumeratio/manifest/libraries: libraries from package hosts (npm, GitHub) as a catalog
// (a registry of libraries), their format, and ranges locked to versions. A subpath, so the resolver
// alone doesn't bring `semver`.

export { admitsSystem, type LibraryIndex, libraryIndexOf, type LibraryField } from "./format.ts";
export { type FetchJson, fetchJson, githubHost, type JsdelivrOptions, npmHost, type PackageHost } from "./host.ts";
export { type LockOptions, lockLibraries, type LibraryLock, specsOf } from "./lock.ts";
export { catalog, type CatalogOptions } from "./catalog.ts";
