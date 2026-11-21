/**
 * Element codecs: the canonical string of an element in an address, and the
 * value it stands for (site map §2.5 and §5). One codec for each shape of
 * value; a route row says which shape its elements have. Every separator comes
 * from the table of marks.
 *
 * A codec reads spellings and writes the canonical one. It does not decide
 * membership: `2_1_4_4` reads as four items, and the kernel says it is no
 * permutation.
 */
import { dotSegments, marks, readAlsoAs } from '@enumeratio/address';

/** An element's value: an integer as its digits (any size), or a list of values. */
export type Items = string | Items[];

export interface Codec {
  /**
   * Reads a value written in any accepted spelling. `notation` is the name
   * written in front of it, when one was; a codec that does not know the
   * notation refuses. Returns null to refuse.
   */
  read(raw: string, notation?: string): Items | null;
  /** The canonical spelling, or null when the value has none in this shape. */
  write(items: Items): string | null;
}

// ---------------------------------------------------------------- pieces

const integer = /^-?\d+$/;
const digit = /^\d$/;
/** Brackets a list may be written in: `[2,1,4,3]`, `(2,1,4,3)`, `{1,3}`. */
const brackets: readonly (readonly [string, string])[] = [
  ['[', ']'],
  ['(', ')'],
  ['{', '}'],
];
/** Read between blocks besides the block mark. */
const blockAlso = ['|', '/'];
/** Read between the parts of a partition besides the item marks: `4+2+1`. */
const partAlso = ['+'];

const negative = (text: string): string =>
  text.startsWith('-') ? marks.negative + text.slice(1) : text;

/** An integer in its one spelling: no leading zeros, no negative zero. */
function normalInteger(text: string): string | null {
  const plain = text.startsWith(marks.negative) ? `-${text.slice(marks.negative.length)}` : text;
  if (!integer.test(plain)) return null;
  const value = BigInt(plain);
  return String(value);
}

const isInteger = (items: Items): items is string =>
  typeof items === 'string' && integer.test(items);
const isFlat = (items: Items): items is string[] => Array.isArray(items) && items.every(isInteger);

function compare(a: string, b: string): number {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function unwrap(text: string): string | null {
  for (const [open, close] of brackets) {
    if (text.startsWith(open)) {
      return text.endsWith(close) ? text.slice(open.length, text.length - close.length) : null;
    }
  }
  return text;
}

function splitAny(text: string, separators: readonly string[]): string[] {
  let parts = [text];
  for (const sep of separators) parts = parts.flatMap((p) => p.split(sep));
  return parts;
}

/** A flat list of integers written with any of the item separators. */
function readFlat(raw: string, separators: readonly string[]): string[] | null {
  const inner = unwrap(raw.replaceAll(' ', ''));
  if (inner === null) return null;
  if (inner === '') return [];
  const out: string[] = [];
  for (const piece of splitAny(inner, separators)) {
    const n = normalInteger(piece);
    if (n === null) return null;
    out.push(n);
  }
  return out;
}

/** Splits `[[1,3],[2],[4]]` or `{{1,3},{2},{4}}` at the top level, or returns undefined when it is not nested. */
function readNested(text: string): string[] | null | undefined {
  const pair = brackets.find(([open]) => text.startsWith(open));
  if (!pair) return undefined;
  const inner = unwrap(text);
  if (inner === null) return null;
  if (!brackets.some(([open]) => inner.startsWith(open))) return undefined;
  const groups: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i] as string;
    if (brackets.some(([open]) => open === ch)) depth++;
    else if (brackets.some(([, close]) => close === ch)) depth--;
    else if (ch === ',' && depth === 0) {
      groups.push(inner.slice(start, i));
      start = i + 1;
    }
    if (depth < 0) return null;
  }
  if (depth !== 0) return null;
  groups.push(inner.slice(start));
  return groups;
}

const itemSeparators = [marks.ordered, ...readAlsoAs.ordered, marks.unordered];

/** A value is never empty, never a dot segment, and carries no notation mark and no leading sigil. */
function writable(text: string): string | null {
  if (text === '' || dotSegments.includes(text)) return null;
  if (text.includes(marks.notation) || text.startsWith(marks.rank)) return null;
  return text;
}

const defaultOnly =
  (read: (raw: string) => Items | null) =>
  (raw: string, notation?: string): Items | null =>
    notation === undefined ? read(raw) : null;

// ---------------------------------------------------------------- the shapes

/** One integer: `5040`, `-3`. */
const integerCodec: Codec = {
  read: defaultOnly((raw) => normalInteger(raw.replaceAll(' ', ''))),
  write: (items) => (isInteger(items) ? writable(negative(items)) : null),
};

function orderedCodec(shortForm: boolean, also: readonly string[] = []): Codec {
  return {
    read: defaultOnly((raw) => {
      const text = raw.replaceAll(' ', '');
      // The short form: single digits run together, read only where the shape allows it.
      if (shortForm && text.length > 1 && /^\d+$/.test(text)) return [...text];
      return readFlat(text, [...itemSeparators, ...also]);
    }),
    write: (items) =>
      isFlat(items) && items.length > 0 ? writable(items.map(negative).join(marks.ordered)) : null,
  };
}

/** Single digits run together: a word over digits, `11010010`. */
const digitsCodec: Codec = {
  read: defaultOnly((raw) => {
    const text = raw.replaceAll(' ', '');
    if (/^\d+$/.test(text)) return [...text];
    const flat = readFlat(text, itemSeparators);
    return flat !== null && flat.every((d) => digit.test(d)) ? flat : null;
  }),
  write: (items) =>
    isFlat(items) && items.length > 0 && items.every((d) => digit.test(d))
      ? writable(items.join(''))
      : null,
};

/** Members where order does not matter, written ascending: `1,3`. */
const unorderedCodec: Codec = {
  read: defaultOnly((raw) => {
    const flat = readFlat(raw, itemSeparators);
    return flat === null ? null : flat.toSorted(compare);
  }),
  write: (items) =>
    isFlat(items) && items.length > 0
      ? writable(items.toSorted(compare).map(negative).join(marks.unordered))
      : null,
};

function sortBlocks(blocks: string[][]): string[][] {
  return blocks
    .map((b) => b.toSorted(compare))
    .toSorted((a, b) => compare(a[0] as string, b[0] as string));
}

/** Blocks of unordered members, each ascending, the blocks by their least member: `1,3!2!4`. */
const blocksCodec: Codec = {
  read: defaultOnly((raw) => {
    const text = raw.replaceAll(' ', '');
    const nested = readNested(text);
    if (nested === null) return null;
    const pieces = nested ?? splitAny(text, [marks.block, ...blockAlso]);
    const blocks: string[][] = [];
    for (const piece of pieces) {
      const block = readFlat(piece, [marks.unordered, marks.ordered, ...readAlsoAs.ordered]);
      if (block === null || block.length === 0) return null;
      blocks.push(block);
    }
    return blocks.length === 0 ? null : sortBlocks(blocks);
  }),
  write: (items) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    if (!items.every((b): b is string[] => isFlat(b) && b.length > 0)) return null;
    return writable(
      sortBlocks(items)
        .map((b) => b.map(negative).join(marks.unordered))
        .join(marks.block),
    );
  },
};

/** One codec for each shape of value a route row may name. */
export const codecs = {
  integer: integerCodec,
  /** Items in order, single digits also read run together: a permutation `2_1_4_3`, `2143`. */
  ordered: orderedCodec(true),
  /** Items in order where a run of digits is one item: an integer partition `4_2_1`; `421` is one part. */
  parts: orderedCodec(false, partAlso),
  digits: digitsCodec,
  unordered: unorderedCodec,
  blocks: blocksCodec,
} satisfies Record<string, Codec>;

export type Shape = keyof typeof codecs;

// ---------------------------------------------------------------- values and expressions

/** The value as Epsil: an integer, or a list `[a, b]`. */
export function itemsToEpsil(items: Items): string {
  return isInteger(items) ? items : `[${items.map(itemsToEpsil).join(', ')}]`;
}

/** MathJSON's head for a list. */
const listHead = 'List';

/** The value as MathJSON: an integer (a number, or `{ num }` past 2^53), or a `List` of values. */
export function itemsToJson(items: Items): unknown {
  if (isInteger(items)) {
    const n = Number(items);
    return Number.isSafeInteger(n) ? n : { num: items };
  }
  return [listHead, ...items.map(itemsToJson)];
}

/** Reads a value from MathJSON: an integer, or a `List` of values. Undefined for anything else. */
export function itemsFromJson(json: unknown): Items | undefined {
  if (typeof json === 'number') return Number.isInteger(json) ? String(json) : undefined;
  if (typeof json === 'bigint') return String(json);
  if (json !== null && typeof json === 'object' && !Array.isArray(json) && 'num' in json) {
    return normalInteger(String((json as { num: unknown }).num)) ?? undefined;
  }
  if (Array.isArray(json) && json[0] === listHead) {
    const out: Items[] = [];
    for (const part of json.slice(1)) {
      const item = itemsFromJson(part);
      if (item === undefined) return undefined;
      out.push(item);
    }
    return out;
  }
  return undefined;
}
