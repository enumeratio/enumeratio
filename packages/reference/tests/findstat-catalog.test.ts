// Every head FindStat matched by value carries a `catalog:` entry per matched id and carrier,
// and the carrier in `statOn` / `mapOn`. Regenerate with
// `vp node packages/reference/scripts/collect-findstat-catalog.ts`.

import { describe, expect, it } from "vite-plus/test";
import { referenceData } from "../src/node.ts";
import { wanted } from "../scripts/findstat-catalog.ts";

const byName = new Map(referenceData().entries.map((e) => [e.name, e]));

describe("FindStat matches are in their head's record", () => {
  const rows = wanted();

  it("has matches to check", () => expect(rows.length).toBeGreaterThan(400));

  it("every matched id and carrier is a catalog entry", () => {
    const missing = rows
      .filter(
        (r) =>
          !byName.get(r.head)?.catalog?.some((c) => c.system === "findstat" && c.identity === r.id && c.on === r.on),
      )
      .map((r) => `${r.head} ${r.id} on ${r.on}`);
    expect(missing).toEqual([]);
  });

  it("every matched carrier is in statOn or mapOn", () => {
    const missing = rows
      // A carrier's conversions are constructor overloads, not catalogued maps.
      .filter((r) => !(r.overloads === "mapOn" && byName.get(r.head)?.catalogCarrier))
      .filter((r) => !byName.get(r.head)?.[r.overloads]?.includes(r.on))
      .map((r) => `${r.head} ${r.overloads} lacks ${r.on}`);
    expect(missing).toEqual([]);
  });
});
