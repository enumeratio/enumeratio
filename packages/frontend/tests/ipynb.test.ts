import { expect, test } from "vite-plus/test";
import { toIpynb } from "../src/ipynb.ts";

const cells = [
  { source: "a := 5", format: "epsil", output: { latex: "5", inputform: "5" } },
  { source: "Sqrt(a^2 + 1)", format: "epsil", output: { latex: "\\sqrt{26}", inputform: "Sqrt(26)" } },
  { source: "b", format: "epsil" },
  { source: "", format: "epsil" },
];

test("a notebook for Jupyter is code cells, each answer an output with TeX and text", () => {
  const nb = toIpynb(cells, { title: "Sums" }) as { nbformat: number; nbformat_minor: number; cells: any[] };
  expect([nb.nbformat, nb.nbformat_minor]).toEqual([4, 5]);
  expect(nb.cells.map((c) => c.cell_type)).toEqual(["markdown", "code", "code", "code"]);
  expect(nb.cells[2]).toEqual({
    cell_type: "code",
    id: "cell-2",
    execution_count: 2,
    metadata: { notatio: { format: "epsil" } },
    source: ["Sqrt(a^2 + 1)"],
    outputs: [
      {
        output_type: "execute_result",
        execution_count: 2,
        data: { "text/latex": ["$\\displaystyle \\sqrt{26}$"], "text/plain": ["Sqrt(26)"] },
        metadata: {},
      },
    ],
  });
  // A cell still waiting on its answer has no output yet.
  expect(nb.cells[3]).toMatchObject({ execution_count: null, outputs: [] });
});

test("a notebook for GitHub is Markdown: the source fenced, the answer as display math", () => {
  const nb = toIpynb(cells, { preset: "github" }) as { cells: any[] };
  expect(nb.cells.map((c) => c.cell_type)).toEqual(["markdown", "markdown", "markdown"]);
  expect(nb.cells[1].source.join("")).toBe("```epsil\nSqrt(a^2 + 1)\n```\n\n$$\n\\sqrt{26}\n$$");
});
