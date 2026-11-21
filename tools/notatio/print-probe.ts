// Prints MathJSON as Epsil with notatio's printer, in Node.
//
//   node tools/notatio/print-probe.ts '["At", ["Permutations", 8], 21]'
//
// For checking how the printer writes an expression before a test pins it.

import { createNodeKernel } from '../../packages/kernel/src/node.ts';

const { print } = createNodeKernel();
for (const arg of process.argv.slice(2)) console.log(await print(JSON.parse(arg)));
