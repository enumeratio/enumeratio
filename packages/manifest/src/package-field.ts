// The `enumeratio` field any package's `package.json` may carry, a library or not. Read at
// build time (scripts/build.ts) as well as by hosts, so it imports nothing.

/** Where a package sits.
 *  - `infra`: plumbing under everything (engine, compute-engine patches, the records' readers).
 *  - `base`: what every extension builds on.
 *  - `extension`: a symbol package, extending base or other extensions.
 *  - `presentation`: writing and showing; may import any library, and is never one's parent.
 *  - `tooling`: tests, oracles and data; imports anything, and nothing ships importing it. */
export type Layer = "infra" | "base" | "extension" | "presentation" | "tooling";

/** The family a package belongs to, where one is settled. */
export type Area = "arithmetic" | "analysis" | "algebras" | "combinatorics";

export interface PackageField {
  /** Its place in the library hierarchy (`HIERARCHY`). */
  readonly layer?: Layer;
  readonly area?: Area;
  /** The libraries it extends: declared before it, and all it may import besides infra. */
  readonly extends?: readonly string[];
  /** Entry points placed apart from the package, by subpath (`./render`). */
  readonly entries?: Readonly<Record<string, { readonly layer: Layer; readonly extends: readonly string[] }>>;
  /** Its notation entry, an export subpath (`./notation`): what a host loads for every package
   *  and gives the engine, at construction or by `addEntries`. */
  readonly notation?: string;
  /** The group the docs site files the package under (`arithmetic`, `groups`, …). */
  readonly group?: string;
  /** What declares its heads into an engine: exports of its main entry (or `./subpath#export`),
   *  called with the engine in order. Absent for a package that declares nothing (or only `late`). */
  readonly declare?: string | readonly string[];
  /** What it declares once every library's `declare` has run: heads that must be the last word
   *  (generic ones over what others widen), in the same spelling. */
  readonly late?: string | readonly string[];
  /** Names it adds to without redeclaring them, which declaring can't see: a registry a head reads. */
  readonly names?: readonly string[];
  /** What declaring it finds (`LibraryDeclares`), an export subpath (`./declares.json`) its
   *  build writes: what a host's resolver reads to know which names it brings. */
  readonly declares?: string;
  /** Libraries it needs declared first beyond what it extends in `HIERARCHY`. */
  readonly requires?: readonly string[];
}

/** The specifier a host imports a package's notation entry by, or undefined if it has none. */
export const notationSpecifier = (name: string, field: PackageField | undefined): string | undefined =>
  field?.notation === undefined ? undefined : `${name}/${field.notation.replace(/^\.\//, "")}`;
