// The `enumeratio` field any package's `package.json` may carry, a library or not. Read at
// build time (scripts/build.ts) as well as by hosts, so it imports nothing.

export interface PackageField {
  /** Its notation entry, an export subpath (`./notation`): what a host loads for every package
   *  before it builds an engine, since a LaTeX dictionary is fixed at construction. */
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
