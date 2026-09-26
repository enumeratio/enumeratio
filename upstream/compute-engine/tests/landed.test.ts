import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { PATCHES } from "../src/index.ts";

// Each patch here is a claim: compute-engine, as pinned, does NOT yet answer this
// correctly on its own. Once an upgrade fixes one, this fails -- which is the point: a
// landing becomes a to-do, naming the folder to delete and the PR it was offered as.

for (const patch of PATCHES) {
  test(`${patch.id} is still unfixed on a fresh engine (delete src/${patch.id}/ and close ${patch.pr ?? patch.issue} if this fails)`, () => {
    const ce = new ComputeEngine();
    expect(patch.fixed(ce)).toBe(false);
  });
}
