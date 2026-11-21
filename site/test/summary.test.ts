/**
 * A notatio record's sentence with `$…$` islands: typeset in Node by notatio's renderer, drawn as
 * marked plain text where the page has not yet loaded it, and never trusted as markup.
 */
import { expect, test } from 'vite-plus/test';
import { areas } from '@enumeratio/address';
import { path } from '../../packages/address/test/build.ts';
import descriptions from 'virtual:notatio-descriptions';
import { type Env, summaryAttribute } from '../src/live.ts';
import { renderPage } from '../src/pages.ts';
import { compute } from './harness.ts';

const definitionOf = async (name: string, env: Partial<Env>): Promise<string> => {
  const page = renderPage(path(areas.collection, name), '');
  const section = page.sections?.find((s) => s.id === 'definition');
  if (!section) throw new Error('no definition section');
  const ask: Env['ask'] = async (epsil) => ({ asked: epsil, status: 'declined', reason: 'none' });
  return (await section.run({ ask, describe: async (n) => descriptions[n], ...env })).value;
};

test('SetPartition: the definition is KaTeX markup and has no $', async () => {
  expect(descriptions.SetPartitions).toContain('$');
  const c = await compute(path(areas.collection, 'SetPartition'));
  const definition = c.sections.get('definition') ?? '';
  expect(definition).toContain('class="katex"');
  expect(definition).not.toContain('$');
});

test('a sentence with no island is unchanged', async () => {
  const plain = Object.entries(descriptions).find(
    ([, text]) => !text.includes('$') && /^[\w ,.]+$/.test(text),
  );
  expect(plain).toBeDefined();
  const [name, text] = plain!;
  const env: Env['describe'] = async () => text;
  const typeset = (
    await definitionOf('SetPartition', { describe: env, typeset: (s) => s })
  ).includes(`<p>${text}</p>`);
  expect(typeset).toBe(true);
  expect(name.length).toBeGreaterThan(0);
});

test('without a typesetter the sentence is escaped plain text, marked only when it has an island', async () => {
  const withIsland = await definitionOf('SetPartition', {});
  expect(withIsland).toContain(`<p ${summaryAttribute}>`);
  expect(withIsland).toContain('$');
  expect(withIsland).not.toContain('class="katex"');
  const without = await definitionOf('SetPartition', { describe: async () => 'No islands here.' });
  expect(without).toContain('<p>No islands here.</p>');
  expect(without).not.toContain(summaryAttribute);
});

test('a hostile sentence is never markup', async () => {
  const hostile = '<script>alert(1)</script> $x$ <img src=x onerror=alert(1)>';
  const plain = await definitionOf('SetPartition', { describe: async () => hostile });
  expect(plain).not.toContain('<script>');
  expect(plain).not.toContain('<img');
  const { renderSummary } = await import('@notatio/formats/typeset');
  const typeset = await definitionOf('SetPartition', {
    describe: async () => hostile,
    typeset: renderSummary,
  });
  expect(typeset).not.toContain('<script>');
  expect(typeset).not.toContain('<img');
});

test('the atlas shows no record sentence, so it has no island to typeset', () => {
  expect(renderPage(path(areas.atlas), '').body.value).not.toMatch(/\$[^$]*\\/);
});
