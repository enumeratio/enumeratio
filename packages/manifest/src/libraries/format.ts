// A library's format (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2): the host's
// package is the transport, the symbol index is ours. A package marks itself in `package.json`:
//
//   "enumeratio": { "namespace": "ada", "index": "./symbols/index.json", "system": "0.x" }
//
// and ships `symbols/<Name>/definition.json` (signature, body, requires) beside the index,
// which `libraryIndexOf` builds at pack time, with `examples.json` from the symbol's record
// (`index.md`, `examples.tsv`, as ours are) for the install check.

import { satisfies, validRange } from "semver";
import { type Definition, pinOf } from "../registry.ts";
import { SYSTEM_VERSION } from "../system.ts";

/** The `enumeratio` field of a library's `package.json`. */
export interface LibraryField {
  /** Its namespace: a scoped package's must be its scope's name. */
  readonly namespace: string;
  /** Its index, relative to the package root. */
  readonly index: string;
  /** The range of the system its definitions were written against. */
  readonly system?: string;
}

/**
 * Whether a package's `system` range admits the system's version. A package that states none
 * is taken at its word that it needs nothing in particular; one that states a range that isn't
 * one admits nothing.
 */
export const admitsSystem = (field: LibraryField, system: string = SYSTEM_VERSION): boolean =>
  field.system === undefined || (validRange(field.system) !== null && satisfies(system, field.system));

/** `symbols/index.json`: each name's signature, pin and pinned dependencies. */
export interface LibraryIndex {
  readonly namespace: string;
  readonly symbols: Readonly<
    Record<
      string,
      {
        readonly signature: string;
        readonly pin: string;
        readonly requires?: Readonly<Record<string, string>>;
        /** How many examples `<Name>/examples.json` holds, for the install check. */
        readonly examples?: number;
      }
    >
  >;
}

/** A package's index, from its definitions: what packing writes to `symbols/index.json`. */
export async function libraryIndexOf(
  namespace: string,
  definitions: Readonly<Record<string, Definition>>,
): Promise<LibraryIndex> {
  const symbols: Record<string, LibraryIndex["symbols"][string]> = {};
  for (const name of Object.keys(definitions).toSorted()) {
    const definition = definitions[name]!;
    symbols[name] = {
      signature: definition.signature,
      pin: await pinOf(definition),
      ...(definition.requires === undefined ? {} : { requires: definition.requires }),
      ...(definition.examples?.length ? { examples: definition.examples.length } : {}),
    };
  }
  return { namespace, symbols };
}
