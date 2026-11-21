import { Window } from 'happy-dom';
import { describe, expect, test } from 'vite-plus/test';
import { formatPath, marks, parseAddress, queryWords } from '@enumeratio/address';
import { catalog, rowByName, rows } from '@enumeratio/routes';
import {
  bare,
  blocks,
  ordered,
  path,
  query,
  rank,
  seg,
  unordered,
} from '../../packages/address/test/build.ts';
import { siteOrigin } from '../src/config.ts';
import { tryThese } from '../src/examples.ts';
import { renderPage, sectionId } from '../src/pages.ts';

const page = (p: string, q = '') => renderPage(p, q);
const text = (p: string, q = '') => page(p, q).body.value;
const explain = queryWords.explain;
/** A parameter's word, as the route file declares it. */
const param = (name: string, index: number): string =>
  rowByName.get(name)?.parameters?.[index]?.word ?? '';
/** The ?explain view's query string, as the page links to it. */
const explained = marks.query + explain;

describe('the pages', () => {
  const fixed = [path(), path('atlas'), path('about'), path('contribute')];

  test.each(fixed)('%s is served, canonical, and carries its canonical link', (p) => {
    const r = page(p);
    expect(r.found).toBe(true);
    expect(r.replaceWith).toBeUndefined();
    expect(r.canonical).toBe(siteOrigin + p);
  });

  test('the home page links into the site and offers one address per row of the §9 table', () => {
    const body = text(path());
    for (const target of [path('atlas'), path('about'), path('contribute')]) {
      expect(body).toContain(`href="${target}"`);
    }
    expect(tryThese).toHaveLength(6);
    for (const { address } of tryThese) {
      const written = formatPath(address);
      const read = parseAddress(written, '', { catalog });
      expect(read.problems, written).toEqual([]);
      expect(read.canonical, written).toBe(true);
      expect(rowByName.get(address.collection?.name ?? '')?.status).toBe('live');
    }
  });

  test('only the home page and /about link to notatio.app', () => {
    for (const p of [path(), path('about')]) {
      expect(text(p), p).toContain('href="https://notatio.app"');
    }
    for (const p of [path('atlas'), path('contribute'), path('collection', 'DyckPath')]) {
      expect(text(p).toLowerCase(), p).not.toContain('notatio');
    }
  });

  test('an address with a problem has no canonical form, is not indexed, and says what was wrong', () => {
    for (const r of [page(path('nonesuch')), page(path('collection', 'DyckPath', rank(0)))]) {
      expect(r.canonical).toBeUndefined();
      expect(r.replaceWith).toBeUndefined();
      expect(r.noindex).toBe(true);
      expect(r.body.value).toContain('What was wrong');
    }
  });

  test('a readable address that names nothing is not indexed but keeps its canonical link', () => {
    const r = page(path('collection', 'Integer'));
    expect(r.found).toBe(false);
    expect(r.noindex).toBe(true);
    expect(r.canonical).toBe(siteOrigin + path('collection', 'Integer'));
  });

  test('a served page is indexed', () => {
    for (const p of [path(), path('atlas'), path('collection', 'DyckPath')]) {
      expect(page(p).noindex, p).toBe(false);
    }
  });

  test('the atlas lists every row from the route file, and says it is not yet promised', () => {
    const body = text(path('atlas'));
    expect(body).toContain('Not yet promised');
    for (const row of rows) expect(body, row.name).toContain(`>${row.name}<`);
    // Served rows link to their page; proposed rows do not.
    expect(body).toContain(`href="${path('collection', 'DyckPath')}"`);
    expect(body).not.toContain(`href="${path('collection', 'Integer')}"`);
  });

  test('a live collection has computed sections, and the reading of its address is behind ?explain', () => {
    const address = path(
      'collection',
      seg('SetPartition', [param('SetPartition', 0), 4], [param('SetPartition', 1), 2]),
    );
    const r = page(address);
    expect(r.found).toBe(true);
    expect(r.body.value).not.toContain('Not yet computed');
    // The sections are drawn later, one placeholder each, and the page says what they are.
    const ids = (r.sections ?? []).map((s) => s.id);
    expect(ids).toContain('definition');
    expect(ids).toContain('members');
    for (const id of ids) expect(r.body.value).toContain(`id="${sectionId(id)}"`);
    expect(r.body.value).toContain('Computing');
    // The reading is a view of its own, linked from the page.
    expect(r.body.value).toContain(`href="${address}${explained}"`);
    expect(r.body.value).not.toContain('How the address was read</h2>');
    const view = page(address, explained);
    expect(view.found).toBe(true);
    expect(view.sections).toBeUndefined();
    expect(view.body.value).toContain('How the address was read');
    expect(view.body.value).toContain(param('SetPartition', 1));
  });

  test('every live collection has computed sections', () => {
    for (const row of rows.filter((r) => r.status === 'live')) {
      const r = page(path('collection', row.name));
      expect((r.sections ?? []).length, row.name).toBeGreaterThan(0);
    }
  });

  test('a proposed route and a name that is none are not found', () => {
    expect(page(path('collection', 'Integer')).found).toBe(false);
    expect(page(path('collection', 'Nonesuch')).found).toBe(false);
    expect(page(path('nonesuch')).found).toBe(false);
  });

  test('a non-canonical address moves to its canonical one, and the canonical link is the object', () => {
    const moved = page(path('collections', 'dyck-path'), query([queryWords.orderBy, 'Area']));
    expect(moved.replaceWith).toBe(
      path('collection', 'DyckPath') + query([queryWords.orderBy, 'Area']),
    );
    // the view (the query) is not part of the object
    expect(moved.canonical).toBe(siteOrigin + path('collection', 'DyckPath'));
    const sized = page(path('collection', bare('DyckPath', 4)));
    expect(sized.replaceWith).toBe(path('collection', seg('DyckPath', [param('DyckPath', 0), 4])));
    expect(sized.canonical).toBe(siteOrigin + sized.replaceWith);
  });

  test('every collection address of the grammar is read: rank, notation, chain, sub-collection', () => {
    // The reading of an address is its ?explain view.
    const rankPage = text(
      path('collection', seg('DyckPath', [param('DyckPath', 0), 4]), rank(7, 'lex')),
      explained,
    );
    expect(rankPage).toContain('by rank');
    const chainPage = text(
      path('collection', 'SetPartition', blocks(unordered(1, 3), 2, 4), 'Blocks', '2'),
      explained,
    );
    expect(chainPage).toContain('index');
    expect(chainPage).toContain('Blocks');
    // an element seen in a sub-collection names its object's address in the unrestricted one
    const viewed = text(path('collection', 'Prime', '17'), explained);
    expect(viewed).toContain(`href="${path('collection', 'Natural', '17')}"`);
    expect(page(path('collection', 'Prime', '17')).canonical).toBe(
      siteOrigin + path('collection', 'Natural', '17'),
    );
    const bound = path(
      'collection',
      seg('Permutation', [param('Permutation', 0), 4]),
      ordered(2, 1, 4, 3),
    );
    expect(text(bound, explained)).toContain(
      `href="${path('collection', 'Permutation', ordered(2, 1, 4, 3))}"`,
    );
    expect(page(bound).canonical).toBe(
      siteOrigin + path('collection', 'Permutation', ordered(2, 1, 4, 3)),
    );
  });

  test('?explain shows the reading of any path, the home page included', () => {
    const r = page(path(), explain);
    expect(r.body.value).toContain('How the address was read');
    expect(r.found).toBe(true);
  });

  test('what is written in an address is never inserted as markup', () => {
    const hostile = '<script>alert(1)</script>';
    for (const r of [
      page(path('input', encodeURIComponent(hostile))),
      page(path('collection', encodeURIComponent(hostile))),
      page(path('collection', 'DyckPath', encodeURIComponent(hostile))),
      page(path('stat', encodeURIComponent(hostile))),
      page(path('nonesuch'), query(['x', encodeURIComponent(hostile)])),
    ]) {
      expect(r.body.value).not.toContain('<script>');
    }
  });

  test('no attribute can be broken out of, and no element gains a handler', () => {
    const nasty = '"\'><b onmouseover=alert(1)>javascript:alert(1)';
    const pieces = [nasty, encodeURIComponent(nasty), 'javascript:alert(1)', '" onmouseover="x'];
    const pages = pieces.flatMap((piece) => [
      page(path('input', piece), query(['x', piece])),
      page(path('collection', piece)),
      page(path('collection', 'Prime', piece)),
      page(path('collection', 'DyckPath', piece, 'Area'), query([queryWords.show, piece])),
      page(path('stat', piece)),
      page(path('nonesuch', piece), query([piece, piece])),
    ]);
    const window = new Window();
    for (const r of pages) {
      for (const [, value] of r.body.value.matchAll(/href="([^"]*)"/g)) {
        expect(value, r.title).not.toMatch(/["'<>]/);
        expect(value, r.title).not.toMatch(/^\s*javascript:/i);
      }
      window.document.body.innerHTML = r.body.value;
      for (const el of window.document.body.querySelectorAll('*')) {
        for (const attribute of el.getAttributeNames()) {
          expect(attribute, `${r.title} <${el.tagName}>`).not.toMatch(/^on/i);
        }
        expect(el.tagName).not.toBe('SCRIPT');
      }
    }
  });

  test('a hostile path is plain text in the title', () => {
    const hostile = '</title><script>alert(1)</script>';
    const r = page(path('nonesuch', hostile));
    expect(r.title).toContain(hostile);
    const window = new Window();
    window.document.title = r.title;
    expect(window.document.title).toBe(r.title);
    expect(window.document.head.querySelector('script')).toBeNull();
    expect(r.body.value).not.toContain('<script>');
  });

  test('the marks shown to a reader are the table’s', () => {
    expect(text(path('contribute'))).toContain(`<code>${marks.ordered}</code>`);
  });
});
