// The resource model. A RESOURCE is a name that is addressable without being declared —
// it lives in a context, is resolved on demand, and only becomes a real compute-engine
// head if it is promoted. See design/namespaces.md.

/** What kind of thing a resource names. Kind is DATA, not syntax: reclassifying a
 *  resource is a registry edit, never a rename. */
export type ResourceKind = "collection" | "carrier" | "stat" | "map";

/** A grade axis of a collection — `role` separates a size axis from a shape parameter. */
export interface Grade {
  readonly name: string;
  readonly role: "axis" | "param";
}

/** A catalogued collection, as its head's own record now carries it (`grades`/`carrier`/
 *  `unbounded`; design/speculative/symbol-metadata.md). `description` is that head's
 *  `summary`. */
export interface CatalogCollection {
  readonly name: string;
  readonly carrier?: string;
  readonly grades: readonly Grade[];
  readonly description?: string;
  readonly unbounded?: boolean;
}

/** A bare carrier -- a domain the catalog's collections, statistics and maps are defined
 *  over, not a family (`catalogCarrier: true` on the head's own record). */
export interface CatalogCarrier {
  readonly name: string;
}

/** A statistic or map, folded to its name and overload set (`statOn`/`mapOn` on the head's
 *  own record) -- not the (collection, stat) rows the database stored, see
 *  design/namespaces.md §1. `description` is that head's `summary`. */
export interface CatalogOverload {
  readonly name: string;
  readonly on: readonly string[];
  readonly description?: string;
}

/** One resolvable name. `head` is the compute-engine head that answers it, when one
 *  exists; a resource with no head still resolves (it has metadata, an arity, a carrier)
 *  but cannot be evaluated — which is the honest answer, not a failure. */
export interface Resource {
  readonly name: string;
  readonly kind: ResourceKind;
  readonly context: string;
  readonly carrier?: string;
  readonly grades?: readonly Grade[];
  readonly title?: string;
  readonly description?: string;
  /** Carriers this stat/map is defined on — the overload set. Empty for collections. */
  readonly on?: readonly string[];
  readonly head?: string;
  readonly unbounded?: boolean;
}

/** Separates a context from a name in a qualified spelling. NOT settled — see
 *  design/namespaces.md §3.3: `~` is semantically right but LaTeX binds it to a non-breaking
 *  space, and of the alternatives only `_` is legal in a compute-engine symbol name (where it
 *  collides with the subscript convention). A registry key is just a string, so this is cheap
 *  to change here and expensive to change once it is written down. */
export const SEPARATOR = "`";

/** A fully-qualified spelling: `context` + SEPARATOR + `Name`. */
export const qualify = (context: string, name: string): string => `${context}${SEPARATOR}${name}`;

/** Split a spelling into context and name; context is undefined when unqualified. */
export function unqualify(spelling: string): { context?: string; name: string } {
  const i = spelling.lastIndexOf(SEPARATOR);
  return i < 0 ? { name: spelling } : { context: spelling.slice(0, i), name: spelling.slice(i + 1) };
}
