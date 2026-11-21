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
} as const;

/**
 * Spellings read for a mark but never written (§2.5). Reading them is
 * reported as a change to the canonical form.
 */
export const readAlsoAs = {
  /** The precursor's apostrophe for ordered items. */
  ordered: ["'"],
  /** Written with the size in the collection segment: `DyckPath(4)`, `DyckPath_4`. */
  bareOpen: '(',
  bareClose: ')',
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

/** Areas whose path is `/<area>/<Name>[/<Collection>[/<element>[/<Property>...]]]`. */
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
  /** The grammar made visible: how the address was read. */
  explain: 'explain',
} as const;
