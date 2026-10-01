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

/**
 * What is known about a name without an engine: compute-engine `About`'s keys where they mean
 * the same thing, and ours. `describe` assembles it (src/describe.ts).
 */
export interface Description {
  readonly name: string;
  /** `function` or `constant` by its type, `symbol` for another value, `unknown` for a name
   *  nothing knows. */
  readonly kind: "function" | "constant" | "symbol" | "unknown";
  /** Its record's summary. */
  readonly description?: string;
  /** Its reference page, for a documented head. */
  readonly url?: string;
  /** A function's signature: the overload no other replaces, the widest of those. */
  readonly signature?: string;
  /** A constant's or symbol's type. */
  readonly type?: string;
  /** Every overload, most specific first, with the package that gives it. */
  readonly overloads?: readonly Overload[];
  readonly params?: readonly string[];
  /** Its optional parameters' defaults. */
  readonly defaults?: Readonly<Record<string, unknown>>;
  readonly attributes?: readonly string[];
  /** The packages that document it. */
  readonly documented?: readonly string[];
  readonly findstat?: readonly FindStatId[];
  /** How many examples its record holds it to. */
  readonly examples?: number;
  /** The LaTeX that reads as it (`\scaled`), where its notation gives any. */
  readonly triggers?: readonly string[];
  /** A library symbol's namespace. */
  readonly namespace?: string;
  readonly pin?: string;
  /** Its body's pinned dependencies. */
  readonly requires?: Readonly<Record<string, string>>;
  /** The head a library symbol is declared as (`pinnedHead`). */
  readonly head?: string;
  /** The package that serves a library symbol, `name@version`. */
  readonly package?: string;
}
