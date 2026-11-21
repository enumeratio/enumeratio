/**
 * The Epsil behind a route row, as a page uses it: put the parameters and an element's value into
 * it, and recognize an answer as an element of a row (the same expression, read the other way).
 * Each cell was read once, at build, by notatio's own parser with the row's parameters, `k` and
 * `x` as free symbols (`parse-cells.ts`, through `virtual:route-cells`); this module works from
 * that record and imports neither the parser nor the engine, so a page can use it before any
 * kernel has loaded. Epsil is the only text syntax read or written: a filled cell is the cell's
 * own text with the values in place of the symbols.
 */
import type { Binding } from '@enumeratio/address';
import { type RouteRow, rankVariable, valueVariable } from '@enumeratio/routes/parse';
import cells from 'virtual:route-cells';
import { type Cell, elementHeadOf, fill, headsOfRow, isSymbol, match, symbolsIn } from './cell.ts';
import { type Json, headOf } from './index.ts';

/** One cell, as the build read it. Throws for a text that is not a cell of the route file. */
export function readCell(text: string): Cell {
  const found = cells[text];
  if (found === undefined) throw new Error(`“${text}” is not a cell of the route file`);
  return found;
}

/** `fill`, with the Epsil bound to each name given as text. */
const bind = (text: string, bound: ReadonlyMap<string, string>): string =>
  fill(text, readCell(text), bound);

const wordsOf = (row: RouteRow): Set<string> => new Set((row.parameters ?? []).map((p) => p.word));

/** The parameters an expression names. */
export function parametersIn(row: RouteRow, text: string): string[] {
  const words = wordsOf(row);
  return [...symbolsIn(readCell(text).json)].filter((name) => words.has(name));
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
export const elementHead = (row: RouteRow): string | undefined => elementHeadOf(row, readCell);

/** The name a row's collection is built with (`PrimeNumbers`, `Permutations`), from its first form. */
export function collectionHead(row: RouteRow): string | undefined {
  const form = row.expressions[0];
  if (form === undefined) return undefined;
  const { json } = readCell(form);
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
  const found = match(readCell(row.element).json, json, new Set([valueVariable, ...identity]));
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
export const headsIn = (row: RouteRow): string[] => headsOfRow(row, readCell);

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
