// design/roadmap.md §1's warning, made a guard: `HarmonicNumber` is in the wolfram head
// map (`packages/wolfram/src/to-wolfram.ts` `HEADS`), so the transpiler emits it, but the
// engine never declares it — a head the transpiler vouches for and the engine cannot
// answer. This test only fails a NEW head of that shape (`undeclared`): the milder
// `unevaluated` category (declared, but a sample produced no answer) is read-only data,
// since a failing sample can be a domain artifact rather than a real gap — see
// `scripts/audit-head-map.ts`'s own header for two that turned out to be exactly that.

import { expect, test } from "vite-plus/test";
import { HEAD_MAP_AUDIT } from "../src/head-map-audit-data.ts";

/** Heads already known to be undeclared, so today's run is green. A head lands here only
 *  when `vp node packages/census/scripts/audit-head-map.ts` puts it in the `undeclared`
 *  category — remove the line once the engine declares it, don't add one preemptively. */
const ALLOWED_UNDECLARED: Record<string, string> = {};

test("no head-map entry is undeclared unless the allowlist says so", () => {
  const undeclared = HEAD_MAP_AUDIT.filter((e) => e.category === "undeclared").map((e) => e.head);
  const unexpected = undeclared.filter((head) => !(head in ALLOWED_UNDECLARED));
  expect(unexpected).toEqual([]);
});

test("the allowlist has no stale entries", () => {
  // The other half of the guard: an entry that stopped being undeclared should be deleted,
  // not left to quietly stop meaning anything.
  const undeclared = new Set(HEAD_MAP_AUDIT.filter((e) => e.category === "undeclared").map((e) => e.head));
  const stale = Object.keys(ALLOWED_UNDECLARED).filter((head) => !undeclared.has(head));
  expect(stale).toEqual([]);
});
