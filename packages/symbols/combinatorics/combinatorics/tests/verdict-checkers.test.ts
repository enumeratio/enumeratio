// The verdict cache leaves manifest's record-derived dist out of its key (scripts/verdicts.ts),
// which holds only while the cross-checks run on a bare engine with nothing declared.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { checkers } from "../scripts/verdicts.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("verdict checkers", () => {
  const files = [...checkers.maps, ...checkers.statistics, "scripts/family-checks.ts"].filter((f) => f.endsWith(".ts"));
  it.each(files)("%s checks on a bare engine", (file) => {
    expect(read(file)).not.toMatch(/\bcreateEngine\b|\bcreateLatexEngine\b|\bdeclare[A-Z]\w*\b/);
  });
});
