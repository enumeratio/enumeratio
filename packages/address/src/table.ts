/**
 * The one table of marks (site map §2.5) and of the other words the grammar is
 * built from. Every separator, sigil and grammar word that a codec, a page or
 * a test needs is read from here; none is written inline anywhere else. The
 * characters are provisional (site map draft 3): changing one is a one-line
 * edit in this file.
 *
 * Parameter words (`semilength`, `blocks`, ...) are not here: they belong to
 * each collection's row in the route file (`routes/`).
 */
export const marks = {
  /** Between the segments of a path. */
  segment: '/',
  /** Before each parameter inside a segment: `Name;word=value`. */
  parameter: ';',
  /** Between a parameter's word and its value. */
  binding: '=',
  /** Members where order does not matter: `1,3`. */
  unordered: ',',
  /** Items in order: `2_1_4_3`. */
  ordered: '_',
  /** Between blocks or rows: `1,3!2!4`. */
  block: '!',
  /** A negative sign, nothing else. */
  negative: '-',
  /** A decimal point, nothing else. */
  decimal: '.',
  /** Names a notation (`cycle:...`) or an order (`@lex:7`). */
  notation: ':',
  /** Marks an element given by rank: `@7`. */
  rank: '@',
  /** Before the query string. */
  query: '?',
  /** Between the pairs of the query string. */
  queryPair: '&',
  /** Between a query key and its value. */
  queryBinding: '=',
  /** Between the values of a list-valued query key: `?show=Area,Peaks`. */
  queryList: ',',
  /** Stands for a space in a query string (form encoding): read, never written. */
  querySpace: '+',
} as const;

/**
 * What `nameKey` drops from a name before comparing it (site map §5). Its own
 * entry, so that changing a number mark never changes how names are read.
 */
export const nameSeparators: readonly string[] = ['-', '_'];

/** Grammar words that are not marks. */
export const words = {
  /** The default plural rule (§5): a trailing `s`. */
  plural: 's',
  /** Read everywhere as an alias for a collection's size parameter (§2.1). */
  sizeAlias: 'n',
} as const;

/**
 * Characters a name, a value or a parameter value may carry raw besides letters,
 * digits and the marks it may hold (`,` `_` `!` `-` `.`, and the rank sigil
 * after the first character). Everything else, the notation mark included, is
 * percent-encoded.
 */
export const valueExtras: readonly string[] = ['+', '(', ')', "'", '*', '~'];

/**
 * Every character a path segment may hold raw besides letters and digits (RFC 3986's
 * unreserved marks, sub-delimiters, `:` and `@`): `/input/` writes these raw, and encodes the rest.
 */
export const pathExtras: readonly string[] = [
  '-',
  '.',
  '_',
  '~',
  '!',
  '$',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  ';',
  '=',
  ':',
  '@',
];

/**
 * Segments a browser collapses as dot segments. A piece equal to one of these
 * is never written raw, and a value equal to one is refused when read (§2.2).
 */
export const dotSegments: readonly string[] = ['.', '..'];

/** The shapes of the words the grammar recognizes. */
export const shapes = {
  /** A notation or an order named in front of a value (`cycle`, `lex`), as regular-expression source. */
  notationName: '[A-Za-z][A-Za-z0-9]*',
  /** An OEIS number (§3): the letter, then this many digits. */
  sequenceNumber: { prefix: 'A', digits: 6 },
} as const;

/**
 * Spellings read for a mark but never written (§2.5). Reading them is
 * reported as a change to the canonical form.
 */
export const readAlsoAs = {
  /**
   * The precursor's apostrophe for ordered items. The address layer keeps an
   * element's spelling opaque: converting these is each collection's reader's
   * job (the codecs package imports this entry), and that is what uses it.
   */
  ordered: ["'"],
  /** Written with the size in the collection segment: `DyckPath(4)`, `DyckPath_4`. */
  bareOpen: '(',
  bareClose: ')',
  /** Joins a name to a bare value: `DyckPath_4`. */
  bareJoin: '_',
} as const;

/** The areas: the first segment of a path (§3). The closed list. */
export const areas = {
  collection: 'collection',
  stat: 'stat',
  map: 'map',
  sequence: 'sequence',
  input: 'input',
  atlas: 'atlas',
  about: 'about',
  contribute: 'contribute',
} as const;

export type Area = (typeof areas)[keyof typeof areas];

/**
 * Areas whose second segment is a subject (a name or an outside number). For
 * `stat` and `map` the path continues `[/<Collection>[/<element>[/<Property>...]]]`;
 * `sequence` takes the one number.
 */
export const namedAreas: readonly Area[] = [areas.stat, areas.map, areas.sequence];

/** Areas that take no further segments. */
export const leafAreas: readonly Area[] = [areas.atlas, areas.about, areas.contribute];

/** Words of the query string that the pages read (§2.4). */
export const queryWords = {
  show: 'show',
  orderBy: 'order_by',
  where: 'where',
  groupBy: 'group_by',
  as: 'as',
  /** The rank a table's window starts at, in a large collection. */
  from: 'from',
  /** The grammar made visible: how the address was read. */
  explain: 'explain',
} as const;
