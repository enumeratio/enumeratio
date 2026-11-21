import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { areas, escapeRegExp, marks, valueExtras, words } from '../src/index.ts';

const siteMap = fileURLToPath(new URL('../../../docs/site-map.md', import.meta.url));

export const siteMapText = readFileSync(siteMap, 'utf8');

/** Every `inline code` span of the document, with the heading it sits under. */
export function codeSpans(text: string): { span: string; section: string }[] {
  const out: { span: string; section: string }[] = [];
  let section = '';
  let fenced = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    if (fenced) continue;
    const heading = /^#{1,4}\s+(\S+)/.exec(line);
    if (heading) section = (heading[1] as string).replace(/\.$/, '');
    for (const m of line.matchAll(/`([^`]+)`/g)) out.push({ span: m[1] as string, section });
  }
  return out;
}

const placeholder = /[…<>]/;
const areaWords = [
  ...Object.values(areas),
  ...Object.values(areas).map((a) => a + words.plural),
  ...Object.values(areas).map((a) => a[0]?.toUpperCase() + a.slice(1)),
];

/** A full address written in the document: `/collection/DyckPath;semilength=4?group_by=k`. */
export function exampleAddresses(): string[] {
  const found = new Set<string>();
  for (const { span } of codeSpans(siteMapText)) {
    if (!span.startsWith(marks.segment) || placeholder.test(span)) continue;
    // `/sequence/` names an area in prose; it is not an address.
    if (span.length > 1 && span.endsWith(marks.segment)) continue;
    const first = span.slice(1).split(marks.segment)[0] ?? '';
    if (areaWords.includes(first) || first === '') found.add(span);
  }
  return [...found];
}

/**
 * A relative collection address written in a table or a list: it begins with a
 * name and carries parameters or a further segment (`Natural/360/Factorization`,
 * `SetPartition;size=4;blocks=2`, `Numeral;base=60`). Templates with an empty
 * value (`QuadraticInteger;d=`) are not examples and are left out.
 */
export function exampleCollectionPaths(): string[] {
  const found = new Set<string>();
  const shape = new RegExp(
    `^[A-Z][A-Za-z]*(?:${escapeRegExp(marks.parameter)}[a-z]+${escapeRegExp(marks.binding)}[^\\s${escapeClass(marks.parameter)}${escapeClass(marks.segment)}]+)*(?:${escapeRegExp(marks.segment)}\\S+)*$`,
  );
  for (const { span } of codeSpans(siteMapText)) {
    if (placeholder.test(span) || span.includes(' ') || span.startsWith(marks.segment)) continue;
    if (!span.includes(marks.parameter) && !span.includes(marks.segment)) continue;
    if (span.includes(marks.parameter + marks.binding) || span.endsWith(marks.binding)) continue;
    if (shape.test(span)) found.add(span);
  }
  return [...found];
}

/** Query strings written in the document: `?group_by=k`, `?show=Area,Bounce,Peaks`. */
export function exampleQueries(): string[] {
  const found = new Set<string>();
  for (const { span } of codeSpans(siteMapText)) {
    if (span.startsWith(marks.query) && !/[…<]/.test(span)) found.add(span);
  }
  return [...found];
}

/** Escapes a table entry for use inside a regular-expression character class. */
function escapeClass(s: string): string {
  return s.replace(/[\]\\^-]/g, '\\$&');
}

/** Elements written in the document's sections on elements (§2.2 and §2.5). */
export function exampleElements(): string[] {
  const found = new Set<string>();
  const chars = [
    marks.rank,
    marks.unordered,
    marks.block,
    marks.decimal,
    marks.negative,
    marks.notation,
    ...valueExtras,
  ];
  const element = new RegExp(`^[\\w${chars.map(escapeClass).join('')}]+$`);
  for (const { span, section } of codeSpans(siteMapText)) {
    if (section !== '2.2' && section !== '2.5') continue;
    if (placeholder.test(span) || !element.test(span)) continue;
    if (!/\d/.test(span)) continue; // words such as `Rational` are names, not elements
    found.add(span);
  }
  return [...found];
}
