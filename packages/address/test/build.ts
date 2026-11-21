/**
 * Builders for expected addresses. A test never writes a separator inline: it
 * builds the string from the table of marks, so changing a mark changes every
 * expectation with it.
 */
import { marks } from '../src/table.ts';

/** `/a/b/c` */
export const path = (...segments: string[]): string => marks.segment + segments.join(marks.segment);

/** `Name;word=value;...` */
export const seg = (name: string, ...bindings: [string, string | number][]): string =>
  name + bindings.map(([w, v]) => `${marks.parameter}${w}${marks.binding}${v}`).join('');

/** `Name;4` : a bare value */
export const bare = (name: string, value: string | number): string =>
  `${name}${marks.parameter}${value}`;

export const ordered = (...items: (string | number)[]): string => items.join(marks.ordered);
export const unordered = (...items: (string | number)[]): string => items.join(marks.unordered);
export const blocks = (...items: (string | number)[]): string => items.join(marks.block);
export const rank = (n: number, order?: string): string =>
  marks.rank + (order === undefined ? '' : order + marks.notation) + n;
export const notation = (name: string, value: string): string => name + marks.notation + value;
export const query = (...pairs: [string, string][]): string =>
  marks.query + pairs.map(([k, v]) => k + marks.queryBinding + v).join(marks.queryPair);
