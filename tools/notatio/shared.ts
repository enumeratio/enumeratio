// What the notatio scripts share: the pin, and where the packed packages go.
//
// notatio is a dependency without a registry. `notatio.pin` names one commit of
// enumeratio/notatio; `pack.ts` builds a checkout at that commit and packs its
// packages as tarballs into `vendor/notatio/tarballs`; `unpack.ts` unpacks them
// into `vendor/notatio/packages/<slug>`, where `pnpm-workspace.yaml`'s overrides
// point. Nothing under `vendor/` is committed.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../..');
export const pinFile = join(root, 'notatio.pin');
export const vendor = join(root, 'vendor/notatio');
export const tarballs = join(vendor, 'tarballs');
export const packages = join(vendor, 'packages');
/** Written beside the tarballs: the commit they were packed from. */
export const stamp = join(tarballs, 'PIN');

export function readPin(): string {
  const pin = readFileSync(pinFile, 'utf8').trim();
  if (!/^[0-9a-f]{40}$/.test(pin)) throw new Error(`notatio.pin must hold one full commit hash`);
  return pin;
}

/** `notatio-evaluation-0.0.0.tgz` -> `notatio-evaluation`. */
export const slugOf = (tarball: string): string => tarball.replace(/-\d+\.\d+\.\d+\.tgz$/, '');
