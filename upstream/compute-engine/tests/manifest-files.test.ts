import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vite-plus/test";
import { PATCHES } from "../src/index.ts";

// Every patch names the `src/compute-engine/...` files a pull request for it would carry
// (https://github.com/enumeratio/enumeratio/wiki/Upstreaming §10) -- checked here against the actual tree, so a rename that
// forgets to update a manifest fails loudly rather than quietly going stale.

const packageRoot = resolve(import.meta.dirname, "..");

for (const patch of PATCHES) {
  test(`${patch.id}: every file it lists exists`, () => {
    expect(patch.files.length, patch.id).toBeGreaterThan(0);
    for (const file of patch.files) {
      expect(existsSync(resolve(packageRoot, file)), `${patch.id}: ${file}`).toBe(true);
    }
  });
}
