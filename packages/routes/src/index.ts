/**
 * The route file, and the one module that reads it. Nothing else opens
 * `routes/*.tsv`: pages, tests and the address reader all go through here.
 */
import type { Catalog, CollectionSpec, ParameterSpec } from '@enumeratio/address';
import collectionTsv from '../../../routes/collection.tsv?raw';

/** The closed list of statuses (site map §6). */
export const statuses = ['proposed', 'reserved', 'stub', 'live'] as const;
export type Status = (typeof statuses)[number];

export const kinds = ['collection', 'subcollection'] as const;
export type Kind = (typeof kinds)[number];

/** The columns of a route file, in order. */
export const columns = [
  'name',
  'kind',
  'status',
  'within',
  'expression',
  'parameters',
  'aliases',
  'plural',
  'oeis',
  'findstat',
  'requested_by',
  'date',
] as const;

/** The cell that declares a collection has no parameters. */
export const noParameters = '-';
const parameterSeparator = '|';
const sizeMarker = '*';
const listSeparator = ',';

export interface RouteRow {
  name: string;
  kind: Kind;
  status: Status;
  /** The collection a subcollection sits inside. */
  within?: string;
  /** Epsil, with the parameters as its variables. */
  expression?: string;
  /** `undefined` when the cell is empty (not yet declared); `[]` when declared none. */
  parameters?: ParameterSpec[];
  aliases: string[];
  pluralException?: string;
  oeis?: string;
  findstat?: string;
  requestedBy: string;
  date: string;
}

export interface RouteFile {
  /** `# key: value` lines at the top of the file. `promise` is the one that matters. */
  meta: Record<string, string>;
  rows: RouteRow[];
}

const parameterCell = /^([A-Za-z][A-Za-z0-9]*)(\*)?(?:\[([^\]]*)\])?$/;

function parseParameters(cell: string, where: string): ParameterSpec[] | undefined {
  if (cell === '') return undefined;
  if (cell === noParameters) return [];
  return cell.split(parameterSeparator).map((entry) => {
    const m = parameterCell.exec(entry);
    if (!m) throw new Error(`${where}: cannot read the parameter “${entry}”`);
    return {
      word: m[1] as string,
      size: m[2] === sizeMarker,
      aliases: m[3] ? m[3].split(listSeparator).map((a) => a.trim()) : [],
    };
  });
}

const list = (cell: string): string[] =>
  cell === '' ? [] : cell.split(listSeparator).map((a) => a.trim());

/** Reads a route file. Throws on a row it cannot read; what it reads is then checked by the tests. */
export function parseRouteFile(text: string): RouteFile {
  const meta: Record<string, string> = {};
  const rows: RouteRow[] = [];
  let header = false;
  for (const [index, line] of text.split('\n').entries()) {
    if (line.trim() === '') continue;
    if (line.startsWith('#')) {
      const m = /^#\s*([a-z_]+):\s*(.*)$/.exec(line);
      if (m && !((m[1] as string) in meta)) meta[m[1] as string] = (m[2] as string).trim();
      continue;
    }
    const where = `route file line ${index + 1}`;
    const cells = line.split('\t');
    if (!header) {
      if (cells.join('\t') !== columns.join('\t'))
        throw new Error(`${where}: the header must be ${columns.join(', ')}`);
      header = true;
      continue;
    }
    if (cells.length !== columns.length) {
      throw new Error(`${where}: ${cells.length} columns, expected ${columns.length}`);
    }
    const [
      name,
      kind,
      status,
      within,
      expression,
      parameters,
      aliases,
      plural,
      oeis,
      findstat,
      by,
      date,
    ] = cells.map((c) => c.trim()) as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    if (!(kinds as readonly string[]).includes(kind))
      throw new Error(`${where}: kind “${kind}” is not one of ${kinds.join(', ')}`);
    if (!(statuses as readonly string[]).includes(status))
      throw new Error(`${where}: status “${status}” is not one of ${statuses.join(', ')}`);
    const row: RouteRow = {
      name,
      kind: kind as Kind,
      status: status as Status,
      aliases: list(aliases),
      requestedBy: by,
      date,
    };
    if (within) row.within = within;
    if (expression) row.expression = expression;
    const declared = parseParameters(parameters, where);
    if (declared) row.parameters = declared;
    if (plural) row.pluralException = plural;
    if (oeis) row.oeis = oeis;
    if (findstat) row.findstat = findstat;
    rows.push(row);
  }
  if (!header) throw new Error('route file: no header row');
  return { meta, rows };
}

export const routeFile: RouteFile = parseRouteFile(collectionTsv);
export const rows: readonly RouteRow[] = routeFile.rows;

/** Has the promise of permanence started? Until it has, the atlas says so. */
export const promiseStarted: boolean = routeFile.meta.promise !== 'not started';

/** A row as the address reader needs it. */
export function specOf(row: RouteRow): CollectionSpec {
  return {
    name: row.name,
    aliases: row.aliases,
    ...(row.pluralException ? { pluralException: row.pluralException } : {}),
    parameters: row.parameters ?? [],
  };
}

export function catalogOf(file: RouteFile): Catalog {
  return { collections: file.rows.map(specOf) };
}

/** The catalog of the route file in this repository. */
export const catalog: Catalog = catalogOf(routeFile);

export const rowByName = new Map(rows.map((r) => [r.name, r]));

/** Rows whose status means the route is served (everything but `proposed`). */
export const isServed = (row: RouteRow): boolean => row.status !== 'proposed';

/** The unrestricted collection an element's canonical address lives in (§2.2). */
export function unrestrictedCollection(name: string): string {
  let row = rowByName.get(name);
  const seen = new Set<string>();
  while (row?.within && !seen.has(row.name)) {
    seen.add(row.name);
    const parent = rowByName.get(row.within);
    if (!parent) break;
    row = parent;
  }
  return row?.name ?? name;
}
