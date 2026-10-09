import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it } from "vite-plus/test";
import { stripAnsi } from "../src/ansi.ts";
import { runCommand } from "../src/command.ts";
import { Session } from "../src/engine.ts";
import { figureText, plotText } from "../src/figure.ts";
import { sampledField, sampledPlot } from "../src/textual.ts";

// Not a head's value, so a golden of the drawing. Regenerate with `UPDATE_CELLS=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./cell-draw.golden.json", import.meta.url));
const updating = process.env.UPDATE_CELLS === "1";
const golden: Record<string, string> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, string> = {};

const session = new Session();
const drawn = (input: string, color = false): string => {
  const text = figureText(session.evaluate(input).expr.json as never, {
    color,
    plot: (json) => sampledPlot(session, json),
    field: (json) => sampledField(session, json),
  });
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
  labeled: 'Labeled(Permutation([3, 1, 2]), "σ")',
  grid: "Grid([[1, 2], [3, 4]])",
  ruled: "Grid([[1, 2], [3, 4]], Frame -> True, Dividers -> All)",
  panel: "Panel(Row([x, y]))",
  fraction: 'Row([1/2, x, "and", x^2])',
  plot: "Plot(Sin(x), (x, 0, 2 * Pi))",
  marked: "Plot(Sin(x), (x, 0, 10), Epilog -> Point((2, 0)))",
  vectors: "VectorPlot((-y, x), (x, -2, 2), (y, -2, 2))",
  streams: "StreamPlot((-y, x), (x, -2, 2), (y, -2, 2))",
  graph: 'GraphPlot({"edges" -> [["a", "b"], ["b", "c"], ["c", "a"]]}, Directed -> True)',
  torus: "TorusSquare(2, 3, Phase -> 0.32, Dials -> False)",
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

it("labels a plot's extremes, in a gutter that does not shift when a label changes width", () => {
  const sine = Array.from({ length: 200 }, (_, i) => ({ x: (i / 199) * 10, y: Math.sin((i / 199) * 10) }));
  const rows = plotText({ points: sine }, { width: 49, height: 6 }).split("\n");
  expect(rows).toHaveLength(8);
  expect(rows[0]).toMatch(/^ *1 │/);
  expect(rows[5]).toMatch(/^ *-1 │/);
  expect(rows[6]).toMatch(/└─{40}$/);
  expect(rows[7]).toMatch(/^ *0 +10$/);
  for (const k of [0.5, 12345, -0.000123]) {
    const wide = plotText({ points: sine.map((p) => ({ x: p.x, y: p.y * k })) }, { width: 49, height: 6 });
    expect(new Set(wide.split("\n").flatMap((l) => (l.includes("│") ? [l.indexOf("│")] : [])))).toEqual(new Set([8]));
  }
});

it("breaks a plot's line at a pole, and says when nothing is finite", () => {
  const points = [
    { x: -1, y: -1 },
    { x: 0, y: Number.NaN },
    { x: 1, y: 1 },
  ];
  expect((plotText({ points }, { width: 19, height: 4 }).match(/[⠁-⣿]/g) ?? []).length).toBe(2);
  expect(plotText({ points: [{ x: 0, y: Number.NaN }] })).toBe("(nothing to plot)");
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
