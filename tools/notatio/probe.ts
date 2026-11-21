// Asks the kernel in Node what a list of Epsil expressions evaluate to.
//
//   node tools/notatio/probe.ts <file with one expression per line>
//
// For checking a head against the pinned notatio before a route row or a test
// relies on it.

import { readFileSync } from 'node:fs';
import { createNodeKernel } from '../../packages/kernel/src/node.ts';

const file = process.argv[2];
if (!file) throw new Error('usage: probe.ts <file>');
const ask = createNodeKernel();
for (const line of readFileSync(file, 'utf8').split('\n')) {
  const text = line.trim();
  if (text === '' || text.startsWith('#')) continue;
  const started = Date.now();
  const a = await ask(text);
  const ms = Date.now() - started;
  console.log(
    `${text}\n  -> [${a.status}] ${a.epsil ?? ''} ${JSON.stringify(a.json)?.slice(0, 300) ?? ''} ${a.reason ?? ''} (${ms} ms)`,
  );
}
