import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { ENVIRONMENTS } from "@enumeratio/notatio";
import { afterAll, expect, test } from "vite-plus/test";
import { visualMarkup } from "../src/visual.ts";

// The Out half of a `Cell`: reduction stops at the Cell (its operand is input source),
// so the Out reduces its own value before drawing it -- on paper a slider is pinned or
// sampled, not drawn live and unmovable. Each source is a Cell's operand, which is what
// its Out evaluates to: the graphics heads are held. Golden JSON compared with `toEqual`
// (AGENTS.md); regenerate with `UPDATE_VISUAL=1 vp test`.
const OUTS = [
  "Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])",
  "Manipulate(Plot(Sin(a * x), (x, 0, 10)), (a, 1, 5))",
];

const GOLDEN = fileURLToPath(new URL("./visual.golden.json", import.meta.url));
const updating = process.env.UPDATE_VISUAL === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const src of OUTS) {
  const { json, errors } = parseNotatio(src);
  expect(errors).toEqual([]);
  for (const env of ENVIRONMENTS) {
    const key = `${env.name}: Cell(${src})`;
    test(key, () => {
      const markup = visualMarkup(json, env);
      if (updating) {
        fresh[key] = markup;
        return;
      }
      expect(markup).toEqual(golden[key]);
    });
  }
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + "\n");
});
