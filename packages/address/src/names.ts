import { nameSeparators, words } from './table.ts';

/** Escapes a table entry for use inside a regular expression. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** What a name is reduced to for comparison (§5): drop the name separators, lowercase. */
export function nameKey(name: string): string {
  let key = name;
  for (const separator of nameSeparators) key = key.replaceAll(separator, '');
  return key.toLowerCase();
}

/** The default plural rule (§5): a trailing `s`. */
export function defaultPlural(name: string): string {
  return `${name}${words.plural}`;
}

/** The plural of a name: its recorded exception when it has one, else the default rule. */
export function pluralOf(name: string, exception?: string): string {
  return exception !== undefined && exception !== '' ? exception : defaultPlural(name);
}

/** A parameter of a collection, as its route row declares it. */
export interface ParameterSpec {
  /** The collection's own word for it: `semilength`, `blocks`, `k`. */
  word: string;
  aliases: readonly string[];
  /** The one parameter that `n` and a bare value bind (§2.1). At most one per collection. */
  size: boolean;
}

/** What the address layer needs to know of a collection to read its segment. */
export interface CollectionSpec {
  name: string;
  aliases: readonly string[];
  /** The plural when it is not the default rule's. */
  pluralException?: string;
  /** In declared (= canonical) order. */
  parameters: readonly ParameterSpec[];
  /** Declared property names, when known. Names not listed are kept as written. */
  properties?: readonly string[];
}

export interface Catalog {
  collections: readonly CollectionSpec[];
  /**
   * Declared statistic and map names. A `/stat/` or `/map/` subject is read by
   * `nameKey` to the declared name when exactly one matches; an unknown subject
   * is kept as written.
   */
  subjects?: readonly string[];
}

/** The word that `n` is read as: the key of `n`. */
export const sizeAliasKey = nameKey(words.sizeAlias);

export interface Lookup {
  /** key -> collection, over names, aliases and plurals. Ambiguous keys are in `conflicts`. */
  byKey: Map<string, CollectionSpec>;
  conflicts: Map<string, CollectionSpec[]>;
}

const lookups = new WeakMap<Catalog, Lookup>();

/** Every key by which a collection is read: its name, its aliases, their plurals. */
export function keysOf(spec: CollectionSpec): string[] {
  const keys = [nameKey(spec.name), nameKey(pluralOf(spec.name, spec.pluralException))];
  for (const alias of spec.aliases) keys.push(nameKey(alias), nameKey(defaultPlural(alias)));
  return [...new Set(keys)];
}

export function lookupOf(catalog: Catalog): Lookup {
  const cached = lookups.get(catalog);
  if (cached) return cached;
  const byKey = new Map<string, CollectionSpec>();
  const conflicts = new Map<string, CollectionSpec[]>();
  for (const spec of catalog.collections) {
    for (const key of keysOf(spec)) {
      const held = byKey.get(key);
      if (held === undefined) byKey.set(key, spec);
      else if (held !== spec) {
        const list = conflicts.get(key) ?? [held];
        list.push(spec);
        conflicts.set(key, list);
      }
    }
  }
  const made = { byKey, conflicts };
  lookups.set(catalog, made);
  return made;
}

/** The collection a requested name means, or undefined when none or ambiguous. */
export function findCollection(catalog: Catalog, requested: string): CollectionSpec | undefined {
  const { byKey, conflicts } = lookupOf(catalog);
  const key = nameKey(requested);
  return conflicts.has(key) ? undefined : byKey.get(key);
}

/** The parameter a requested word means in a collection: its word, an alias, or `n` for the size. */
export function findParameter(spec: CollectionSpec, requested: string): ParameterSpec | undefined {
  const key = nameKey(requested);
  for (const p of spec.parameters) {
    if (nameKey(p.word) === key || p.aliases.some((a) => nameKey(a) === key)) return p;
  }
  if (key === sizeAliasKey) return spec.parameters.find((p) => p.size);
  return undefined;
}
