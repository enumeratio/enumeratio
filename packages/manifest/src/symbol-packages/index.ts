// @enumeratio/manifest/symbol-packages: symbol packages from package hosts (npm, GitHub) as a
// registry, their format, and version ranges locked to versions. A subpath, so the resolver
// alone doesn't bring `semver`.

export { admitsSystem, type SymbolIndex, symbolIndexOf, type SymbolPackageField } from "./format.ts";
export { type FetchJson, fetchJson, githubHost, type JsdelivrOptions, npmHost, type PackageHost } from "./host.ts";
export { type LockOptions, lockPackages, type PackageLock, specsOf } from "./lock.ts";
export { packageRegistry, type PackageRegistryOptions } from "./registry.ts";
