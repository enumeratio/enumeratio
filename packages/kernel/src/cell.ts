/**
 * An Epsil cell of the route file, as the build reads it: its MathJSON. Notatio's parser reads each
 * cell once, at build (`parse-cells.ts`, Node only), and writes the result beside the route file's
 * text as build output; a page works from that and never loads the parser or the engine behind it.
 * A page puts a parameter into a cell by replacing the symbol in the MathJSON, never by editing the
 * cell's text, and writes the result as Epsil with `writeEpsil`.
 *
 * Pure: nothing here imports an engine, so the page's first paint can use it.
 */
import type { RouteRow } from '@enumeratio/routes/parse';
import { type Json, headOf, operandsOf } from './index.ts';

export interface Cell {
  /** Plain MathJSON: a symbol is a string, a call an array, a number a number (or `{ num }` past 2^53). */
  json: Json;
}

/** The text of every Epsil cell a row has: its expression forms, k-th member, element and measures. */
export function cellTexts(row: RouteRow): string[] {
  return [
    ...row.expressions,
    ...(row.kth === undefined ? [] : [row.kth]),
    ...(row.element === undefined ? [] : [row.element]),
    ...row.measures.values(),
  ];
}

/** Reads one cell's text: the build's parser, or the table the build made. */
export type ReadCell = (text: string) => Cell;

export const isSymbol = (json: Json): json is string =>
  typeof json === 'string' && !json.startsWith("'");

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
export function substituteJson(json: Json, bound: ReadonlyMap<string, Json>): Json {
  if (isSymbol(json)) return bound.has(json) ? bound.get(json) : json;
  if (!Array.isArray(json)) return json;
  return [json[0], ...operandsOf(json).map((operand) => substituteJson(operand, bound))];
}

/** An integer written in digits, as MathJSON: a number, or `{ num }` where a number cannot hold it. */
export function integerJson(digits: string): Json {
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : { num: digits };
}

/** MathJSON's head for a list. */
export const listHead = 'List';

/**
 * MathJSON as Epsil: a call `Head(a, b)`, a list `[a, b]`, a symbol, an integer in digits. The
 * shapes a route cell has are all there is, and anything else is an error. A test parses what this
 * writes with notatio's parser and gets the same MathJSON back.
 */
export function writeEpsil(json: Json): string {
  if (typeof json === 'number' && Number.isInteger(json)) return String(json);
  if (typeof json === 'string') {
    return json.startsWith("'") ? JSON.stringify(json.slice(1, -1)) : json;
  }
  if (json !== null && typeof json === 'object' && !Array.isArray(json) && 'num' in json) {
    const num = String((json as { num: unknown }).num);
    if (/^-?\d+$/.test(num)) return num;
  }
  if (Array.isArray(json) && typeof json[0] === 'string') {
    const parts = operandsOf(json).map(writeEpsil).join(', ');
    return json[0] === listHead ? `[${parts}]` : `${json[0]}(${parts})`;
  }
  throw new Error(`cannot write as Epsil: ${JSON.stringify(json)}`);
}

/** Reads an integer as the kernel writes it. */
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
export function match(
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

/** Every head a row's expressions and constructor call, and every symbol a collection is named by. */
export function headsOfRow(row: RouteRow, read: ReadCell): string[] {
  const heads = new Set<string>();
  for (const form of row.expressions) {
    const { json } = read(form);
    headsOfJson(json, heads);
    // A collection with no parameters is a bare symbol: `PrimeNumbers`.
    if (isSymbol(json)) heads.add(json);
  }
  for (const cell of [row.element, row.kth, ...row.measures.values()]) {
    if (cell !== undefined) headsOfJson(read(cell).json, heads);
  }
  return [...heads];
}

/** The head that constructs one element of the row (`DyckPath`, `Finset`), when it is a call. */
export function elementHeadOf(row: RouteRow, read: ReadCell): string | undefined {
  return row.element === undefined ? undefined : headOf(read(row.element).json);
}
