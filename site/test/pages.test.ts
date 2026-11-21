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
import { renderPage } from '../src/pages.ts';

const page = (p: string, q = '') => renderPage(p, q);
const text = (p: string, q = '') => page(p, q).body.value;
const explain = queryWords.explain;

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

  test('only /about names notatio', () => {
    expect(text(path('about'))).toContain('href="https://notatio.app"');
    for (const p of [path(), path('atlas'), path('contribute'), path('collection', 'DyckPath')]) {
      expect(text(p).toLowerCase(), p).not.toContain('notatio');
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

  test('a live collection says not yet computed and shows how it was read', () => {
    const r = page(path('collection', seg('SetPartition', ['size', 4], ['blocks', 2])));
    expect(r.found).toBe(true);
    expect(r.body.value).toContain('Not yet computed');
    expect(r.body.value).toContain('How the address was read');
    expect(r.body.value).toContain('blocks');
  });

  test('a proposed route and a name that is none are not found', () => {
    expect(page(path('collection', 'Integer')).found).toBe(false);
    expect(page(path('collection', 'Nonesuch')).found).toBe(false);
    expect(page(path('nonesuch')).found).toBe(false);
  });

  test('a non-canonical address moves to its canonical one, and the canonical link is the object', () => {
    const moved = page(path('collections', 'dyck-path'), query(['order_by', 'Area']));
    expect(moved.replaceWith).toBe(path('collection', 'DyckPath') + query(['order_by', 'Area']));
    // the view (the query) is not part of the object
    expect(moved.canonical).toBe(siteOrigin + path('collection', 'DyckPath'));
    const sized = page(path('collection', bare('DyckPath', 4)));
    expect(sized.replaceWith).toBe(path('collection', seg('DyckPath', ['semilength', 4])));
    expect(sized.canonical).toBe(siteOrigin + sized.replaceWith);
  });

  test('every collection address of the grammar is read: rank, notation, chain, sub-collection', () => {
    const rankPage = text(path('collection', seg('DyckPath', ['semilength', 4]), rank(7, 'lex')));
    expect(rankPage).toContain('by rank');
    const chainPage = text(
      path('collection', 'SetPartition', blocks(unordered(1, 3), 2, 4), 'Blocks', '2'),
    );
    expect(chainPage).toContain('index');
    expect(chainPage).toContain('Blocks');
    // an element seen in a sub-collection names its object's address in the unrestricted one
    const view = text(path('collection', 'Prime', '17'));
    expect(view).toContain(`href="${path('collection', 'Natural', '17')}"`);
    const bound = text(path('collection', seg('Permutation', ['size', 4]), ordered(2, 1, 4, 3)));
    expect(bound).toContain(`href="${path('collection', 'Permutation', ordered(2, 1, 4, 3))}"`);
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

  test('the marks shown to a reader are the table’s', () => {
    expect(text(path('contribute'))).toContain(`<code>${marks.ordered}</code>`);
  });
});
