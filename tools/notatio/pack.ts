// Builds a notatio checkout at the pinned commit and packs its packages as tarballs.
//
//   NOTATIO_DIR=<checkout> node tools/notatio/pack.ts [--notatio <checkout>] [--no-install] [--no-build]
//
// The checkout must be at the commit in `notatio.pin`. The build is notatio's own
// (`node tools/ci/dist-cache.ts build`), and the packing is its tarball check's
// (`node tools/tarball-check/run.ts --only pack`), so nothing about how notatio
// is built or packed is repeated here. The tarballs land in
// `vendor/notatio/tarballs`, then `unpack.ts` unpacks them for the install.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readPin, stamp, tarballs, vendor } from './shared.ts';
import { unpack } from './unpack.ts';

const { values: args } = parseArgs({
  options: {
    notatio: { type: 'string' },
    'no-install': { type: 'boolean', default: false },
    'no-build': { type: 'boolean', default: false },
    'write-overrides': { type: 'boolean', default: false },
  },
});

const given = args.notatio ?? process.env.NOTATIO_DIR;
if (!given) throw new Error('Set NOTATIO_DIR (or pass --notatio) to a notatio checkout.');
const notatio = resolve(given);
const pin = readPin();

function run(cmd: string, cmdArgs: string[], cwd: string): void {
  console.log(`$ ${cmd} ${cmdArgs.join(' ')}`);
  const done = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' });
  if (done.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(' ')} exited ${done.status}`);
}

const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: notatio, encoding: 'utf8' });
if (head.status !== 0) throw new Error(`${notatio} is not a git checkout`);
if (head.stdout.trim() !== pin) {
  throw new Error(`The notatio checkout is at ${head.stdout.trim()}; notatio.pin says ${pin}.`);
}

if (!args['no-install']) run('pnpm', ['install', '--frozen-lockfile'], notatio);
if (!args['no-build']) run('node', ['tools/ci/dist-cache.ts', 'build'], notatio);

const scratch = join(vendor, 'scratch');
const report = join(vendor, 'report');
rmSync(scratch, { recursive: true, force: true });
run(
  'node',
  ['tools/tarball-check/run.ts', '--only', 'pack', '--scratch', scratch, '--out', report],
  notatio,
);

rmSync(tarballs, { recursive: true, force: true });
mkdirSync(tarballs, { recursive: true });
const packed = readdirSync(join(scratch, 'tarballs')).filter((f) => f.endsWith('.tgz'));
if (packed.length === 0) throw new Error('The tarball check packed nothing.');
for (const file of packed) cpSync(join(scratch, 'tarballs', file), join(tarballs, file));
writeFileSync(stamp, `${pin}\n`);
rmSync(scratch, { recursive: true, force: true });
if (existsSync(report)) rmSync(report, { recursive: true, force: true });
console.log(`packed ${packed.length} packages from notatio ${pin.slice(0, 9)}`);

unpack(args['write-overrides']);
