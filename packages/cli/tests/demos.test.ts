import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vite-plus/test";
import { type Demo, DEMOS, Repl } from "../src/browser.ts";

// Every demo in the corpus is a golden transcript: a fresh REPL evaluates its
// lines in order and the styled result (ANSI and all) is captured. The goldens
// live in a committed JSON file compared with `toEqual` -- deliberately NOT
// `toMatchSnapshot`, whose client isn't set up when the `test` task runs through
// `vp run` (the path `vp run -r test` / CI uses), only under a bare `vp test`.
// Regenerate with `UPDATE_DEMOS=1 vp test` after an intended output change.
function transcript(demo: Demo) {
  const repl = new Repl({ color: true });
  return demo.lines.map((line) => {
    const out = repl.eval(line);
    return { in: line, out: out.text, graphic: out.graphic?.kind };
  });
}

const GOLDEN = fileURLToPath(new URL("./demos.golden.json", import.meta.url));
const updating = process.env.UPDATE_DEMOS === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const demo of DEMOS) {
  test(`demo: ${demo.id}`, () => {
    const t = transcript(demo);
    if (updating) {
      fresh[demo.id] = t;
      return;
    }
    expect(t).toEqual(golden[demo.id]);
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

test("every demo runs without throwing and highlights are a subset", () => {
  for (const demo of DEMOS) expect(() => transcript(demo)).not.toThrow();
  expect(DEMOS.some((d) => d.highlight)).toBe(true);
});
