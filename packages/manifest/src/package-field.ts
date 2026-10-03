// The `enumeratio` field any package's `package.json` may carry, a library or not. Read at
// build time (scripts/build.ts) as well as by hosts, so it imports nothing.

export interface PackageField {
  /** Its notation entry, an export subpath (`./notation`): what a host loads for every package
   *  before it builds an engine, since a LaTeX dictionary is fixed at construction. */
  readonly notation?: string;
  /** The group the docs site files the package under (`arithmetic`, `groups`, …). */
  readonly group?: string;
}

/** The specifier a host imports a package's notation entry by, or undefined if it has none. */
export const notationSpecifier = (name: string, field: PackageField | undefined): string | undefined =>
  field?.notation === undefined ? undefined : `${name}/${field.notation.replace(/^\.\//, "")}`;
