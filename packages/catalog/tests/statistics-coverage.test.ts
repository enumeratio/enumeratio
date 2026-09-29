// Moved here from @enumeratio/statistics (originally tests/coverage.test.ts) to break a
// devDependency cycle: statistics -> catalog -> combinatorics -> statistics, once collections
// and domains merged into combinatorics (design/speculative/combinatorics-layering-and-
// plausible.md). catalog already devDeps statistics' public API, so the drift check moved to
// the side of the edge that doesn't cycle.
import { STATS } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import {
  ALL_STATISTICS,
  blessedName,
  CARDINALITIES,
  FRONTIER,
  NATIVE_TO_ENGINE,
  signatureOf,
} from "@enumeratio/statistics/src";

/** Carriers this package claims to cover. A carrier is only listed once every statistic the
 *  catalog knows for it either has a definition or sits on the frontier — so this list is
 *  the progress marker, and the test below is what earns an entry on it. */
const COVERED = ["Permutation", "IntegerPartition", "DyckPath", "SetPartition"];

const defined = new Set(ALL_STATISTICS.map(signatureOf));
const onFrontier = new Set(FRONTIER.map((f) => `${f.head}@${f.on}`));
// Already compute-engine's — covered by needing nothing from us at all.
const native = new Set(NATIVE_TO_ENGINE.map((n) => `${n.head}@${n.on}`));
// Sizes of a collection the element indexes — answered by Count, not by a definition.
const counted = new Set(CARDINALITIES.map((c) => `${c.head}@${c.on}`));

test("every catalog statistic on a covered carrier is defined, native, or on the frontier", () => {
  const missing: string[] = [];
  for (const carrier of COVERED) {
    for (const stat of STATS.filter((s) => s.on.includes(carrier))) {
      const signature = `${blessedName(stat.name)}@${carrier}`;
      if (!defined.has(signature) && !onFrontier.has(signature) && !native.has(signature) && !counted.has(signature))
        missing.push(signature);
    }
  }
  expect(missing).toEqual([]);
});

test("nothing is both defined and on the frontier", () => {
  // The frontier is where a head goes when it CANNOT be defined. A head in both places means
  // one of the two claims is stale.
  expect([...defined].filter((s) => onFrontier.has(s))).toEqual([]);
});

test("every frontier entry says why", () => {
  for (const entry of FRONTIER) expect(entry.why.length, `${entry.head}@${entry.on}`).toBeGreaterThan(20);
});
