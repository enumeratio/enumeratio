/**
 * An Epsil cell of the route file, as the build reads it: its MathJSON, and where in its text each
 * symbol stands. Notatio's parser reads each cell once, at build time (`parse-cells.ts`, Node
 * only); a page works from this record and never loads the parser or the engine behind it.
 *
 * Pure: nothing here imports an engine, so the page's first paint can use it.
 */
import type { RouteRow } from '@enumeratio/routes/parse';
import { type Json, headOf, operandsOf } from './index.ts';

export interface Cell {
  /** Plain MathJSON: a symbol is a string, a call an array, a number a number (or `{ num }` past 2^53). */
  json: Json;
  /** Every symbol in the cell's text, as `[start, end, name]`, in order. */
  slots: [number, number, string][];
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

/** Reads one cell's text: the build's parser, or a table the build made. */
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

/**
 * Is the text one operand as it stands: digits, a name, or a call or list from its first bracket
 * to its last? A value bound into an expression that is not is put in parentheses.
 */
export function isAtomic(text: string): boolean {
  if (/^\d+$/.test(text) || /^[A-Za-z][A-Za-z0-9]*$/.test(text)) return true;
  const open = /^[A-Za-z0-9]*([([])/.exec(text);
  if (!open) return false;
  let depth = 0;
  for (const [i, char] of [...text].entries()) {
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') {
      depth--;
      // The first bracket closes before the end: `f(a) + g(b)` is not one operand.
      if (depth === 0 && i < text.length - 1) return false;
    }
  }
  return depth === 0 && /[)\]]$/.test(text);
}

/**
 * The cell's text with each variable replaced by the Epsil bound to it, and the rest as
 * written: `k - 1` with `k` as `7` is `7 - 1`. A bound value that is not one operand is put in
 * parentheses, so `-3` goes in as `(-3)`.
 */
export function fill(text: string, cell: Cell, bound: ReadonlyMap<string, string>): string {
  let out = '';
  let at = 0;
  for (const [start, end, name] of cell.slots) {
    const value = bound.get(name);
    if (value === undefined) continue;
    out += text.slice(at, start) + (isAtomic(value) ? value : `(${value})`);
    at = end;
  }
  return out + text.slice(at);
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
