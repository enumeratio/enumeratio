import { expect, test } from "vite-plus/test";
import { textPlot } from "../src/textplot.ts";

const sine = Array.from({ length: 200 }, (_, i) => {
  const x = (i / 199) * 10;
  return { x, y: Math.sin(x) };
});

test("a sine wave fills the frame, top to bottom, with its extremes labelled", () => {
  const out = textPlot(sine, { width: 40, height: 6 });
  const lines = out.split("\n");
  expect(lines).toHaveLength(8);
  expect(lines[0]).toMatch(/^ *1 │/);
  expect(lines[5]).toMatch(/^ *-1 │/);
  expect(lines[6]).toMatch(/└─{40}$/);
  expect(lines[7]).toMatch(/^ *0 +10$/);
  // Every row of the curve has ink somewhere.
  for (const l of lines.slice(0, 6)) expect(l.slice(-40)).not.toBe("⠀".repeat(40));
});

test("a pole breaks the line rather than drawing across it", () => {
  const points = [
    { x: -1, y: -1 },
    { x: 0, y: Number.NaN },
    { x: 1, y: 1 },
  ];
  const out = textPlot(points, { width: 10, height: 4 });
  const ink = (out.match(/[⠁-⣿]/g) ?? []).length;
  expect(ink).toBe(2);
});

test("nothing finite is said so", () => {
  expect(textPlot([{ x: 0, y: Number.NaN }])).toBe("(nothing to plot)");
});
