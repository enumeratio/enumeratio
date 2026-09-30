// The manifest's shape (https://github.com/enumeratio/enumeratio/wiki/Manifest). Everything here is known without loading a
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
  /** The carriers it applies to, when it applies to nothing else. */
  readonly on?: readonly string[];
  /** The symbol names it applies to, as regular expressions, when it applies to nothing else. */
  readonly symbols?: readonly string[];
  /** The carrier types it applies to, when it applies to nothing else. */
  readonly types?: readonly string[];
}

export interface SymbolInfo {
  readonly name: string;
  /** The packages that document the head (hold its record), in path order. */
  readonly documented: readonly string[];
  readonly overloads: readonly Overload[];
  /** Parameter names, for a head of fixed arity whose record spells them. */
  readonly params?: readonly string[];
  readonly attributes?: readonly SymbolAttribute[];
  /** FindStat's ids for it (`St000018`, `Mp00066`), each with the carrier it is on, when the
   *  record says. A statistic or map is also reached by these. */
  readonly findstat?: readonly FindStatId[];
}

export interface FindStatId {
  readonly id: string;
  readonly on?: string;
}

/** What a package's `declare` reads for one of its heads. */
export interface DeclaredSymbol {
  readonly summary: string;
  /** This package's overload type, when its record gives one. */
  readonly type?: string;
  readonly attributes?: readonly SymbolAttribute[];
}
