import {
  type Address,
  type Binding,
  type ParseResult,
  type Step,
  areas,
  formatAddress,
  formatPath,
  formatSegment,
  formatStep,
  leafAreas,
  marks,
  notatioReference,
  queryWords,
} from '@enumeratio/address';
import {
  promiseStarted,
  rowByName,
  rows,
  statuses,
  unrestrictedCollection,
  type RouteRow,
  type Status,
} from '@enumeratio/routes';
import { repositoryUrl, routeFilePath, siteOrigin } from './config.ts';
import { tryThese } from './examples.ts';
import { type Safe, code, h } from './html.ts';
import { type Env, type Section, live } from './live.ts';
import { readAddress } from './reading.ts';

export interface Page {
  title: string;
  /**
   * The absolute canonical URL: the path only, since the query is the view, not the object.
   * Absent when the address has problems: an address that cannot be read has no canonical form.
   */
  canonical?: string;
  /** True when the page asks not to be indexed: the address has problems, or names nothing. */
  noindex: boolean;
  body: Safe;
  /** Present when the address was not canonical: where the page should move to (path and query). */
  replaceWith?: string;
  /** False for an address that names nothing. */
  found: boolean;
  /**
   * The parts of the page the kernel computes, each drawn into the element
   * with its id once its `run` resolves. Absent on a page that needs no kernel.
   */
  sections?: Section[];
  /** Resolves true once the kernel has found the element is not a member: the page then drops its canonical link and asks not to be indexed. */
  nonMember?: (env: Env) => Promise<boolean>;
  /** Where the page moves once the kernel has answered (a rank address moves to its value). */
  moveTo?: (env: Env) => Promise<string | undefined>;
}

/** The id of the element a section is drawn into. */
export const sectionId = (id: string): string => `section-${id}`;

const siteName = 'enumeratio';
const link = (address: Address) => formatAddress(address);

/** The address of an area's own page (or of the root, for the empty area), from the table. */
export const areaLink = (area: string): string => formatAddress({ area, chain: [], query: [] });
const atlasLink = areaLink(areas.atlas);
const aboutLink = areaLink(areas.about);
const contributeLink = areaLink(areas.contribute);

// ---------------------------------------------------------------- the placeholder's look and words

export function homeBody(): Safe {
  return h`<main>
  <h1>enumeratio</h1>
  <p class="etymology">Latin <i>ēnumerātiō</i>, from <i>ēnumerāre</i>, “to count out”: <i>ē-</i>, “out”, and <i>numerāre</i>, “to count”, from <i>numerus</i>, “number”. Numeration is writing a number down; enumeration is counting and listing the things numbers count. Both come from the same root, and this site is about both.</p>
  <p>enumeratio is a home for mathematical objects, each at an address meant to last: the kinds of numbers and the ways of writing them, integer sequences, permutations, partitions, paths, trees and the other structures of combinatorics, the statistics on them and the maps between them, the polytopes whose faces they label, knots.</p>
  <p class="motto">One object, one page, one address.</p>
  <p>The site is being rebuilt. The <a href="${atlasLink}">atlas</a> lists what is planned and what is under way; <a href="${aboutLink}">about</a> says what the site is, and <a href="${contributeLink}">contribute</a> says how to propose a route. To compute with these objects today, use <a href="${notatioReference.origin}">notatio</a>.</p>
  <p>Some addresses to try:</p>
  <ul class="plain">
    ${tryThese.map(
      ({ what, address }) =>
        h`<li><a href="${link(address)}">${code(link(address))}</a>, ${what}</li>`,
    )}
  </ul>
</main>`;
}

// ---------------------------------------------------------------- about, contribute

function aboutBody(): Safe {
  return h`<main class="wide">
  <h1>About</h1>
  <p>enumeratio.dev is the home of individual mathematical objects: one address per object, meant to last. It is about the mathematics, and is agnostic about what computes it.</p>
  <p>An address is read the same way everywhere. Its first segment is an area (${code(areas.collection)}, ${code(areas.stat)}, ${code(areas.map)}, ${code(areas.sequence)}, ${code(areas.input)}); then comes a collection, with any parameters bound inside its segment; then one element of it, by value or by rank; then a chain of properties. The <a href="${atlasLink}">atlas</a> lists every route and its status. The specification is the <a href="${repositoryUrl}/blob/main/docs/site-map.md">site map</a>.</p>
  <p>The characters of the grammar are provisional and will change as the site is used. Nothing here is promised permanent until the site is announced.</p>
  <p>Objects are computed in the page. The engine behind them is part of <a href="${notatioReference.origin}">notatio</a>, a notebook for mathematics.</p>
</main>`;
}

function contributeBody(): Safe {
  return h`<main class="wide">
  <h1>Contribute</h1>
  <p>To propose a route, or to reserve one, add a row to the route file and open a pull request. There is no other form yet.</p>
  <ul>
    <li>The route file is ${code(routeFilePath)} in the <a href="${repositoryUrl}">repository</a>. One row is one collection; its columns are described at the top of the file.</li>
    <li>A <strong>proposed</strong> row gives the name (PascalCase, singular, as the head is written in Epsil), the parameters it would take, and who asks for it and when. It appears in the <a href="${atlasLink}">atlas</a> and is not served.</li>
    <li>A <strong>reserved</strong> row holds a name for a stated object, by a named person, until a date. It serves a short page saying so. A reservation lapses after a year unless it is renewed or has become a stub.</li>
    <li>A <strong>stub</strong> or <strong>live</strong> row needs the Epsil expression behind it and its declared parameters; a collection’s row covers every sub-collection, element and property under it.</li>
  </ul>
  <p>A test checks that no two names share a key (a name’s key is the name without ${code(marks.negative)} and ${code(marks.ordered)}, in lowercase), and that every alias resolves to exactly one row.</p>
  <p>The promise of permanence starts when the site is announced; until then the route file says so, and any row may be renamed.</p>
</main>`;
}

// ---------------------------------------------------------------- the atlas

function parametersCell(row: RouteRow): Safe {
  if (row.parameters === undefined || row.parameters.length === 0)
    return h`<span class="none">none declared</span>`;
  return h`${row.parameters.map(
    (p, i) =>
      h`${i > 0 ? ', ' : ''}${code(p.word)}${p.size ? h` <span class="note">(size)</span>` : ''}`,
  )}`;
}

function atlasRow(row: RouteRow): Safe {
  const served = row.status !== 'proposed';
  const href = link({
    area: areas.collection,
    collection: { name: row.name, parameters: [] },
    chain: [],
    query: [],
  });
  return h`<tr>
    <td>${served ? h`<a href="${href}">${row.name}</a>` : row.name}</td>
    <td>${row.status}</td>
    <td>${row.kind}${row.within ? h` of <span>${row.within}</span>` : ''}</td>
    <td>${parametersCell(row)}</td>
    <td>${row.oeis ?? ''}</td>
    <td>${row.aliases.join(', ')}</td>
  </tr>`;
}

const statusMeaning: Record<Status, string> = {
  proposed: 'Suggested. Listed in the atlas, not served. No promise.',
  reserved: 'The name is held for a stated object until a date. Serves a short page saying so.',
  stub: 'Serves the definition and links, without live content.',
  live: 'The full page.',
};

const areaMeaning: [string, string][] = [
  [
    areas.collection,
    'Every object: numbers, structures, knots, polytopes, groups. One row each, below.',
  ],
  [areas.stat, 'A statistic as a concept, and its distribution on a collection.'],
  [areas.map, 'A map as a concept: source, target, what it preserves.'],
  [areas.sequence, 'An OEIS number, leading to the collection or statistic that realizes it.'],
  [areas.input, 'Evaluates an Epsil expression; says so when the result is a catalogued object.'],
  [areas.atlas, 'This page.'],
  [areas.about, 'What the site is.'],
  [areas.contribute, 'How to propose or reserve a route.'],
];

function atlasBody(): Safe {
  const counts = statuses.map((s) => [s, rows.filter((r) => r.status === s).length] as const);
  const ordered = [...rows].sort((a, b) => statuses.indexOf(b.status) - statuses.indexOf(a.status));
  return h`<main class="wide">
  <h1>Atlas</h1>
  ${
    promiseStarted
      ? ''
      : h`<p class="notice"><strong>Not yet promised.</strong> The promise of permanence starts when the site is announced. Until then any route below, whatever its status, may be renamed or removed.</p>`
  }
  <p>Every route, generated from the route file (${code(routeFilePath)}). ${counts
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(', ')}.</p>
  <h2>Statuses</h2>
  <table>
    <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
    <tbody>${statuses.map((s) => h`<tr><td>${s}</td><td>${statusMeaning[s]}</td></tr>`)}</tbody>
  </table>
  <h2>Areas</h2>
  <table>
    <thead><tr><th>Path</th><th>What it is</th></tr></thead>
    <tbody>${areaMeaning.map(([a, m]) => h`<tr><td>${code(marks.segment + a)}</td><td>${m}</td></tr>`)}</tbody>
  </table>
  <h2>Collections</h2>
  <table>
    <thead><tr><th>Name</th><th>Status</th><th>Kind</th><th>Parameters</th><th>OEIS</th><th>Aliases</th></tr></thead>
    <tbody>${ordered.map(atlasRow)}</tbody>
  </table>
</main>`;
}

// ---------------------------------------------------------------- the address, read

function describeBindings(bindings: readonly Binding[]): Safe {
  if (bindings.length === 0) return h`<span class="none">none bound</span>`;
  return h`${bindings.map((b, i) => h`${i > 0 ? ', ' : ''}${code(b.word)} = ${code(b.value)}`)}`;
}

function describeStep(step: Step): Safe {
  return step.kind === 'index'
    ? h`index ${code(String(step.index))} (counting from 1) into the result before it`
    : h`property ${code(step.name)}${step.parameters.length > 0 ? h` with ${describeBindings(step.parameters)}` : ''}`;
}

function collectionRows(address: Address): Safe {
  const segment = address.collection;
  if (!segment) return h``;
  const row = rowByName.get(segment.name);
  const parts: Safe[] = [h`<tr><th>Collection</th><td>${code(segment.name)}</td></tr>`];
  if (row) {
    parts.push(
      h`<tr><th>Route</th><td>${row.kind}${row.within ? h` inside ${code(row.within)}` : ''}, status <strong>${row.status}</strong></td></tr>`,
    );
    const declared = row.parameters ?? [];
    parts.push(
      h`<tr><th>Parameters declared</th><td>${
        declared.length === 0
          ? h`<span class="none">none</span>`
          : declared.map(
              (p, i) =>
                h`${i > 0 ? ', ' : ''}${code(p.word)}${p.size ? h` <span class="note">(the size: read as n, and as a bare value)</span>` : ''}`,
            )
      }</td></tr>`,
    );
  }
  parts.push(h`<tr><th>Parameters bound</th><td>${describeBindings(segment.parameters)}</td></tr>`);
  return h`${parts}`;
}

function elementRows(address: Address): Safe {
  const el = address.element;
  const segment = address.collection;
  if (!el || !segment) return h``;
  const parts: Safe[] = [];
  if (el.kind === 'rank') {
    parts.push(
      h`<tr><th>Element</th><td>by rank: position ${code(String(el.rank))} in ${el.order === undefined ? 'the default order' : h`the order ${code(el.order)}`} of ${code(formatSegment(segment))}</td></tr>`,
    );
    parts.push(
      h`<tr><th>Canonical</th><td>A rank address moves to the value address once the collection is computed. Not yet computed.</td></tr>`,
    );
  } else {
    parts.push(
      h`<tr><th>Element</th><td>by value: ${code(el.value)}${el.notation === undefined ? '' : h`, written in the notation ${code(el.notation)}`} <span class="note">(kept as written here; its collection reads it)</span></td></tr>`,
    );
    const home = unrestrictedCollection(segment.name);
    if (home !== segment.name || segment.parameters.length > 0) {
      const object = link({
        area: address.area,
        ...(address.subject === undefined ? {} : { subject: address.subject }),
        collection: { name: home, parameters: [] },
        element: el,
        chain: address.chain,
        query: [],
      });
      parts.push(
        h`<tr><th>The object</th><td>This is a view of an element of the unrestricted collection: its canonical address is <a href="${object}">${code(object)}</a>. Whether it belongs here is not yet computed.</td></tr>`,
      );
    }
  }
  return h`${parts}`;
}

/** The canonical form, or undefined when the address has problems (it has none then). */
function canonicalOf(read: ParseResult): string | undefined {
  return read.problems.length === 0 ? read.canonicalPath : undefined;
}

function readingTable(read: ParseResult, asked: string): Safe {
  const { address } = read;
  const parts: Safe[] = [];
  parts.push(
    h`<tr><th>Area</th><td>${address.area === '' ? h`<span class="none">none (the root)</span>` : code(address.area)}</td></tr>`,
  );
  if (address.subject !== undefined) {
    parts.push(h`<tr><th>Name</th><td>${code(address.subject)}</td></tr>`);
  }
  parts.push(collectionRows(address));
  parts.push(elementRows(address));
  if (address.chain.length > 0) {
    parts.push(
      h`<tr><th>Properties</th><td><ol>${address.chain.map((s) => h`<li>${describeStep(s)}, written ${code(formatStep(s))}</li>`)}</ol> <span class="note">each applies to the result of the one before</span></td></tr>`,
    );
  }
  if (address.expression !== undefined) {
    parts.push(h`<tr><th>Expression</th><td>${code(address.expression)}</td></tr>`);
  }
  if (address.rest && address.rest.length > 0) {
    parts.push(h`<tr><th>Left over</th><td>${address.rest.map((r) => code(r))}</td></tr>`);
  }
  parts.push(
    h`<tr><th>View (query)</th><td>${
      address.query.length === 0
        ? h`<span class="none">none</span>`
        : address.query.map(
            ([k, v], i) => h`${i > 0 ? ', ' : ''}${code(k)}${v === '' ? '' : h` = ${code(v)}`}`,
          )
    }</td></tr>`,
  );
  parts.push(
    h`<tr><th>Written</th><td>${code(asked)}</td></tr>
      <tr><th>Canonical</th><td>${
        canonicalOf(read) === undefined
          ? h`<span class="none">none: the address could not be read</span>`
          : h`${code(canonicalOf(read) ?? '')} ${
              read.canonical
                ? h`<span class="note">(as written)</span>`
                : h`<span class="note">(moved here)</span>`
            }`
      }</td></tr>`,
  );
  return h`<table class="reading"><tbody>${parts}</tbody></table>`;
}

/** What the page says about whether the address is served, and what is missing. */
function verdict(read: ParseResult): { found: boolean; text: Safe } {
  const { address } = read;
  const unknownArea = read.problems.some((p) => p.code === 'unknown-area');
  if (unknownArea) {
    return {
      found: false,
      text: h`<p class="notice">${code(address.area)} is not an area. The areas are ${areas.collection}, ${areas.stat}, ${areas.map}, ${areas.sequence}, ${areas.input}, ${areas.atlas}, ${areas.about} and ${areas.contribute}.</p>`,
    };
  }
  if (address.area === areas.collection && !address.collection) {
    return {
      found: true,
      text: h`<p>Every collection is listed in the <a href="${atlasLink}">atlas</a>.</p>`,
    };
  }
  if (address.collection) {
    const row = rowByName.get(address.collection.name);
    if (!row) {
      return {
        found: false,
        text: h`<p class="notice">No route is called ${code(address.collection.name)}. The <a href="${atlasLink}">atlas</a> lists the routes there are; <a href="${contributeLink}">contribute</a> says how to propose one.</p>`,
      };
    }
    if (row.status === 'proposed') {
      return {
        found: false,
        text: h`<p class="notice">${code(row.name)} is <strong>proposed</strong>: it is listed in the atlas and not served.</p>`,
      };
    }
    if (row.status === 'reserved') {
      return {
        found: true,
        text: h`<p class="notice">${code(row.name)} is <strong>reserved</strong>: the name is held for a stated object.</p>`,
      };
    }
  }
  const shell = address.area === '' || (leafAreas as readonly string[]).includes(address.area);
  if (read.problems.length === 0 && !shell && !live(read)) {
    return {
      found: false,
      text: h`<p class="notice">This address is read, and names nothing the site serves. The <a href="${atlasLink}">atlas</a> lists what there is.</p>`,
    };
  }
  return { found: true, text: h`` };
}

function addressBody(read: ParseResult, asked: string): { body: Safe; found: boolean } {
  const v = verdict(read);
  const body = h`<main class="wide">
  <h1>${code(canonicalOf(read) ?? asked)}</h1>
  ${v.text}
  <h2>How the address was read</h2>
  ${readingTable(read, asked)}
  ${
    read.problems.length === 0
      ? ''
      : h`<h2>What was wrong</h2><ul>${read.problems.map((p) => h`<li>${p.message}</li>`)}</ul>`
  }
  <p class="note">This is the grammar made visible: every address shows it behind ${code(marks.query + queryWords.explain)}.</p>
</main>`;
  return { body, found: v.found };
}

// ---------------------------------------------------------------- the router's one function

/** Everything the router needs for one location. Pure: no DOM, so tests can run it in Node. */
export function renderPage(pathname: string, search: string): Page {
  const read = readAddress(pathname, search);
  const asked = pathname + search;
  const readable = read.problems.length === 0;
  const canonicalPath = canonicalOf(read);
  // Problems mean no canonical form: no canonical link and no move.
  const canonical = readable ? siteOrigin + formatPath(read.address) : undefined;
  const replaceWith = readable && !read.canonical ? canonicalPath : undefined;
  const page = (title: string, body: Safe, found = true): Page => ({
    title: title === '' ? siteName : `${title} | ${siteName}`,
    body,
    found,
    noindex: !readable || !found,
    ...(canonical === undefined ? {} : { canonical }),
    ...(replaceWith === undefined ? {} : { replaceWith }),
  });
  const { area } = read.address;
  const explain = read.address.query.some(([key]) => key === queryWords.explain);
  if (!explain && readable) {
    if (area === '') return page('', homeBody());
    if (area === areas.atlas) return page('Atlas', atlasBody());
    if (area === areas.about) return page('About', aboutBody());
    if (area === areas.contribute) return page('Contribute', contributeBody());
  }
  const computed = !explain && readable ? live(read) : undefined;
  if (computed) {
    const moved = computed.replaceWith ? formatAddress(computed.replaceWith) : replaceWith;
    const object = computed.object ? siteOrigin + formatPath(computed.object) : canonical;
    const explained = formatAddress({
      ...read.address,
      query: [...read.address.query, [queryWords.explain, '']],
    });
    const body = h`<main class="wide">
  <h1>${code(computed.title)}</h1>
  ${computed.lead}
  ${computed.sections.map(
    (s) =>
      h`<section id="${sectionId(s.id)}"><h2>${s.title}</h2><div class="pending" aria-busy="true">Computing…</div></section>`,
  )}
  <p class="note"><a href="${explained}">How this address was read</a></p>
</main>`;
    const moveTo = computed.moveTo;
    return {
      title: `${computed.title} | ${siteName}`,
      body,
      found: computed.found,
      noindex: !computed.found,
      ...(object === undefined ? {} : { canonical: object }),
      ...(moved === undefined ? {} : { replaceWith: moved }),
      ...(computed.sections.length > 0 ? { sections: computed.sections } : {}),
      ...(computed.nonMember === undefined ? {} : { nonMember: computed.nonMember }),
      ...(moveTo === undefined
        ? {}
        : { moveTo: async (env: Env) => moveTo(env).then((to) => to && formatAddress(to)) }),
    };
  }
  const { body, found } = addressBody(read, asked);
  return page(canonicalPath ?? asked, body, found);
}
