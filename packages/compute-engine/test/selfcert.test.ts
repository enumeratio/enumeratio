import { describe, it, expect } from "vitest";
import { runSelfcert, checkAnchors, type SelfcertResult } from "../selfcert.mjs";

// A BOUNDED slice of the full selfcert sweep, so CI (test:stack) exercises the bijection differential over every
// shipped family deterministically. The full, wider sweep is `pnpm --filter @enumeratio/compute-engine selfcert`.
describe("selfcert — every family is a certified bijection onto its valid set", () => {
  const out: SelfcertResult = runSelfcert(7, 3000);
  checkAnchors(out);

  it("runs a non-trivial number of checks across every family", () => {
    expect(out.families).toBeGreaterThan(80);
    expect(out.checks).toBeGreaterThan(20000);
  });

  it("no family fails distinct / valid / count / rank∘unrank=id, and every anchor count matches", () => {
    expect(out.fails).toEqual([]);
  });
});
