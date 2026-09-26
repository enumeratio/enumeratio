// Before/after equivalence for symbol-metadata step 3 (design/speculative/symbol-metadata.md):
// `naming.ts`'s `RENAMED` now also lives as a `formerly:` field on the head it renamed to
// (packages/reference/scripts/migrate/renamed-to-yaml.ts), rebuilt into `naming-data.ts`
// (scripts/collect-naming.ts). This pins that the generated table and the hand table agree
// while both exist; a follow-up commit deletes `RENAMED` and this test switches to asserting
// `naming-data.ts` is current instead.

import { expect, test } from "vite-plus/test";
import { RENAMED } from "../src/naming.ts";
import { RENAMED_DATA } from "../src/naming-data.ts";

test("the generated rename table agrees with the hand-kept one", () => {
  expect(RENAMED_DATA).toEqual(RENAMED);
});
