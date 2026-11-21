// Unpacks the notatio tarballs for the install.
//
//   node tools/notatio/unpack.ts [--write-overrides]
//
// Each `vendor/notatio/tarballs/<slug>-<version>.tgz` is unpacked into
// `vendor/notatio/packages/<slug>`, and `pnpm-workspace.yaml`'s `overrides`
// send every `@notatio/*` name there, so no notatio package is ever asked of a
// registry. The install reads the unpacked directories and not the tarballs
// themselves because a lockfile records a tarball's hash, and two builds of one
// commit do not pack to the same bytes.
//
// Refuses tarballs packed from another commit than `notatio.pin`, and an
// overrides block that does not name exactly the packed packages
// (`--write-overrides` rewrites the block).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { packages, readPin, root, slugOf, stamp, tarballs } from './shared.ts';

const workspaceFile = join(root, 'pnpm-workspace.yaml');
const begin = '# notatio overrides: begin (written by tools/notatio/unpack.ts --write-overrides)';
const end = '# notatio overrides: end';

function overridesBlock(names: Map<string, string>): string {
  const lines = [...names]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([name, dir]) => `  '${name}': file:./${relative(root, dir).replaceAll('\\', '/')}`);
  return [begin, 'overrides:', ...lines, end].join('\n');
}

export function unpack(writeOverrides = false): void {
  const pin = readPin();
  if (!existsSync(stamp)) {
    throw new Error(
      'No notatio tarballs. Run tools/notatio/pack.ts with NOTATIO_DIR set to a checkout at the pin.',
    );
  }
  const packedFrom = readFileSync(stamp, 'utf8').trim();
  if (packedFrom !== pin) {
    throw new Error(`The tarballs were packed from ${packedFrom}; notatio.pin says ${pin}.`);
  }
  rmSync(packages, { recursive: true, force: true });
  mkdirSync(packages, { recursive: true });
  const names = new Map<string, string>();
  for (const file of readdirSync(tarballs).toSorted()) {
    if (!file.endsWith('.tgz')) continue;
    const dir = join(packages, slugOf(file));
    mkdirSync(dir, { recursive: true });
    const done = spawnSync('tar', [
      '-xzf',
      join(tarballs, file),
      '-C',
      dir,
      '--strip-components=1',
    ]);
    if (done.status !== 0) throw new Error(`tar could not unpack ${file}`);
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      name: string;
    };
    names.set(manifest.name, dir);
  }
  const workspace = readFileSync(workspaceFile, 'utf8');
  const wanted = overridesBlock(names);
  const at = workspace.indexOf(begin);
  const until = workspace.indexOf(end);
  const held = at >= 0 && until > at ? workspace.slice(at, until + end.length) : undefined;
  if (held !== wanted) {
    if (!writeOverrides) {
      throw new Error(
        'pnpm-workspace.yaml does not name exactly the packed notatio packages. Run tools/notatio/unpack.ts --write-overrides and commit the result.',
      );
    }
    const next =
      held === undefined
        ? `${workspace.trimEnd()}\n\n${wanted}\n`
        : workspace.replace(held, wanted);
    writeFileSync(workspaceFile, next);
    console.log('pnpm-workspace.yaml: notatio overrides rewritten');
  }
  console.log(`unpacked ${names.size} notatio packages at ${pin.slice(0, 9)}`);
}

if (import.meta.main) unpack(process.argv.includes('--write-overrides'));
