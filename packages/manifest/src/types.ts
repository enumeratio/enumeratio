// The manifest's shape (design/manifest.md). Everything here is known without loading a
// head's code: read from the reference records, and from a bare compute-engine for the
// engine's own heads.

export type SymbolAttribute = "HoldAll";

/** One call form of a head, and who provides it. */
export interface Overload {
  /** `compute-engine` for the engine's own, else our package's name (`boxes`, `residues`). */
  readonly package: string;
  /** The compute-engine type, `(boxes, boxes, expression*) -> boxes`, when it is known. */
  readonly type?: string;
  /** The package whose overlapping overload this one replaces. */
  readonly overrides?: string;
}

export interface SymbolInfo {
  readonly name: string;
  /** The packages that document the head (hold its record), in path order. */
  readonly documented: readonly string[];
  readonly overloads: readonly Overload[];
  /** Parameter names, for a head of fixed arity whose record spells them. */
  readonly params?: readonly string[];
  readonly attributes?: readonly SymbolAttribute[];
}

/** What a package's `declare` reads for one of its heads. */
export interface DeclaredSymbol {
  readonly summary: string;
  /** This package's overload type, when its record gives one. */
  readonly type?: string;
  readonly attributes?: readonly SymbolAttribute[];
}
