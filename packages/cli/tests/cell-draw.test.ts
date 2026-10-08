import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it } from "vite-plus/test";
import { stripAnsi } from "../src/ansi.ts";
import { runCommand } from "../src/command.ts";
import { Session } from "../src/engine.ts";
import { figureText } from "../src/figure.ts";

// Not a head's value, so a golden of the drawing. Regenerate with `UPDATE_CELLS=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./cell-draw.golden.json", import.meta.url));
const updating = process.env.UPDATE_CELLS === "1";
const golden: Record<string, string> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, string> = {};

const session = new Session();
const drawn = (input: string, color = false): string => {
  const text = figureText(session.evaluate(input).expr.json as never, { color });
  if (text === undefined) throw new Error(`no figure for ${input}`);
  return text;
};

const CASES: Record<string, string> = {
  strands: "Permutation([3, 1, 2])",
  tree: "PlaneTree([2, 1, 0, 0])",
  path: "DyckPath([1, 1, 0, 1, 0, 0])",
  partition: "IntegerPartition([4, 2, 1])",
  tableau: "StandardTableau([[1, 2, 4], [3]])",
  show: "Show(TreeDiagram(PlaneTree([2, 0, 0])))",
};

for (const [name, input] of Object.entries(CASES)) {
  it(`draws ${name} on cells`, () => {
    const text = drawn(input);
    fresh[name] = text;
    expect(text.length).toBeGreaterThan(0);
    // Every row fits the width, and nothing is left trailing.
    for (const row of text.split("\n")) {
      expect(Array.from(row).length).toBeLessThanOrEqual(60);
      expect(row).toBe(row.trimEnd());
    }
    if (!updating) expect(text).toBe(golden[name]);
  });
}

it("colors the marks with their rules' colors, and only when asked", () => {
  const plain = drawn(CASES.strands!);
  const colored = drawn(CASES.strands!, true);
  expect(colored).toContain("\x1b[38;5;");
  expect(stripAnsi(colored)).toBe(plain);
});

it("is what `notatio show` prints, and a plain result prints as eval does", () => {
  expect(runCommand(["show", CASES.partition!])).toEqual({
    stdout: `${drawn(CASES.partition!)}\n`,
    stderr: "",
    code: 0,
  });
  expect(runCommand(["show", "1 + 2"]).stdout).toBe(runCommand(["1 + 2"]).stdout);
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
