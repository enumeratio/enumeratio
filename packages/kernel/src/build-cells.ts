/**
 * The package's build: parses the route file's Epsil cells with notatio's parser and writes their
 * MathJSON to `build/route-cells.json` (gitignored). The site's Vite plugin does the same at the
 * start of every build, test run and dev server, so the file is never stale.
 */
import { writeRouteCells } from './parse-cells.ts';

console.log(`wrote ${writeRouteCells()}`);
