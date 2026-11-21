/**
 * Reading a route file's text. Pure: no file access, so the site, the tests and
 * the build's own scripts all read rows through this one function.
 */
import type { Binding, Catalog, CollectionSpec, ParameterSpec } from '@enumeratio/address';
import {
  type Json,
  type Template,
  headsOf,
  matchTemplate,
  namesOf,
  parseTemplate,
  writeTemplate,
} from './template.ts';

/** The closed list of statuses (site map §6). */
export const statuses = ['proposed', 'reserved', 'stub', 'live'] as const;
export type Status = (typeof statuses)[number];

export const kinds = ['collection', 'subcollection'] as const;
export type Kind = (typeof kinds)[number];

/** The ways an element's value is written (the codecs package holds one reader and writer for each). */
export const valueShapes = [
  'integer',
  'ordered',
  'parts',
  'digits',
  'unordered',
  'blocks',
] as const;
export type ValueShape = (typeof valueShapes)[number];

/** The columns of a route file, in order. */
export const columns = [
  'name',
  'kind',
  'status',
  'within',
  'expression',
  'kth',
  'element',
  'value',
  'parameters',
  'measures',
  'aliases',
  'plural',
  'show',
  'oeis',
  'findstat',
  'requested_by',
  'date',
] as const;

// The route file's own cell grammar. It is this file's format, not the address grammar's.
/** The cell that declares a collection has no parameters. */
export const noParameters = '-';
const parameterSeparator = '|';
const sizeMarker = '*';
const measureBinding = '=';
const listSeparator = ',';
/** Between the forms of an expression that bind different sets of parameters. */
const alternativeSeparator = ' | ';
/** In an element's constructor: where the element's own value goes. */
export const valueVariable = 'x';
/** In a row's k-th member: the position, counted from 1. */
export const rankVariable = 'k';

export interface RouteRow {
  name: string;
  kind: Kind;
  status: Status;
  /** The collection a subcollection sits inside. */
  within?: string;
  /**
   * The Epsil behind the collection (its plural head), with the parameters as
   * its variables. One form for each set of parameters that can be bound
   * together: `SetPartitions(size, blocks)` and `SetPartitions(size)`.
   */
  expressions: Template[];
  /** The cell as written. */
  expression?: string;
  /**
   * The k-th member in the default order (k from 1), over `k` alone: for a collection
   * that is a set, whose order is the catalogue's statement and not the engine's.
   */
  kth?: Template;
  /** The constructor of one element, over `x` (its value) and any parameter it needs. */
  element?: Template;
  /** How an element's value is written in an address. */
  value?: ValueShape;
  /** `undefined` when the cell is empty (not yet declared); `[]` when declared none. */
  parameters?: ParameterSpec[];
  /**
   * For a parameter an element determines: the Epsil, over `x`, that gives its
   * value (`size` is `Length(x)` for a permutation). The kernel computes it;
   * it is how an element is placed in its collection when the address binds nothing.
   */
  measures: Map<string, Template>;
  aliases: string[];
  pluralException?: string;
  /** The properties a page shows first, in order. */
  show: string[];
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

function parseMeasures(cell: string, where: string): Map<string, Template> {
  const out = new Map<string, Template>();
  if (cell === '') return out;
  for (const entry of cell.split(parameterSeparator)) {
    const at = entry.indexOf(measureBinding);
    if (at < 1) throw new Error(`${where}: cannot read the measure “${entry}”`);
    out.set(entry.slice(0, at).trim(), parseTemplate(entry.slice(at + 1).trim()));
  }
  return out;
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
    const cell = Object.fromEntries(columns.map((c, i) => [c, (cells[i] as string).trim()])) as {
      [K in (typeof columns)[number]]: string;
    };
    if (!(kinds as readonly string[]).includes(cell.kind))
      throw new Error(`${where}: kind “${cell.kind}” is not one of ${kinds.join(', ')}`);
    if (!(statuses as readonly string[]).includes(cell.status))
      throw new Error(`${where}: status “${cell.status}” is not one of ${statuses.join(', ')}`);
    if (cell.value !== '' && !(valueShapes as readonly string[]).includes(cell.value))
      throw new Error(`${where}: value “${cell.value}” is not one of ${valueShapes.join(', ')}`);
    const row: RouteRow = {
      name: cell.name,
      kind: cell.kind as Kind,
      status: cell.status as Status,
      expressions:
        cell.expression === ''
          ? []
          : cell.expression.split(alternativeSeparator).map(parseTemplate),
      measures: parseMeasures(cell.measures, where),
      aliases: list(cell.aliases),
      show: list(cell.show),
      requestedBy: cell.requested_by,
      date: cell.date,
    };
    if (cell.within) row.within = cell.within;
    if (cell.expression) row.expression = cell.expression;
    if (cell.kth) {
      const kth = parseTemplate(cell.kth);
      if (kth.kind === 'integer')
        throw new Error(`${where}: the k-th member must use ${rankVariable}`);
      const stray = [...namesOf(kth)].filter((n) => n !== rankVariable && !/^[A-Z]/.test(n));
      if (stray.length > 0 || !namesOf(kth).has(rankVariable))
        throw new Error(
          `${where}: the k-th member is over ${rankVariable} alone (it names ${[...namesOf(kth)].join(', ')})`,
        );
      row.kth = kth;
    }
    if (cell.element) row.element = parseTemplate(cell.element);
    if (cell.value) row.value = cell.value as ValueShape;
    const declared = parseParameters(cell.parameters, where);
    if (declared) row.parameters = declared;
    if (cell.plural) row.pluralException = cell.plural;
    if (cell.oeis) row.oeis = cell.oeis;
    if (cell.findstat) row.findstat = cell.findstat;
    rows.push(row);
  }
  if (!header) throw new Error('route file: no header row');
  return { meta, rows };
}

/** A row as the address reader needs it. */
export function specOf(row: RouteRow): CollectionSpec {
  return {
    name: row.name,
    aliases: row.aliases,
    ...(row.pluralException ? { pluralException: row.pluralException } : {}),
    parameters: row.parameters ?? [],
  };
}

export function catalogOf(file: RouteFile, subjects: readonly string[] = []): Catalog {
  return { collections: file.rows.map(specOf), subjects };
}

/** Rows whose status means the route is served (everything but `proposed`). */
export const isServed = (row: RouteRow): boolean => row.status !== 'proposed';

// ---------------------------------------------------------------- the expressions behind a row

const wordsOf = (row: RouteRow): Set<string> => new Set((row.parameters ?? []).map((p) => p.word));

/** The parameters a template names. */
export function parametersIn(row: RouteRow, template: Template): string[] {
  const words = wordsOf(row);
  return [...namesOf(template)].filter((n) => words.has(n));
}

/** A parameter's value is a point (site map §2.1): here, an integer. */
export const isPoint = (value: string): boolean => /^-?\d+$/.test(value);

export type Expressed =
  | { ok: true; epsil: string }
  /** No form of the expression binds exactly these parameters: these would also have to be bound. */
  | { ok: false; missing: string[] };

/**
 * The Epsil for a collection with these parameters bound: the form of the
 * row's expression whose parameters are exactly the bound ones.
 */
export function collectionExpression(row: RouteRow, bound: readonly Binding[]): Expressed {
  const have = new Map(bound.map((b) => [b.word, b.value]));
  let nearest: string[] | undefined;
  for (const form of row.expressions) {
    const needs = parametersIn(row, form);
    const missing = needs.filter((w) => !have.has(w));
    const unused = [...have.keys()].filter((w) => !needs.includes(w));
    if (missing.length === 0 && unused.length === 0) {
      return { ok: true, epsil: writeTemplate(form, have) };
    }
    if (unused.length === 0 && (nearest === undefined || missing.length < nearest.length)) {
      nearest = missing;
    }
  }
  return { ok: false, missing: nearest ?? [] };
}

/** The parameters an element cannot be written without (`n` for a subset of 1..n). */
export function identityParameters(row: RouteRow): string[] {
  return row.element ? parametersIn(row, row.element) : [];
}

/** The Epsil for the k-th member of a row's collection, when the row states one. */
export function kthExpression(row: RouteRow, rank: number): string | undefined {
  return row.kth && writeTemplate(row.kth, new Map([[rankVariable, String(rank)]]));
}

/** The Epsil for one element, from its value written in Epsil and the parameters bound. */
export function elementExpression(
  row: RouteRow,
  bound: readonly Binding[],
  valueEpsil: string,
): Expressed {
  if (!row.element) return { ok: false, missing: [] };
  const have = new Map(bound.map((b) => [b.word, b.value]));
  const missing = identityParameters(row).filter((w) => !have.has(w));
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    epsil: writeTemplate(row.element, new Map([...have, [valueVariable, valueEpsil]])),
  };
}

/**
 * Reads an answer as an element of this row: its value (MathJSON) and the
 * parameters its constructor carries. Undefined when it is not one.
 */
export function readElementJson(
  row: RouteRow,
  json: Json,
): { value: Json; parameters: Binding[] } | undefined {
  if (!row.element) return undefined;
  const identity = identityParameters(row);
  const found = matchTemplate(row.element, json, new Set([valueVariable, ...identity]));
  if (!found || !found.has(valueVariable)) return undefined;
  const parameters: Binding[] = [];
  for (const word of identity) {
    const value = found.get(word);
    if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
    parameters.push({ word, value: String(value) });
  }
  return { value: found.get(valueVariable), parameters };
}

/** Every head a row's expressions and constructor call, and every property it shows. */
export function headsIn(row: RouteRow): string[] {
  const heads = new Set<string>();
  for (const form of row.expressions) {
    headsOf(form, heads);
    // A collection with no parameters is a bare symbol: `PrimeNumbers`.
    if (form.kind === 'name') heads.add(form.name);
  }
  if (row.element) headsOf(row.element, heads);
  if (row.kth) headsOf(row.kth, heads);
  for (const measure of row.measures.values()) headsOf(measure, heads);
  return [...heads];
}

/**
 * What the address binds, and beside it every parameter the element itself
 * determines, as Epsil over the element's value: what places an element in its
 * collection.
 */
export function measuredBindings(
  row: RouteRow,
  bound: readonly Binding[],
  valueEpsil: string,
): Binding[] {
  const have = new Set(bound.map((b) => b.word));
  const value = new Map([[valueVariable, valueEpsil]]);
  const out = [...bound];
  for (const [word, measure] of row.measures) {
    if (!have.has(word)) out.push({ word, value: writeTemplate(measure, value) });
  }
  return out;
}
