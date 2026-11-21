/**
 * The computed pages (site map §7). For an address, `live` says, without a
 * kernel, what the page is made of: a lead that is drawn at once, and sections
 * that each ask the kernel for what they show. Every expression asked is built
 * here from the address, the route row and the table of marks, and is Epsil:
 * the mathematics is the kernel's.
 */
import {
  type Address,
  type Binding,
  type ParseResult,
  type Step,
  areas,
  formatAddress,
  formatSegment,
  formatStep,
  marks,
  notatioReference,
  queryWords,
} from '@enumeratio/address';
import { itemsFromJson, itemsToEpsil } from '@enumeratio/codecs';
import type { Answer, Ask, Json } from '@enumeratio/kernel';
import {
  type RouteRow,
  collectionExpression,
  elementExpression,
  identityParameters,
  isPoint,
  isServed,
  kthExpression,
  measuredBindings,
  readElementJson,
  rowByName,
  rows,
  unrestrictedCollection,
} from '@enumeratio/routes';
import names from 'virtual:notatio-names';
import { Safe, code, h } from './html.ts';
import {
  allMaps,
  allStatistics,
  carrierOf,
  codecOf,
  itemsOf,
  mapsOf,
  statisticsOf,
} from './reading.ts';

export interface Env {
  ask: Ask;
  /** A sentence for a head, from notatio's records. */
  describe: (name: string) => Promise<string | undefined>;
  /**
   * Typesets a sentence's `$…$` islands to HTML (notatio's `renderSummary`, which also escapes the
   * text). Where it is given (Node), a sentence is drawn typeset at once; where it is not (the
   * page), the sentence is drawn as plain text and marked, and the script typesets it when it arrives.
   */
  typeset?: (sentence: string) => string;
}

export interface Section {
  id: string;
  title: string;
  run: (env: Env) => Promise<Safe>;
}

export interface Live {
  title: string;
  /** Drawn at once, before any kernel. */
  lead: Safe;
  sections: Section[];
  /** False for an address that names nothing served. */
  found: boolean;
  /** The object's own address, when this page is a view of it (§2.2). Path only. */
  object?: Address;
  /** Resolves true when the kernel finds the element is not a member of the collection it is addressed in: no canonical form then. */
  nonMember?: (env: Env) => Promise<boolean>;
  /** Where the address moves at once (§3: a statistic's value lives under its element). */
  replaceWith?: Address;
  /** Where the address moves once the kernel has answered (a rank moves to its value). */
  moveTo?: (env: Env) => Promise<Address | undefined>;
}

// ---------------------------------------------------------------- limits

/** How many members a table shows at a time. */
export const windowSize = 20;
/** The sizes a collection's page counts when none is bound. */
export const firstSizes = 10;
/** A table is sorted in the page only up to this many members; past it the kernel is not asked to list everything. */
export const sortLimit = 500;
/** How far a grouped parameter is followed. */
export const groupLimit = 40;

// ---------------------------------------------------------------- small pieces

const link = (address: Address): string => formatAddress(address);
const a = (address: Address, text?: string): Safe =>
  h`<a href="${link(address)}">${text === undefined ? code(link(address)) : text}</a>`;

export const collectionAddress = (
  name: string,
  parameters: readonly Binding[] = [],
  element?: string,
  chain: Step[] = [],
  query: [string, string][] = [],
): Address => ({
  area: areas.collection,
  collection: { name, parameters: [...parameters] },
  ...(element === undefined ? {} : { element: { kind: 'value', value: element } as const }),
  chain,
  query,
});

const subjectAddress = (area: string, subject: string, rest: Partial<Address> = {}): Address => ({
  area,
  subject,
  chain: [],
  query: [],
  ...rest,
});

const property = (name: string, parameters: Binding[] = []): Step => ({
  kind: 'property',
  name,
  parameters,
});

const queryValue = (address: Address, word: string): string | undefined =>
  address.query.find(([key]) => key === word)?.[1];

const queryList = (address: Address, word: string): string[] | undefined => {
  const value = queryValue(address, word);
  return value === undefined
    ? undefined
    : value
        .split(marks.queryList)
        .map((s) => s.trim())
        .filter((s) => s !== '');
};

const notComputed = (reason?: string): Safe =>
  h`<span class="declined" title="${reason ?? ''}">not computed</span>`;

const isInteger = (json: Json): boolean =>
  (typeof json === 'number' && Number.isInteger(json)) ||
  (json !== null && typeof json === 'object' && !Array.isArray(json) && 'num' in json);

/** An answer's value as text: an integer as its digits, anything else as the kernel writes it in Epsil. */
export function textOf(answer: Answer): string | undefined {
  if (answer.status !== 'value') return undefined;
  if (typeof answer.json === 'number' && Number.isInteger(answer.json)) return String(answer.json);
  return answer.epsil ?? JSON.stringify(answer.json);
}

/** The address of an answer that is an element of a served collection. */
export function addressOfJson(json: Json): Address | undefined {
  if (isInteger(json)) return undefined; // a number is a value here, not a place to go
  for (const row of rows) {
    if (!isServed(row) || row.kind !== 'collection' || row.element?.kind !== 'call') continue;
    const read = readElementJson(row, json);
    if (!read) continue;
    const items = itemsFromJson(read.value);
    const written = items === undefined ? null : (codecOf(row)?.write(items) ?? null);
    if (written === null) return undefined;
    return collectionAddress(row.name, read.parameters, written);
  }
  return undefined;
}

/**
 * The address of an answer inside the collection it was listed in. An integer is a value, not a
 * place to go (see above), but in a collection whose elements are integers it is the element.
 */
function addressWithin(row: RouteRow, bound: readonly Binding[], json: Json): Address | undefined {
  const own = addressOfJson(json);
  if (own) return { ...own, collection: { name: row.name, parameters: sorted(row, bound) } };
  return row.value === 'integer' && isInteger(json)
    ? collectionAddress(
        row.name,
        sorted(row, bound),
        typeof json === 'number' ? String(json) : String((json as { num: unknown }).num),
      )
    : undefined;
}

/** A value on the page: the text, linked to its own address when it is a catalogued element. A decline says so. */
export function shown(answer: Answer): Safe {
  const text = textOf(answer);
  if (text === undefined) return notComputed(answer.reason);
  const own = addressOfJson(answer.json);
  return own ? h`${a(own)} <span class="note">${code(text)}</span>` : code(text);
}

const epsilOf = (text: string): Safe => h`<code class="epsil">${text}</code>`;

const safeName = /^[A-Za-z][A-Za-z0-9]*$/;

// ---------------------------------------------------------------- expressions

/** The Epsil a step applies to what the chain has reached, or why it cannot be written. */
export function stepExpression(
  operand: string,
  step: Step,
): { ok: true; epsil: string } | { ok: false; reason: string } {
  if (step.kind === 'index') return { ok: true, epsil: `At(${operand}, ${step.index})` };
  if (!safeName.test(step.name)) return { ok: false, reason: `“${step.name}” is not a name.` };
  const declared = names.parameters[step.name] ?? [];
  const args: string[] = [];
  const given = new Map(step.parameters.map((p) => [p.word, p.value]));
  for (const word of given.keys()) {
    if (!declared.includes(word)) {
      return { ok: false, reason: `${step.name} has no parameter “${word}”.` };
    }
  }
  let last = -1;
  declared.forEach((word, i) => {
    if (given.has(word)) last = i;
  });
  for (const word of declared.slice(0, last + 1)) {
    const value = given.get(word);
    if (value === undefined) {
      return { ok: false, reason: `${step.name} needs “${word}” before the parameters after it.` };
    }
    if (!isPoint(value)) return { ok: false, reason: `“${value}” is not a point value.` };
    args.push(value);
  }
  return { ok: true, epsil: `${step.name}(${[operand, ...args].join(', ')})` };
}

/** The whole chain as one expression, read left to right: `At(Blocks(x), 2)`. */
export function chainExpression(element: string, chain: readonly Step[]): string | undefined {
  let epsil = element;
  for (const step of chain) {
    const next = stepExpression(epsil, step);
    if (!next.ok) return undefined;
    epsil = next.epsil;
  }
  return epsil;
}

/** notatio's own way to apply a recorded statistic or map by name. */
function byName(operand: string, step: Step): string | undefined {
  if (step.kind !== 'property' || step.parameters.length > 0) return undefined;
  if (allStatistics.includes(step.name)) return `CombinatorialStat(${operand}, "${step.name}")`;
  if (allMaps.includes(step.name)) return `CombinatorialMap(${operand}, "${step.name}")`;
  return undefined;
}

/**
 * Applies one step to a value. A property's name means the catalogue's statistic or map of that
 * name on the carrier: that is asked first, and the bare head only when the catalogue records
 * none (`FactorInteger`, `IntegerDigits`). The answer carries the expression that was asked.
 */
export async function applyStep(env: Env, operand: string, step: Step): Promise<Answer> {
  const named = byName(operand, step);
  if (named === undefined) {
    const direct = stepExpression(operand, step);
    if (!direct.ok) return { asked: formatStep(step), status: 'declined', reason: direct.reason };
    return env.ask(direct.epsil);
  }
  return env.ask(named);
}

interface Placed {
  row: RouteRow;
  /** The parameters bound in the address. */
  bound: Binding[];
  /** The collection as addressed, in Epsil, when its parameters determine one. */
  collection?: string;
  /** Why there is no expression for the collection. */
  missing: string[];
}

function place(row: RouteRow, bound: readonly Binding[]): Placed {
  const bad = bound.find((b) => !isPoint(b.value));
  if (bad) return { row, bound: [...bound], missing: [bad.word] };
  const expressed = collectionExpression(row, bound);
  return expressed.ok
    ? { row, bound: [...bound], collection: expressed.epsil, missing: [] }
    : { row, bound: [...bound], missing: expressed.missing };
}

interface ElementPlan {
  /** The element in Epsil. */
  epsil: string;
  /** The collection the element is tested against: what the address binds, and what the element itself determines. */
  home?: string;
  /** The object's own address: its unrestricted collection, with only what it cannot be written without. */
  object: Address;
}

function planElement(placed: Placed, address: Address): ElementPlan | { missing: string[] } {
  const { row, bound } = placed;
  const items = itemsOf(row, address);
  if (items === undefined) return { missing: [] };
  const valueEpsil = itemsToEpsil(items);
  const expressed = elementExpression(row, bound, valueEpsil);
  if (!expressed.ok) return { missing: expressed.missing };
  const full = measuredBindings(row, bound, valueEpsil);
  const home = collectionExpression(row, full);
  const identity = identityParameters(row);
  const value = address.element?.kind === 'value' ? address.element.value : '';
  return {
    epsil: expressed.epsil,
    ...(home.ok ? { home: home.epsil } : {}),
    object: {
      ...collectionAddress(
        unrestrictedCollection(row.name),
        bound.filter((b) => identity.includes(b.word)),
        value,
        address.chain,
      ),
    },
  };
}

// ---------------------------------------------------------------- sections: a collection

const sizeParameter = (row: RouteRow) => row.parameters?.find((p) => p.size);

function countsSection(row: RouteRow, bound: readonly Binding[]): Section | undefined {
  const size = sizeParameter(row);
  if (!size || bound.some((b) => b.word === size.word)) return undefined;
  const at = (n: number): Binding[] => [...bound, { word: size.word, value: String(n) }];
  if (!collectionExpression(row, at(0)).ok) return undefined;
  return {
    id: 'counts',
    title: 'Counts',
    run: async ({ ask }) => {
      const cells: Safe[] = [];
      for (let n = 0; n < firstSizes; n++) {
        const expressed = collectionExpression(row, at(n));
        if (!expressed.ok) continue;
        const answer = await ask(`Count(${expressed.epsil})`);
        cells.push(
          h`<tr><td>${a(collectionAddress(row.name, sorted(row, at(n))), String(n))}</td><td>${shown(answer)}</td></tr>`,
        );
      }
      return h`<table><thead><tr><th>${code(size.word)}</th><th>members</th></tr></thead><tbody>${cells}</tbody></table>
      ${row.oeis ? h`<p class="note">OEIS <a href="https://oeis.org/${row.oeis}">${row.oeis}</a>.</p>` : ''}`;
    },
  };
}

/** Bindings in the row's declared order. */
function sorted(row: RouteRow, bound: readonly Binding[]): Binding[] {
  const order = (row.parameters ?? []).map((p) => p.word);
  return [...bound].sort((x, y) => order.indexOf(x.word) - order.indexOf(y.word));
}

const countOf = (answer: Answer): number | undefined =>
  answer.status === 'value' && typeof answer.json === 'number' && Number.isInteger(answer.json)
    ? answer.json
    : undefined;

/**
 * The member at a rank (from 1) in the collection's default order: the collection's own `At`,
 * and where that declines, the row's k-th member (a set is not indexed by the engine; the
 * order is the route file's statement). The answer carries the expression that was asked.
 */
async function elementAt(
  env: Env,
  row: RouteRow,
  collection: string,
  rank: number,
): Promise<Answer> {
  const own = await env.ask(`At(${collection}, ${rank})`);
  if (own.status === 'value' || rank < 1) return own;
  const kth = kthExpression(row, rank);
  return kth === undefined ? own : env.ask(kth);
}

/** How many times the rank search doubles before it gives up: members up to 2^40. */
const rankSearchLimit = 40;

/**
 * The rank of an element: the collection's own `IndexOf`, and where that declines and the row
 * has a k-th member, a search over it. The members increase (a test holds each row to it), so
 * the rank is found by doubling and then halving. Undefined when it is not a member.
 */
async function rankOf(
  env: Env,
  row: RouteRow,
  collection: string,
  element: string,
): Promise<{ rank: number | undefined; asked: Answer }> {
  const asked = await env.ask(`IndexOf(${collection}, ${element})`);
  const direct = countOf(asked);
  if (direct !== undefined || row.kth === undefined) return { rank: direct, asked };
  const target = countOf(await env.ask(element));
  if (target === undefined) return { rank: undefined, asked };
  const at = async (k: number): Promise<number | undefined> =>
    countOf(await elementAt(env, row, collection, k));
  let high = 1;
  let found = await at(high);
  for (let i = 0; i < rankSearchLimit && found !== undefined && found < target; i++) {
    high *= 2;
    found = await at(high);
  }
  if (found === undefined || found < target) return { rank: undefined, asked };
  let low = Math.floor(high / 2) + 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const value = await at(middle);
    if (value === undefined) return { rank: undefined, asked };
    if (value < target) low = middle + 1;
    else high = middle;
  }
  return (await at(low)) === target ? { rank: low, asked } : { rank: undefined, asked };
}

function membersSection(placed: Placed, address: Address): Section | undefined {
  const { row, collection } = placed;
  if (collection === undefined) return undefined;
  const columns = (queryList(address, queryWords.show) ?? row.show).filter((c) => safeName.test(c));
  const orderBy = queryValue(address, queryWords.orderBy);
  const from = Math.max(1, Number(queryValue(address, queryWords.from) ?? '1') || 1);
  return {
    id: 'members',
    title: 'Members',
    run: async (env) => {
      const count = await env.ask(`Count(${collection})`);
      const total = countOf(count);
      const head = h`<p>${epsilOf(`Count(${collection})`)} is ${shown(count)}.</p>`;
      const row$ = async (rank: number): Promise<{ element: Answer; cells: Answer[] }> => {
        const element = await elementAt(env, row, collection, rank);
        const cells: Answer[] = [];
        for (const name of columns) {
          cells.push(
            element.status === 'value' && element.epsil !== undefined
              ? await applyStep(env, element.epsil, property(name))
              : { asked: name, status: 'declined', reason: 'There is no element to apply it to.' },
          );
        }
        return { element, cells };
      };
      let ranks: number[];
      let note: Safe = h``;
      let listed: { rank: number; element: Answer; cells: Answer[] }[] = [];
      if (orderBy !== undefined && columns.includes(orderBy)) {
        if (total === undefined || total > sortLimit) {
          return h`${head}<p class="notice">Ordering by ${code(orderBy)} needs every member, and this collection is not listed whole (the limit is ${sortLimit}). ${notComputed()}</p>`;
        }
        ranks = Array.from({ length: total }, (_, i) => i + 1);
        for (const rank of ranks) listed.push({ rank, ...(await row$(rank)) });
        const key = (r: (typeof listed)[number]): number => {
          const v = r.cells[columns.indexOf(orderBy)]?.json;
          return typeof v === 'number' ? v : Number.POSITIVE_INFINITY;
        };
        listed.sort((x, y) => key(x) - key(y) || x.rank - y.rank);
        note = h`<p class="note">Ordered by ${code(orderBy)}.</p>`;
      } else {
        const last =
          total === undefined ? from + windowSize - 1 : Math.min(total, from + windowSize - 1);
        ranks = [];
        for (let r = from; r <= last; r++) ranks.push(r);
        for (const rank of ranks) {
          listed.push({ rank, ...(await row$(rank)) });
          // A collection the kernel cannot index declines its first member: ask no further.
          if (rank === from && listed[0]?.element.status !== 'value') break;
        }
        // A collection the kernel cannot index answers nothing: say so, once.
        if (listed.length > 0 && listed.every((r) => r.element.status !== 'value')) {
          return h`${head}<p class="notice">The members are ${notComputed(listed[0]?.element.reason)}.</p>`;
        }
        const window = (start: number, text: string): Safe =>
          a({ ...address, query: withQuery(address, queryWords.from, String(start)) }, text);
        const more = total === undefined || last < total;
        note = h`<p class="note">Members ${from} to ${last}${total === undefined ? '' : ` of ${total}`}, in the collection’s own order. ${from > 1 ? window(Math.max(1, from - windowSize), 'Earlier') : ''} ${more ? window(last + 1, 'Later') : ''}</p>`;
      }
      const body = listed.map(({ rank, element, cells }) => {
        const here =
          element.status === 'value' ? addressWithin(row, placed.bound, element.json) : undefined;
        return h`<tr><td>${rank}</td><td>${here ? a(here, textOf(element)) : shown(element)}</td>${cells.map((c) => h`<td>${shown(c)}</td>`)}</tr>`;
      });
      return h`${head}${note}<table><thead><tr><th>rank</th><th>member</th>${columns.map(
        (c) =>
          h`<th>${a({ ...address, query: withQuery(address, queryWords.orderBy, c) }, c)}</th>`,
      )}</tr></thead><tbody>${body}</tbody></table>`;
    },
  };
}

function withQuery(address: Address, word: string, value: string): [string, string][] {
  return [...address.query.filter(([key]) => key !== word), [word, value]];
}

function groupSection(placed: Placed, address: Address): Section | undefined {
  const by = queryValue(address, queryWords.groupBy);
  if (by === undefined) return undefined;
  const { row, bound, collection } = placed;
  const parameter = row.parameters?.find((p) => p.word === by);
  if (parameter && !bound.some((b) => b.word === by)) {
    return {
      id: 'groups',
      title: `Grouped by ${by}`,
      run: async ({ ask }) => {
        const cells: Safe[] = [];
        let seen = false;
        for (let value = 0; value <= groupLimit; value++) {
          const at = sorted(row, [...bound, { word: by, value: String(value) }]);
          const expressed = collectionExpression(row, at);
          if (!expressed.ok) {
            return h`<p class="notice">Grouping by ${code(by)} also needs ${expressed.missing.map((m) => code(m))} bound. ${notComputed()}</p>`;
          }
          const answer = await ask(`Count(${expressed.epsil})`);
          const n = countOf(answer);
          if (n === 0 && seen) break;
          if (n !== 0) seen = seen || n !== undefined;
          cells.push(
            h`<tr><td>${a(collectionAddress(row.name, at), String(value))}</td><td>${shown(answer)}</td></tr>`,
          );
          if (answer.status !== 'value') break;
        }
        return h`<table class="groups"><thead><tr><th>${code(by)}</th><th>members</th></tr></thead><tbody>${cells}</tbody></table>`;
      },
    };
  }
  if (collection !== undefined && safeName.test(by)) {
    return distributionSection(collection, by, `Grouped by ${by}`);
  }
  return {
    id: 'groups',
    title: `Grouped by ${by}`,
    run: async () =>
      h`<p class="notice">${code(by)} is neither an unbound parameter nor a statistic of a bound collection. ${notComputed()}</p>`,
  };
}

/** The distribution of a statistic over a collection: `Tally(CombinatorialStat(collection, "Name"))`. */
function distributionSection(collection: string, statistic: string, title: string): Section {
  const epsil = `Tally(CombinatorialStat(${collection}, "${statistic}"))`;
  return {
    id: 'groups',
    title,
    run: async ({ ask }) => {
      const answer = await ask(epsil);
      const parts = Array.isArray(answer.json) ? answer.json : [];
      const values = itemsFromJson(parts[1]);
      const counts = itemsFromJson(parts[2]);
      if (answer.status !== 'value' || !Array.isArray(values) || !Array.isArray(counts)) {
        return h`<p>${epsilOf(epsil)} is ${notComputed(answer.reason)}.</p>`;
      }
      const pairs = values
        .map((v, i) => [String(v), String(counts[i])] as const)
        .sort((x, y) => Number(x[0]) - Number(y[0]));
      return h`<p>${epsilOf(epsil)}</p><table class="groups"><thead><tr><th>${code(statistic)}</th><th>members</th></tr></thead><tbody>${pairs.map(
        ([v, n]) => h`<tr><td>${v}</td><td>${n}</td></tr>`,
      )}</tbody></table>`;
    },
  };
}

function namesList(area: string, list: readonly string[]): Safe {
  return h`${list.map((n, i) => h`${i > 0 ? ', ' : ''}${a(subjectAddress(area, n), n)}`)}`;
}

function propertiesLead(row: RouteRow): Safe {
  const statistics = statisticsOf(row);
  const maps = mapsOf(row);
  if (statistics.length === 0 && maps.length === 0) {
    return h`<p class="note">notatio records no statistics or maps for this collection’s elements.</p>`;
  }
  return h`<details><summary>${statistics.length} statistics</summary><p>${namesList(areas.stat, statistics)}</p></details>
  <details><summary>${maps.length} maps</summary><p>${namesList(areas.map, maps)}</p></details>`;
}

function relativesLead(row: RouteRow): Safe {
  const inside = row.within ? rowByName.get(row.within) : undefined;
  const subs = rows.filter((r) => r.within === row.name);
  const name = (r: RouteRow): Safe =>
    isServed(r)
      ? a(collectionAddress(r.name), r.name)
      : h`${r.name} <span class="note">(${r.status})</span>`;
  return h`${inside ? h`<p>Sits inside ${name(inside)}.</p>` : ''}${
    subs.length > 0
      ? h`<p>Sub-collections: ${subs.map((r, i) => h`${i > 0 ? ', ' : ''}${name(r)}`)}.</p>`
      : ''
  }`;
}

function pickerLead(row: RouteRow, bound: readonly Binding[]): Safe {
  const parameters = row.parameters ?? [];
  if (parameters.length === 0) return h`<p class="note">No parameters.</p>`;
  const size = sizeParameter(row);
  const have = new Map(bound.map((b) => [b.word, b.value]));
  const unbound = parameters.filter((p) => !have.has(p.word));
  const unboundLine =
    unbound.length === 0
      ? ''
      : h`<p class="note">${unbound.map((p, i) => h`${i > 0 ? ', ' : ''}${code(p.word)}`)} ${unbound.length > 1 ? 'are' : 'is'} unbound, so every value of ${unbound.length > 1 ? 'them' : 'it'} is included: set ${unbound.length > 1 ? 'them' : 'it'} below.</p>`;
  return h`${unboundLine}<form class="picker" data-picker="${row.name}">
    ${parameters.map(
      (p) =>
        h`<label>${code(p.word)} <input name="${p.word}" inputmode="numeric" pattern="-?[0-9]*" size="4" value="${have.get(p.word) ?? ''}"></label> `,
    )}
    <button>Go</button>
  </form>
  ${
    size
      ? h`<p class="note">${code(size.word)}: ${Array.from({ length: 8 }, (_, i) => i + 1).map(
          (n) =>
            h`${a(collectionAddress(row.name, sorted(row, [...bound.filter((b) => b.word !== size.word), { word: size.word, value: String(n) }])), String(n))} `,
        )}</p>`
      : ''
  }`;
}

/** Where a picker's form leads: the collection with the filled-in parameters bound. */
export function pickerTarget(
  name: string,
  values: ReadonlyMap<string, string>,
): string | undefined {
  const row = rowByName.get(name);
  if (!row) return undefined;
  const bound = (row.parameters ?? []).flatMap((p) => {
    const value = values.get(p.word)?.trim() ?? '';
    return isPoint(value) ? [{ word: p.word, value }] : [];
  });
  return link(collectionAddress(row.name, bound));
}

/** The attribute that marks a sentence the page typesets once the mathematics chunk has loaded. */
export const summaryAttribute = 'data-summary';

/** A notatio record's sentence as a paragraph: typeset when `env` can, else plain text, marked when it has mathematics. */
function sentenceParagraph(env: Env, sentence: string): Safe {
  if (env.typeset) return new Safe(`<p>${env.typeset(sentence)}</p>`);
  return sentence.includes('$')
    ? h`<p ${new Safe(summaryAttribute)}>${sentence}</p>`
    : h`<p>${sentence}</p>`;
}

function definitionSection(row: RouteRow): Section {
  return {
    id: 'definition',
    title: 'Definition',
    run: async (env) => {
      const head = row.expressions[0];
      const name =
        head?.kind === 'call' ? head.head : head?.kind === 'name' ? head.name : undefined;
      const sentence = name === undefined ? undefined : await env.describe(name);
      return h`${sentence ? sentenceParagraph(env, sentence) : h`<p class="note">notatio records no sentence for this collection.</p>`}
      <p>In Epsil: ${epsilOf(row.expression ?? '')}; one element is ${row.element ? epsilOf(templateText(row)) : notComputed()}.</p>`;
    },
  };
}

const templateText = (row: RouteRow): string => elementExpressionText(row) ?? '';

function elementExpressionText(row: RouteRow): string | undefined {
  const all = (row.parameters ?? []).map((p) => ({ word: p.word, value: p.word }));
  const expressed = elementExpression(row, all, 'x');
  return expressed.ok ? expressed.epsil : undefined;
}

function collectionPage(row: RouteRow, address: Address): Live {
  const bound = address.collection?.parameters ?? [];
  const placed = place(row, bound);
  const sections: Section[] = [definitionSection(row)];
  const counts = countsSection(row, bound);
  if (counts) sections.push(counts);
  const groups = groupSection(placed, address);
  if (groups) sections.push(groups);
  const members = membersSection(placed, address);
  if (members) sections.push(members);
  const where = queryValue(address, queryWords.where);
  const lead = h`
    ${relativesLead(row)}
    <h2>Parameters</h2>
    ${pickerLead(row, bound)}
    ${
      placed.collection === undefined && bound.length > 0
        ? h`<p class="notice">These parameters alone do not determine a collection the kernel can list${placed.missing.length > 0 ? h`: bind ${placed.missing.map((m, i) => h`${i > 0 ? ', ' : ''}${code(m)}`)} too` : ''}.</p>`
        : ''
    }
    ${where === undefined ? '' : h`<p class="notice">${code(queryWords.where)} is read and not yet applied in the first pass.</p>`}
    ${row.oeis ? h`<p>OEIS <a href="https://oeis.org/${row.oeis}">${row.oeis}</a>.</p>` : ''}
    <h2>Statistics and maps</h2>
    ${propertiesLead(row)}`;
  return {
    title: formatSegment({ name: row.name, parameters: [...bound] }),
    lead,
    sections,
    found: true,
  };
}

// ---------------------------------------------------------------- sections: an element, a chain

/** Asks once whether the element belongs to the collection it is addressed in; every section of the page shares the answer. */
type Membership = (env: Env) => Promise<{ epsil: string; answer: Answer } | undefined>;

function membershipOf(placed: Placed, plan: ElementPlan): Membership {
  const home = plan.home ?? placed.collection;
  let asked: Promise<{ epsil: string; answer: Answer }> | undefined;
  return async (env) => {
    if (home === undefined) return undefined;
    const epsil = `Element(${plan.epsil}, ${home})`;
    asked ??= env.ask(epsil).then((answer) => ({ epsil, answer }));
    return asked;
  };
}

const refused = (member: Awaited<ReturnType<Membership>>): boolean =>
  member?.answer.status === 'value' && member.answer.json === 'False';

function membershipSection(
  placed: Placed,
  plan: ElementPlan,
  viewed: boolean,
  membership: Membership,
): Section {
  const { row, collection } = placed;
  return {
    id: 'membership',
    title: 'Where it sits',
    run: async (env) => {
      const parts: Safe[] = [];
      const found = await membership(env);
      if (found === undefined) {
        parts.push(h`<p>Membership is ${notComputed('No collection to test it against.')}.</p>`);
      } else {
        const { epsil, answer: member } = found;
        const verdict =
          member.status !== 'value'
            ? h`${notComputed(member.reason)}: the kernel does not decide it`
            : member.json === 'True'
              ? h`<strong>true</strong>`
              : h`<strong>false</strong>: this is not an element of ${code(formatSegment({ name: row.name, parameters: placed.bound }))}`;
        parts.push(h`<p>${epsilOf(epsil)} is ${verdict}.</p>`);
      }
      if (viewed) {
        parts.push(
          h`<p>This is a view of an element of the unrestricted collection: the object’s own address is ${a(plan.object)}.</p>`,
        );
      }
      if (
        collection !== undefined &&
        (placed.bound.length > 0 || row.kth !== undefined) &&
        !refused(found)
      ) {
        const { rank: n, asked: rank } = await rankOf(env, row, collection, plan.epsil);
        if (n === undefined || n < 1) {
          parts.push(h`<p>Its rank in ${epsilOf(collection)} is ${notComputed(rank.reason)}.</p>`);
        } else {
          const neighbour = async (at: number): Promise<Safe> => {
            if (at < 1) return h`<span class="none">none (it is the first)</span>`;
            const answer = await elementAt(env, row, collection, at);
            if (answer.status !== 'value') return h`<span class="none">none</span>`;
            const own = addressWithin(row, placed.bound, answer.json);
            return own ? a(own) : shown(answer);
          };
          parts.push(
            h`<p>Rank ${n} in ${epsilOf(collection)} (${a({ ...collectionAddress(row.name, placed.bound), element: { kind: 'rank', rank: n } })}). Before it: ${await neighbour(n - 1)}. After it: ${await neighbour(n + 1)}.</p>`,
          );
        }
      }
      return h`${parts}`;
    },
  };
}

const notAnElement = (row: RouteRow, bound: readonly Binding[]): Safe =>
  h`<p class="notice">This is not an element of ${code(formatSegment({ name: row.name, parameters: [...bound] }))}, so nothing is computed on it here.</p>`;

function propertiesSection(
  row: RouteRow,
  plan: ElementPlan,
  address: Address,
  membership: Membership,
): Section {
  const asked = queryList(address, queryWords.show);
  const everything = asked?.length === 1 && asked[0] === showAll;
  const list = (
    everything
      ? [...new Set([...row.show, ...statisticsOf(row), ...mapsOf(row)])]
      : (asked ?? row.show)
  ).filter((n) => safeName.test(n));
  return {
    id: 'properties',
    title: 'Properties',
    run: async (env) => {
      if (refused(await membership(env))) {
        return notAnElement(row, address.collection?.parameters ?? []);
      }
      if (list.length === 0)
        return h`<p class="note">This collection’s row names no properties to lead with.</p>`;
      const lines: Safe[] = [];
      for (const name of list) {
        const step = property(name);
        const answer = await applyStep(env, plan.epsil, step);
        const own = { ...address, chain: [step], query: [] };
        lines.push(
          h`<tr id="${name}"><td>${a(own, name)}</td><td>${shown(answer)}</td><td>${epsilOf(answer.asked)}</td></tr>`,
        );
      }
      return h`<table><thead><tr><th>property</th><th>value</th><th>Epsil</th></tr></thead><tbody>${lines}</tbody></table>`;
    },
  };
}

/** `?show=all`: every statistic and map notatio records for the element. */
export const showAll = 'all';

function elementLead(row: RouteRow, plan: ElementPlan, address: Address): Safe {
  const statistics = statisticsOf(row);
  const maps = mapsOf(row);
  const under = (name: string): Safe => a({ ...address, chain: [property(name)], query: [] }, name);
  return h`<p>In Epsil: ${epsilOf(plan.epsil)}</p>
  ${
    statistics.length + maps.length === 0
      ? ''
      : h`<details><summary>${statistics.length} statistics, ${maps.length} maps</summary>
    <p>${a({ ...address, query: [[queryWords.show, showAll]] }, 'Compute them all')}, or one at a time:</p>
    <p>${[...statistics, ...maps].map((n, i) => h`${i > 0 ? ', ' : ''}${under(n)}`)}</p></details>`
  }`;
}

function figureSection(plan: ElementPlan): Section {
  return {
    id: 'element',
    title: 'The element',
    run: async ({ ask }) => {
      const answer = await ask(plan.epsil, { holds: true });
      return h`<p>${answer.status === 'value' ? h`<span class="figure" data-figure="${JSON.stringify(answer.json)}"></span>${code(textOf(answer) ?? '')}` : notComputed(answer.reason)}</p>`;
    },
  };
}

function chainSection(
  row: RouteRow,
  plan: ElementPlan,
  address: Address,
  membership: Membership,
): Section {
  return {
    id: 'value',
    title: 'Value',
    run: async (env) => {
      if (refused(await membership(env))) {
        return notAnElement(row, address.collection?.parameters ?? []);
      }
      const lines: Safe[] = [];
      let operand: string | undefined = plan.epsil;
      let last: Answer | undefined;
      for (const [i, step] of address.chain.entries()) {
        const answer: Answer =
          operand === undefined
            ? {
                asked: formatStep(step),
                status: 'declined',
                reason: 'The step before it has no value.',
              }
            : await applyStep(env, operand, step);
        const here = { ...address, chain: address.chain.slice(0, i + 1), query: [] };
        lines.push(
          h`<tr><td>${a(here, formatStep(step))}</td><td>${shown(answer)}</td><td>${epsilOf(answer.asked)}</td></tr>`,
        );
        operand = answer.status === 'value' ? answer.epsil : undefined;
        last = answer;
      }
      const own = last?.status === 'value' ? addressOfJson(last.json) : undefined;
      return h`<p class="value">${last ? shown(last) : notComputed()}</p>
      ${own ? h`<p>The result is an object with its own address, ${a(own)}; the chain continues through it.</p>` : ''}
      <table><thead><tr><th>step</th><th>value</th><th>Epsil</th></tr></thead><tbody>${lines}</tbody></table>`;
    },
  };
}

function elementPage(row: RouteRow, address: Address): Live {
  const bound = address.collection?.parameters ?? [];
  const placed = place(row, bound);
  const el = address.element;
  const title = link({ ...address, query: [] });
  if (el?.kind === 'rank') {
    const collection = placed.collection;
    const named = el.order !== undefined;
    return {
      title,
      found: true,
      lead:
        collection === undefined || named
          ? h`<p class="notice">${named ? h`notatio offers each collection in one order; the order ${code(el.order ?? '')} is ${notComputed()}.` : h`A rank needs a collection the kernel can list: bind its parameters. ${notComputed()}`}</p>`
          : h`<p>The element at rank ${el.rank} of ${epsilOf(collection)}. A rank address moves to the value’s address.</p>`,
      sections: [],
      ...(collection === undefined || named
        ? {}
        : {
            moveTo: async (env: Env) => {
              const answer = await elementAt(env, row, collection, el.rank);
              const own =
                answer.status === 'value' ? addressWithin(row, bound, answer.json) : undefined;
              return own
                ? {
                    ...own,
                    chain: address.chain,
                    query: address.query,
                  }
                : undefined;
            },
            sections: [
              {
                id: 'rank',
                title: 'Rank',
                run: async (env: Env) => {
                  const answer = await elementAt(env, row, collection, el.rank);
                  return h`<p>${epsilOf(answer.asked)} is ${shown(answer)}.</p>`;
                },
              },
            ],
          }),
    };
  }
  const plan = planElement(placed, address);
  if ('missing' in plan) {
    return {
      title,
      found: true,
      lead: h`<p class="notice">${
        plan.missing.length > 0
          ? h`An element of ${code(row.name)} cannot be written without ${plan.missing.map((m, i) => h`${i > 0 ? ', ' : ''}${code(m)}`)}: bind ${plan.missing.length > 1 ? 'them' : 'it'} in the collection’s segment. ${notComputed()}`
          : h`This value is written in a notation that is read but not yet converted. ${notComputed()}`
      }</p>`,
      sections: [],
    };
  }
  const viewed = link(plan.object) !== link({ ...address, query: [] });
  const membership = membershipOf(placed, plan);
  if (address.chain.length > 0) {
    const whole = chainExpression(plan.epsil, address.chain);
    const element = { ...address, chain: [], query: [] };
    return {
      title,
      found: true,
      object: plan.object,
      lead: h`<p>${whole === undefined ? h`This chain is ${notComputed()}` : h`Computed as ${epsilOf(whole)}`}, on the element ${a(element)}.</p>`,
      sections: [chainSection(row, plan, address, membership)],
      nonMember: async (env) => refused(await membership(env)),
    };
  }
  return {
    title,
    found: true,
    object: plan.object,
    lead: elementLead(row, plan, address),
    sections: [
      figureSection(plan),
      membershipSection(placed, plan, viewed, membership),
      propertiesSection(row, plan, address, membership),
    ],
    nonMember: async (env) => refused(await membership(env)),
  };
}

// ---------------------------------------------------------------- statistics, maps, sequences, input

const findstatUrl = (id: string): string =>
  `https://www.findstat.org/${id.startsWith('Mp') ? 'MapsDatabase' : 'StatisticsDatabase'}/${id}`;

/** The reference page on notatio.app of a statistic or a map on a carrier, from the table's one entry. */
export function referenceUrl(area: string, carrier: string, name: string): string {
  const shape = area === areas.stat ? notatioReference.statistic : notatioReference.map;
  return (
    notatioReference.origin +
    shape
      .replace('{carrier}', encodeURIComponent(carrier))
      .replace('{name}', encodeURIComponent(name))
  );
}

function referenceLink(area: string, carrier: string, name: string): Safe {
  return h`<a class="reference" href="${referenceUrl(area, carrier, name)}">${name} on ${carrier}, in notatio’s reference</a>`;
}

function conceptPage(area: string, address: Address): Live | undefined {
  const subject = address.subject ?? '';
  const isStat = area === areas.stat;
  const known = (isStat ? allStatistics : allMaps).includes(subject);
  if (!known) return undefined;
  const on = rows.filter(
    (r) => isServed(r) && (isStat ? statisticsOf(r) : mapsOf(r)).includes(subject),
  );
  const ids = names.findstat[subject] ?? [];
  const row = address.collection ? rowByName.get(address.collection.name) : undefined;
  const title = link({ ...address, query: [] });
  if (address.collection && address.element && row) {
    // The value on one element has one address, under the element (§3).
    return {
      title,
      found: true,
      lead: h``,
      sections: [],
      replaceWith: {
        area: areas.collection,
        collection: address.collection,
        element: address.element,
        chain: [property(subject), ...address.chain],
        query: address.query,
      },
    };
  }
  const carriers = [...new Set(on.flatMap((r) => carrierOf(r) ?? []))];
  const lead = h`
    <p>A ${isStat ? 'statistic' : 'map'}, written ${code(subject)} in Epsil.</p>
    <p>Reference: ${carriers.map((c, i) => h`${i > 0 ? ', ' : ''}${referenceLink(area, c, subject)}`)}.</p>
    <p>Defined on: ${on.map(
      (r, i) =>
        h`${i > 0 ? ', ' : ''}${a(subjectAddress(area, subject, { collection: { name: r.name, parameters: [] } }), r.name)}`,
    )}.</p>
    ${
      ids.length > 0
        ? h`<p>FindStat: ${ids.map((f, i) => h`${i > 0 ? ', ' : ''}<a href="${findstatUrl(f.id)}">${f.id}</a>${f.on ? h` <span class="note">(on ${f.on})</span>` : ''}`)}.</p>`
        : ''
    }`;
  const sections: Section[] = [
    {
      id: 'definition',
      title: 'Definition',
      run: async (env) => {
        const sentence = await env.describe(subject);
        return sentence
          ? sentenceParagraph(env, sentence)
          : h`<p class="note">notatio records no sentence for ${code(subject)}.</p>`;
      },
    },
  ];
  if (row && address.collection) {
    const placed = place(row, address.collection.parameters);
    const carrier = carrierOf(row);
    if (carrier !== undefined && on.includes(row)) {
      sections.push({
        id: 'reference',
        title: carrier,
        run: async () => h`<p>${referenceLink(area, carrier, subject)}.</p>`,
      });
    }
    if (!on.includes(row)) {
      return {
        title,
        found: false,
        lead: h`${lead}<p class="notice">${code(subject)} is not recorded on ${code(row.name)}.</p>`,
        sections,
      };
    }
    if (placed.collection === undefined) {
      const size = sizeParameter(row);
      sections.push({
        id: 'groups',
        title: 'Distribution',
        run: async () =>
          h`<p class="notice">Bind the collection’s parameters to see ${isStat ? 'the distribution' : 'the map'} there${size ? h`: ${Array.from({ length: 6 }, (_, i) => i + 1).map((n) => h`${a(subjectAddress(area, subject, { collection: { name: row.name, parameters: [{ word: size.word, value: String(n) }] } }), String(n))} `)}` : ''}</p>`,
      });
    } else if (isStat) {
      sections.push(distributionSection(placed.collection, subject, 'Distribution'));
    } else {
      const collection = placed.collection;
      sections.push({
        id: 'images',
        title: 'Images',
        run: async (env) => {
          const total = countOf(await env.ask(`Count(${collection})`));
          const last = Math.min(total ?? windowSize, windowSize);
          const lines: Safe[] = [];
          for (let rank = 1; rank <= last; rank++) {
            const element = await elementAt(env, row, collection, rank);
            const image =
              element.status === 'value' && element.epsil !== undefined
                ? await applyStep(env, element.epsil, property(subject))
                : element;
            lines.push(h`<tr><td>${shown(element)}</td><td>${shown(image)}</td></tr>`);
          }
          return h`<p class="note">The first ${last}${total === undefined ? '' : ` of ${total}`} members of ${epsilOf(collection)}.</p>
          <table><thead><tr><th>element</th><th>${code(subject)}</th></tr></thead><tbody>${lines}</tbody></table>`;
        },
      });
    }
  }
  return { title, found: true, lead, sections };
}

function sequencePage(address: Address): Live | undefined {
  const number = address.subject ?? '';
  const row = rows.find((r) => isServed(r) && r.oeis === number);
  if (!row) return undefined;
  return {
    title: number,
    found: true,
    lead: h`<p>${number} is realized by ${a(collectionAddress(row.name), row.name)}.</p>`,
    sections: [],
    replaceWith: collectionAddress(row.name),
  };
}

function inputPage(address: Address): Live {
  const expression = address.expression ?? '';
  return {
    title: expression,
    found: true,
    lead: h`<p>${epsilOf(expression)}</p>`,
    sections: [
      {
        id: 'value',
        title: 'Result',
        run: async ({ ask }) => {
          // A constructor stands as written: that is a value when it is a catalogued element, a decline otherwise.
          const answer = await ask(expression);
          if (answer.status === 'error') {
            return h`<p class="notice">The kernel could not read or evaluate this: ${answer.reason ?? ''} ${notComputed()}</p>`;
          }
          const own = answer.json === undefined ? undefined : addressOfJson(answer.json);
          const text = answer.status === 'value' ? textOf(answer) : own ? answer.epsil : undefined;
          return h`<p class="value">${text === undefined ? notComputed(answer.reason) : code(text)}</p>
          ${own ? h`<p>This is a catalogued object: ${a(own)}.</p>` : ''}`;
        },
      },
    ],
  };
}

/** A parameter's value in the path is a point (site map §2.1): anything else is refused before any expression is written. */
function notAPoint(address: Address, bad: Binding): Live {
  return {
    title: link({ ...address, query: [] }),
    found: false,
    lead: h`<p class="notice">${code(bad.word)} is bound to ${code(bad.value)}, which is not a point value: only an integer goes in the path. ${notComputed()}</p>`,
    sections: [],
  };
}

function collectionsPage(): Live {
  const served = rows.filter(isServed);
  return {
    title: areas.collection,
    found: true,
    lead: h`<p>The collections served in this pass. Every route, served or proposed, is in the ${a({ area: areas.atlas, chain: [], query: [] }, 'atlas')}.</p>
    <ul>${served.map((r) => h`<li>${a(collectionAddress(r.name), r.name)}${r.within ? h` <span class="note">(inside ${r.within})</span>` : ''}</li>`)}</ul>`,
    sections: [],
  };
}

/**
 * The computed page for an address that was read without a problem, or
 * undefined when the address names nothing computed (the shell's pages, a
 * proposed route, an unknown name).
 */
export function live(read: ParseResult): Live | undefined {
  const { address } = read;
  if (read.problems.length > 0) return undefined;
  switch (address.area) {
    case areas.collection: {
      if (!address.collection) return collectionsPage();
      const row = rowByName.get(address.collection.name);
      if (!row || row.status !== 'live') return undefined;
      const bad = address.collection.parameters.find((b) => !isPoint(b.value));
      if (bad) return notAPoint(address, bad);
      return address.element ? elementPage(row, address) : collectionPage(row, address);
    }
    case areas.stat:
    case areas.map:
      return conceptPage(address.area, address);
    case areas.sequence:
      return sequencePage(address);
    case areas.input:
      return address.expression === undefined ? undefined : inputPage(address);
    default:
      return undefined;
  }
}
