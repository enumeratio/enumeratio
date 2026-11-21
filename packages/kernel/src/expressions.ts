/**
 * The Epsil behind a route row, read by notatio's own parser. The route file keeps its expression
 * cells as text (`packages/routes`); this module reads each one with `parseExpression`, the
 * parameters, `k` and `x` being free symbols, and does with the result what a page needs:
 * put the parameters and an element's value into it, write it back as Epsil, and recognize an
 * answer as an element of a row (the same expression, read the other way). Epsil is the only text
 * syntax read or written here.
 *
 * Pure: no engine, so a page may call it before any kernel has loaded.
 */
import type { Binding } from '@enumeratio/address';
import { type RouteRow, rankVariable, valueVariable } from '@enumeratio/routes/parse';
import { parseExpression, serializeExpression } from '@notatio/formats/expression';
import { type Json, headOf, operandsOf, plain } from './index.ts';

const parsed = new Map<string, Json>();

/**
 * One Epsil cell as plain MathJSON (a symbol is a string, a call an array, a string literal
 * `'…'`). Throws when notatio's parser reports an error: a route file's cell is the repository's own,
 * and a test reads every one.
 */
export function readCell(text: string): Json {
  let found = parsed.get(text);
  if (found === undefined) {
    const result = parseExpression(text);
    if (result.errors.length > 0) {
      throw new Error(`cannot read the Epsil “${text}”: ${result.errors.join('; ')}`);
    }
    found = plain(result.json);
    parsed.set(text, found);
  }
  return found;
}

/** A number written with digit separators (`1_000_000`): Epsil reads it, but a page asks and shows it in plain digits. */
const separated = /(?<![\w'"])\d{1,3}(?:_\d{3})+(?![\w'"])/g;

/**
 * An expression as Epsil. A library name stays as it is declared (`NonNegativeIntegers`), and an
 * integer is written in plain digits.
 */
export const writeCell = (json: Json): string =>
  serializeExpression(json as never, { libraryNames: 'mathjson' }).replaceAll(separated, (n) =>
    n.replaceAll('_', ''),
  );

const isSymbol = (json: Json): json is string => typeof json === 'string' && !json.startsWith("'");

/** Every symbol an expression names, apart from the heads it calls: its variables. */
export function symbolsIn(json: Json, into = new Set<string>()): Set<string> {
  if (isSymbol(json)) into.add(json);
  else for (const operand of operandsOf(json)) symbolsIn(operand, into);
  return into;
}

/** Every head an expression calls. */
export function headsOfJson(json: Json, into = new Set<string>()): Set<string> {
  const head = headOf(json);
  if (head !== undefined) into.add(head);
  for (const operand of operandsOf(json)) headsOfJson(operand, into);
  return into;
}

/** The expression with each variable replaced by the expression bound to it. */
function substitute(json: Json, bound: ReadonlyMap<string, Json>): Json {
  if (isSymbol(json)) return bound.has(json) ? bound.get(json) : json;
  if (!Array.isArray(json)) return json;
  return [json[0], ...operandsOf(json).map((operand) => substitute(operand, bound))];
}

/** A cell with each variable replaced by the text bound to it, written as Epsil. */
function bind(cell: string, texts: ReadonlyMap<string, string>): string {
  const bound = new Map([...texts].map(([word, text]) => [word, readCell(text)] as const));
  return writeCell(substitute(readCell(cell), bound));
}

const wordsOf = (row: RouteRow): Set<string> => new Set((row.parameters ?? []).map((p) => p.word));

/** The parameters an expression names. */
export function parametersIn(row: RouteRow, cell: string): string[] {
  const words = wordsOf(row);
  return [...symbolsIn(readCell(cell))].filter((name) => words.has(name));
}

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
      return { ok: true, epsil: bind(form, have) };
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

/**
 * The Epsil for the k-th member of a row's collection, when the row states one. A row that states
 * its k-th member is the catalogue stating the order: a page uses this and never asks the
 * collection's own `At` or `IndexOf`.
 */
export function kthExpression(row: RouteRow, rank: number): string | undefined {
  return row.kth === undefined ? undefined : bind(row.kth, new Map([[rankVariable, String(rank)]]));
}

/** The head that constructs one element of the row (`DyckPath`, `Finset`), when it is a call. */
export function elementHead(row: RouteRow): string | undefined {
  return row.element === undefined ? undefined : headOf(readCell(row.element));
}

/** The name a row's collection is built with (`PrimeNumbers`, `Permutations`), from its first form. */
export function collectionHead(row: RouteRow): string | undefined {
  const form = row.expressions[0];
  if (form === undefined) return undefined;
  const json = readCell(form);
  return isSymbol(json) ? json : headOf(json);
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
  return { ok: true, epsil: bind(row.element, new Map([...have, [valueVariable, valueEpsil]])) };
}

const integerOf = (json: Json): string | undefined => {
  if (typeof json === 'number' && Number.isInteger(json)) return String(json);
  if (typeof json === 'bigint') return String(json);
  if (json !== null && typeof json === 'object' && 'num' in json) {
    const num = String((json as { num: unknown }).num);
    return /^-?\d+$/.test(num) ? num : undefined;
  }
  return undefined;
};

/** Reads an answer against an expression: the value each variable stands for, or undefined when it is not of this shape. */
function match(
  template: Json,
  json: Json,
  variables: ReadonlySet<string>,
  into = new Map<string, Json>(),
): Map<string, Json> | undefined {
  if (isSymbol(template)) {
    if (variables.has(template)) {
      into.set(template, json);
      return into;
    }
    return json === template ? into : undefined;
  }
  if (!Array.isArray(template)) {
    const wanted = integerOf(template);
    return wanted !== undefined && integerOf(json) === wanted ? into : undefined;
  }
  const parts = operandsOf(template);
  if (!Array.isArray(json) || json[0] !== template[0] || json.length !== parts.length + 1) {
    return undefined;
  }
  for (const [i, part] of parts.entries()) {
    if (!match(part, json[i + 1], variables, into)) return undefined;
  }
  return into;
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
  const found = match(readCell(row.element), json, new Set([valueVariable, ...identity]));
  if (!found || !found.has(valueVariable)) return undefined;
  const parameters: Binding[] = [];
  for (const word of identity) {
    const value = found.get(word);
    if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
    parameters.push({ word, value: String(value) });
  }
  return { value: found.get(valueVariable), parameters };
}

/** Every head a row's expressions and constructor call, and every symbol a collection is named by. */
export function headsIn(row: RouteRow): string[] {
  const heads = new Set<string>();
  for (const form of row.expressions) {
    const json = readCell(form);
    headsOfJson(json, heads);
    // A collection with no parameters is a bare symbol: `PrimeNumbers`.
    if (isSymbol(json)) heads.add(json);
  }
  const cells = [row.element, row.kth, ...row.measures.values()];
  for (const cell of cells) if (cell !== undefined) headsOfJson(readCell(cell), heads);
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
    if (!have.has(word)) out.push({ word, value: bind(measure, value) });
  }
  return out;
}
