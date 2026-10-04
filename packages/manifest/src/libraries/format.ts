// A library's format (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2): the host's
// package is the transport, the symbol index is ours. A package marks itself in `package.json`:
//
//   "enumeratio": { "namespace": "ada", "index": "./reference/index.json", "system": "0.x" }
//
// (any package, library or not, may also name its notation entry: `"notation": "./notation"`,
// JavaScript, whose LaTeX triggers and TraditionalForm heads the index lists; a library's own
// notation is data, `reference/<Name>/notation.json`, inline in the index)
//
// and ships `reference/<Name>/definition.json` (signature, body, requires, and any attributes and
// defaults) beside the index,
// which `libraryIndexOf` builds at pack time, with `examples.json` from the symbol's record
// (`index.md`, `examples.tsv`, as ours are) for the install check.

import { satisfies, validRange } from "semver";
import type { DefinitionAttribute } from "../declaration.ts";
import type { NotationData } from "../notation-data.ts";
import { type Definition, pinOf } from "../registry.ts";
import type { PackageField } from "../package-field.ts";
import { SYSTEM_VERSION } from "../system.ts";

/** The `enumeratio` field of a library's `package.json`. */
export interface LibraryField extends PackageField {
  /** Its namespace: a scoped package's must be its scope's name. */
  readonly namespace: string;
  /** Its index, relative to the package root. */
  readonly index: string;
  /** The range of the system its definitions were written against. */
  readonly system?: string;
  /** The targets it tracks (`@enumeratio/entry`'s `SOURCES`): what its scans run and its `mappings.json` hold. */
  readonly mappings?: readonly string[];
}

/**
 * Whether a package's `system` range admits the system's version. A package that states none
 * is taken at its word that it needs nothing in particular; one that states a range that isn't
 * one admits nothing.
 */
export const admitsSystem = (field: LibraryField, system: string = SYSTEM_VERSION): boolean =>
  field.system === undefined || (validRange(field.system) !== null && satisfies(system, field.system));

/** One symbol in the index: what a caller, a search path and the version check read. */
export interface IndexedSymbol {
  readonly signature: string;
  readonly pin: string;
  readonly requires?: Readonly<Record<string, string>>;
  /** How many examples `<Name>/examples.json` holds, for the install check. */
  readonly examples?: number;
  /** Its parameters' names, which markup may give as slots (`<bob.Scaled factor="5">3</bob.Scaled>`). */
  readonly params?: readonly string[];
  /** Its options' defaults: the optional parameters a call may leave out. */
  readonly defaults?: Readonly<Record<string, unknown>>;
  readonly attributes?: readonly DefinitionAttribute[];
  /** The targets `<Name>/mappings.json` has anything for. */
  readonly mappings?: readonly string[];
  /** How it's written (`<Name>/notation.json`), inline so a host can load every library's LaTeX before it builds an engine. */
  readonly notation?: NotationData;
  /** Its record's summary, for describing it without its definition; not part of the pin. */
  readonly summary?: string;
}

/** What a library's notation entry defines, as the version check reads it. */
export interface NotationSummary {
  /** Each LaTeX trigger, and the head it reads as. */
  readonly latex: readonly { readonly trigger: string; readonly name?: string }[];
  /** The heads it gives a TraditionalForm rule. */
  readonly traditional: readonly string[];
}

/** `reference/index.json`: each name's signature, pin, pinned dependencies and named slots. */
export interface LibraryIndex {
  readonly namespace: string;
  readonly symbols: Readonly<Record<string, IndexedSymbol>>;
  readonly notation?: NotationSummary;
}

/** A body's parameter names: `Function(body, x, factor)` is `[x, factor]`. */
export function paramsOf(definition: Definition): string[] | undefined {
  const { body } = definition;
  if (!Array.isArray(body) || body[0] !== "Function") return undefined;
  const names = body.slice(2);
  return names.every((n): n is string => typeof n === "string") ? names : undefined;
}

/** The triggers and heads of a notation entry (`PackageNotation`'s shape, from @enumeratio/boxes). */
export function notationSummaryOf(notation: {
  readonly latex?: readonly {
    readonly name?: string;
    readonly latexTrigger?: unknown;
    readonly identifierTrigger?: unknown;
  }[];
  readonly traditional?: Readonly<Record<string, unknown>>;
}): NotationSummary {
  const text = (t: unknown): string | undefined =>
    typeof t === "string" ? t : Array.isArray(t) ? t.join("") : undefined;
  const latex = (notation.latex ?? []).flatMap((e) => {
    const trigger = text(e.latexTrigger) ?? text(e.identifierTrigger);
    return trigger === undefined ? [] : [{ trigger, ...(e.name === undefined ? {} : { name: e.name }) }];
  });
  return { latex, traditional: Object.keys(notation.traditional ?? {}).toSorted() };
}

/** A package's index, from its definitions: what packing writes to `reference/index.json`. */
export async function libraryIndexOf(
  namespace: string,
  definitions: Readonly<Record<string, Definition>>,
  notation?: NotationSummary,
  mappings: Readonly<Record<string, readonly string[]>> = {},
): Promise<LibraryIndex> {
  const symbols: Record<string, IndexedSymbol> = {};
  for (const name of Object.keys(definitions).toSorted()) {
    const definition = definitions[name]!;
    const params = paramsOf(definition);
    const { requires, examples, defaults, attributes, notation, summary } = definition;
    symbols[name] = {
      signature: definition.signature,
      pin: await pinOf(definition),
      ...(requires === undefined ? {} : { requires }),
      ...(examples?.length ? { examples: examples.length } : {}),
      ...(params?.length ? { params } : {}),
      ...(defaults !== undefined && Object.keys(defaults).length > 0 ? { defaults } : {}),
      ...(attributes?.length ? { attributes } : {}),
      ...(notation === undefined ? {} : { notation }),
      ...(summary === undefined ? {} : { summary }),
      ...(mappings[name]?.length ? { mappings: mappings[name] } : {}),
    };
  }
  return { namespace, symbols, ...(notation === undefined ? {} : { notation }) };
}
