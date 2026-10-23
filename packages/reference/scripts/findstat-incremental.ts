// Incremental regeneration for `find-findstat.ts` and `find-findstat-maps.ts`: rematch only the
// heads asked for, carry every other row over from the committed file, and rename rows in place.
// The result is the same list a full run builds, in the same (universe) order, so the generated
// file stays generated: after a rename or a new head nobody has to hand-patch it.

/** `Old=New@Carrier`: the row for `Old` at `Carrier` is now `New`. */
export interface Rename {
  readonly old: string;
  readonly to: string;
  readonly carrier: string;
}

export function parseRename(spec: string): Rename {
  const match = /^([^=@\s]+)=([^=@\s]+)@([^=@\s]+)$/.exec(spec);
  if (!match) throw new Error(`--rename wants Old=New@Carrier, got "${spec}"`);
  return { old: match[1]!, to: match[2]!, carrier: match[3]! };
}

/** `A,B@Carrier`: heads to rematch; a bare head means every carrier it is declared on. */
export function parseHeads(specs: readonly string[]): ReadonlySet<string> {
  return new Set(specs.flatMap((spec) => spec.split(",")).filter((s) => s !== ""));
}

/** Whether `head` at `carrier` is one of `heads` (a head alone, or `head@carrier`). */
export const selected = (heads: ReadonlySet<string>, head: string, carrier: string): boolean =>
  heads.has(head) || heads.has(`${head}@${carrier}`);

/**
 * The rows of a full run over `universe`, rematching only the selected items.
 *
 * `previous` is the committed rows (with `renames` already applied); an unselected item takes its
 * row from there, or has none (it matched nothing). `match` is the expensive part, and runs only
 * for the selected. Rows come out in `universe` order whichever way each was found.
 */
export function assemble<Item, Row>(
  universe: readonly Item[],
  keyOf: (item: Item) => string,
  previous: ReadonlyMap<string, Row>,
  isSelected: (item: Item) => boolean,
  match: (item: Item) => Row | undefined,
): Row[] {
  const rows: Row[] = [];
  for (const item of universe) {
    const row = isSelected(item) ? match(item) : previous.get(keyOf(item));
    if (row !== undefined) rows.push(row);
  }
  return rows;
}

/** The committed rows with `renames` applied, keyed by `head@carrier`; `rename` rewrites one row's name. */
export function renamed<Row>(
  rows: readonly Row[],
  keyOf: (row: Row) => { head: string; carrier: string },
  rename: (row: Row, to: string) => Row,
  renames: readonly Rename[],
): Map<string, Row> {
  const out = new Map<string, Row>();
  for (const row of rows) {
    const { head, carrier } = keyOf(row);
    const hit = renames.find((r) => r.old === head && r.carrier === carrier);
    const next = hit ? rename(row, hit.to) : row;
    const key = keyOf(next);
    out.set(`${key.head}@${key.carrier}`, next);
  }
  return out;
}
