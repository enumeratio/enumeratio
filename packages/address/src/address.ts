import {
  type Catalog,
  type CollectionSpec,
  defaultPlural,
  findCollection,
  findParameter,
  nameKey,
} from './names.ts';
import { type Area, areas, leafAreas, marks, readAlsoAs } from './table.ts';

/** `word=value`, the value opaque at this layer. */
export interface Binding {
  word: string;
  value: string;
}

/** A name with the parameters bound inside its segment: `SetPartition;size=4;blocks=2`. */
export interface Segment {
  name: string;
  parameters: Binding[];
}

export type Element =
  | { kind: 'value'; notation?: string; value: string }
  | { kind: 'rank'; order?: string; rank: number };

export type Step =
  | { kind: 'index'; index: number }
  | { kind: 'property'; name: string; parameters: Binding[] };

export interface Address {
  /** One of the areas, or the first segment as written when it is none, or '' for the root. */
  area: string;
  /** The name after `/stat/`, `/map/`, `/sequence/`. */
  subject?: string;
  collection?: Segment;
  element?: Element;
  chain: Step[];
  /** The expression after `/input/`. */
  expression?: string;
  /** Segments that belong to no position (an unknown area, extras after a leaf). */
  rest?: string[];
  query: [string, string][];
}

export interface Problem {
  code:
    | 'unknown-area'
    | 'unknown-collection'
    | 'ambiguous-collection'
    | 'unknown-parameter'
    | 'duplicate-parameter'
    | 'no-size-parameter'
    | 'bare-value'
    | 'bad-rank'
    | 'bad-index'
    | 'bad-encoding'
    | 'unreadable-element'
    | 'extra-segment'
    | 'missing-segment';
  message: string;
  /** The text of the path segment concerned, as written. */
  at?: string;
}

export interface ParseOptions {
  catalog?: Catalog;
  /**
   * A collection's reader for an element written some other way (PR 2 supplies
   * the codecs). Returns the canonical value, `null` to refuse the spelling,
   * or `undefined` when the collection has no reader (the value is kept).
   */
  readElement?: (collection: string, raw: string) => string | null | undefined;
  /** Resolves an outside identifier (`St000012`, `Mp00023`) to a name. */
  resolveSubject?: (area: string, raw: string) => string | undefined;
}

export interface ParseResult {
  address: Address;
  /** True when the input was already the canonical spelling, byte for byte. */
  canonical: boolean;
  /** The canonical path and query: equal to the input when `canonical`. */
  canonicalPath: string;
  problems: Problem[];
}

// ---------------------------------------------------------------- encoding

const alnum = /^[A-Za-z0-9]$/;
const valueSafe = new Set<string>([
  marks.unordered,
  marks.ordered,
  marks.block,
  marks.negative,
  marks.decimal,
  marks.notation,
  marks.rank,
  '+',
  '(',
  ')',
  "'",
  '*',
  '~',
]);

function encodeWith(text: string, safe: ReadonlySet<string>): string {
  let out = '';
  for (const ch of text) {
    if (alnum.test(ch) || safe.has(ch)) out += ch;
    else {
      try {
        out += encodeURIComponent(ch);
      } catch {
        out += encodeURIComponent('�');
      }
    }
  }
  return out;
}

/** Encodes one piece of a segment: a name, a parameter value, an element. */
export function encodePiece(text: string): string {
  return encodeWith(text, valueSafe);
}

const noSafe: ReadonlySet<string> = new Set();

function encodeQueryPiece(text: string): string {
  return encodeWith(text, new Set([marks.queryList, marks.ordered, marks.negative, marks.decimal]));
}

function decodePiece(raw: string, problems: Problem[]): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    problems.push({ code: 'bad-encoding', message: `Bad percent-encoding in “${raw}”.`, at: raw });
    return raw;
  }
}

// ---------------------------------------------------------------- format

function formatBindings(bindings: readonly Binding[]): string {
  return bindings
    .map((b) => `${marks.parameter}${encodePiece(b.word)}${marks.binding}${encodePiece(b.value)}`)
    .join('');
}

export function formatSegment(segment: Segment): string {
  return encodePiece(segment.name) + formatBindings(segment.parameters);
}

export function formatElement(element: Element): string {
  if (element.kind === 'rank') {
    const order =
      element.order === undefined ? '' : `${encodePiece(element.order)}${marks.notation}`;
    return `${marks.rank}${order}${element.rank}`;
  }
  const notation =
    element.notation === undefined ? '' : `${encodePiece(element.notation)}${marks.notation}`;
  return notation + encodePiece(element.value);
}

export function formatStep(step: Step): string {
  return step.kind === 'index'
    ? String(step.index)
    : encodePiece(step.name) + formatBindings(step.parameters);
}

export function formatQuery(query: readonly (readonly [string, string])[]): string {
  return query
    .map(([key, value]) =>
      value === ''
        ? encodeQueryPiece(key)
        : `${encodeQueryPiece(key)}${marks.queryBinding}${encodeQueryPiece(value)}`,
    )
    .join(marks.queryPair);
}

/** The path of an address, with its leading `/`. */
export function formatPath(address: Address): string {
  const parts: string[] = [];
  if (address.area !== '') parts.push(encodePiece(address.area));
  if (address.subject !== undefined) parts.push(encodePiece(address.subject));
  if (address.collection) parts.push(formatSegment(address.collection));
  if (address.element) parts.push(formatElement(address.element));
  for (const step of address.chain) parts.push(formatStep(step));
  if (address.expression !== undefined) parts.push(encodeWith(address.expression, noSafe));
  for (const r of address.rest ?? []) parts.push(encodePiece(r));
  return marks.segment + parts.join(marks.segment);
}

/** The whole address: path, then `?query` when the query is not empty. */
export function formatAddress(address: Address): string {
  const q = formatQuery(address.query);
  return formatPath(address) + (q === '' ? '' : marks.query + q);
}

// ---------------------------------------------------------------- parse

interface RawBinding {
  word?: string;
  value: string;
}

/** Splits `Name;a=1;b=2`, `Name;4`, `Name(4)`, `Name_4` (before name resolution). */
function splitSegment(raw: string, problems: Problem[], bareForms: boolean) {
  const [headRaw = '', ...rest] = raw.split(marks.parameter);
  let name = decodePiece(headRaw, problems);
  const bindings: RawBinding[] = [];
  if (bareForms) {
    const open = name.endsWith(readAlsoAs.bareClose) ? name.lastIndexOf(readAlsoAs.bareOpen) : -1;
    const join = /^(.*[^\d_-])_(\d+)$/.exec(name);
    if (open > 0) {
      bindings.push({ value: name.slice(open + 1, -1) });
      name = name.slice(0, open);
    } else if (join) {
      bindings.push({ value: join[2] as string });
      name = join[1] as string;
    }
  }
  for (const part of rest) {
    const eq = part.indexOf(marks.binding);
    if (eq < 0) bindings.push({ value: decodePiece(part, problems) });
    else {
      bindings.push({
        word: decodePiece(part.slice(0, eq), problems),
        value: decodePiece(part.slice(eq + 1), problems),
      });
    }
  }
  return { name, bindings };
}

function readCollection(
  raw: string,
  options: ParseOptions,
  problems: Problem[],
): { segment: Segment; spec?: CollectionSpec } {
  const { name, bindings } = splitSegment(raw, problems, true);
  const catalog = options.catalog;
  if (!catalog) {
    const parameters: Binding[] = [];
    for (const b of bindings) {
      if (b.word === undefined)
        problems.push({
          code: 'bare-value',
          message: `“${b.value}” binds no parameter without a catalog.`,
          at: raw,
        });
      else parameters.push({ word: b.word, value: b.value });
    }
    return { segment: { name, parameters } };
  }
  const spec = findCollection(catalog, name);
  if (!spec) {
    const known = catalog.collections.some((c) => nameKey(c.name) === nameKey(name));
    problems.push({
      code: known ? 'ambiguous-collection' : 'unknown-collection',
      message: `No collection is called “${name}”.`,
      at: raw,
    });
    const parameters = bindings.flatMap((b) =>
      b.word === undefined ? [] : [{ word: b.word, value: b.value }],
    );
    return { segment: { name, parameters } };
  }
  const bound = new Map<string, Binding>();
  const unknown: Binding[] = [];
  for (const b of bindings) {
    const param =
      b.word === undefined ? spec.parameters.find((p) => p.size) : findParameter(spec, b.word);
    if (b.word === undefined && !param) {
      problems.push({
        code: 'no-size-parameter',
        message: `${spec.name} has no size parameter for “${b.value}” to bind.`,
        at: raw,
      });
    } else if (!param) {
      problems.push({
        code: 'unknown-parameter',
        message: `${spec.name} has no parameter “${b.word}”.`,
        at: raw,
      });
      unknown.push({ word: b.word as string, value: b.value });
    } else if (bound.has(param.word)) {
      problems.push({
        code: 'duplicate-parameter',
        message: `${spec.name};${param.word} is bound twice; the first value is kept.`,
        at: raw,
      });
    } else bound.set(param.word, { word: param.word, value: b.value });
  }
  const parameters = spec.parameters.flatMap((p) => {
    const b = bound.get(p.word);
    return b ? [b] : [];
  });
  return { segment: { name: spec.name, parameters: [...parameters, ...unknown] }, spec };
}

function readElement(
  raw: string,
  spec: CollectionSpec | undefined,
  collectionName: string,
  options: ParseOptions,
  problems: Problem[],
): Element {
  const text = decodePiece(raw, problems);
  const sigil = escapeRegExp(marks.rank);
  const sep = escapeRegExp(marks.notation);
  if (text.startsWith(marks.rank)) {
    const m = new RegExp(`^${sigil}(?:([A-Za-z][A-Za-z0-9]*)${sep})?(\\d+)$`).exec(text);
    const rank = m ? Number(m[2]) : 0;
    if (m && rank >= 1 && Number.isSafeInteger(rank)) {
      return m[1] === undefined
        ? { kind: 'rank', rank }
        : { kind: 'rank', order: nameKey(m[1]), rank };
    }
    problems.push({
      code: 'bad-rank',
      message: `“${text}” is not a rank: expected ${marks.rank}7 or ${marks.rank}lex${marks.notation}7, counting from 1.`,
      at: raw,
    });
    return { kind: 'value', value: text };
  }
  const m = new RegExp(`^([A-Za-z][A-Za-z0-9]*)${sep}(.+)$`, 's').exec(text);
  let notation: string | undefined;
  let value = text;
  if (m) {
    notation = nameKey(m[1] as string);
    value = m[2] as string;
  }
  if (options.readElement && (spec || !options.catalog)) {
    const read = options.readElement(collectionName, value);
    if (read === null) {
      problems.push({
        code: 'unreadable-element',
        message: `${collectionName} cannot read “${value}” as one of its elements.`,
        at: raw,
      });
    } else if (read !== undefined) value = read;
  }
  return notation === undefined ? { kind: 'value', value } : { kind: 'value', notation, value };
}

function readStep(raw: string, spec: CollectionSpec | undefined, problems: Problem[]): Step {
  if (/^\d+$/.test(raw)) {
    const index = Number(raw);
    if (index < 1 || !Number.isSafeInteger(index)) {
      problems.push({
        code: 'bad-index',
        message: `An index counts from 1, not “${raw}”.`,
        at: raw,
      });
    }
    return { kind: 'index', index };
  }
  const { name, bindings } = splitSegment(raw, problems, false);
  const parameters: Binding[] = [];
  for (const b of bindings) {
    if (b.word === undefined) {
      problems.push({
        code: 'bare-value',
        message: `A property's parameter is written word=value, not “${b.value}”.`,
        at: raw,
      });
    } else parameters.push({ word: b.word, value: b.value });
  }
  const declared = spec?.properties?.find((p) => nameKey(p) === nameKey(name));
  return { kind: 'property', name: declared ?? name, parameters };
}

function readQuery(query: string): [string, string][] {
  const text = query.startsWith(marks.query) ? query.slice(1) : query;
  if (text === '') return [];
  const out: [string, string][] = [];
  const ignored: Problem[] = [];
  for (const pair of text.split(marks.queryPair)) {
    if (pair === '') continue;
    const eq = pair.indexOf(marks.queryBinding);
    const k = eq < 0 ? pair : pair.slice(0, eq);
    const v = eq < 0 ? '' : pair.slice(eq + 1);
    out.push([
      decodePiece(k.replaceAll('+', ' '), ignored),
      decodePiece(v.replaceAll('+', ' '), ignored),
    ]);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readArea(raw: string): Area | undefined {
  const key = nameKey(raw);
  for (const area of Object.values(areas)) {
    if (key === nameKey(area) || key === nameKey(defaultPlural(area))) return area;
  }
  return undefined;
}

const sequenceNumber = /^a\d{6}$/i;

/**
 * Reads a path and query liberally (§5) into an Address, and says whether the
 * input was already canonical and, if not, what the canonical path is.
 */
export function parseAddress(path: string, query = '', options: ParseOptions = {}): ParseResult {
  const problems: Problem[] = [];
  const segments = path.split(marks.segment).filter((s) => s !== '');
  const address: Address = { area: '', chain: [], query: readQuery(query) };
  const [first, ...after] = segments;
  if (first !== undefined) {
    const area = readArea(decodePiece(first, problems));
    if (!area) {
      problems.push({
        code: 'unknown-area',
        message: `“${decodePiece(first, [])}” is not an area.`,
        at: first,
      });
      address.area = decodePiece(first, []);
      address.rest = after.map((s) => decodePiece(s, []));
    } else {
      address.area = area;
      readBody(area, after, address, options, problems);
    }
  }
  const askedPath = path.startsWith(marks.segment) ? path : marks.segment + path;
  const askedQuery = query.startsWith(marks.query) ? query.slice(1) : query;
  const canonical = askedPath === formatPath(address) && askedQuery === formatQuery(address.query);
  return { address, canonical, canonicalPath: formatAddress(address), problems };
}

function readBody(
  area: Area,
  segments: string[],
  address: Address,
  options: ParseOptions,
  problems: Problem[],
): void {
  let rest = segments;
  if (leafAreas.includes(area)) {
    if (rest.length > 0) {
      problems.push({
        code: 'extra-segment',
        message: `/${area} takes no further segments.`,
        at: rest[0],
      });
      address.rest = rest.map((s) => decodePiece(s, []));
    }
    return;
  }
  if (area === areas.input) {
    if (rest.length === 0)
      problems.push({ code: 'missing-segment', message: 'No expression to evaluate.' });
    else address.expression = rest.map((s) => decodePiece(s, problems)).join(marks.segment);
    return;
  }
  let collectionRaw: string | undefined;
  if (area === areas.collection) {
    [collectionRaw, ...rest] = rest;
  } else {
    const [subjectRaw, ...tail] = rest;
    if (subjectRaw === undefined) {
      problems.push({ code: 'missing-segment', message: `/${area} needs a name.` });
      return;
    }
    let subject = decodePiece(subjectRaw, problems);
    if (area === areas.sequence && sequenceNumber.test(subject)) subject = subject.toUpperCase();
    subject = options.resolveSubject?.(area, subject) ?? subject;
    address.subject = subject;
    if (area === areas.sequence) {
      if (tail.length > 0) {
        problems.push({
          code: 'extra-segment',
          message: '/sequence takes one number.',
          at: tail[0],
        });
        address.rest = tail.map((s) => decodePiece(s, []));
      }
      return;
    }
    [collectionRaw, ...rest] = tail;
  }
  if (collectionRaw === undefined) return;
  const { segment, spec } = readCollection(collectionRaw, options, problems);
  address.collection = segment;
  const [elementRaw, ...chainRaw] = rest;
  if (elementRaw === undefined) return;
  address.element = readElement(elementRaw, spec, segment.name, options, problems);
  address.chain = chainRaw.map((s) => readStep(s, spec, problems));
}
