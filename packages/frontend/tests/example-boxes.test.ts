// A reference example whose value draws can state the shape of the box it lowers to (`boxes` in
// examples.tsv, a `BoxShape`): its head, the marks and roles in it by count, key options, operands.
// The example is evaluated and lowered here, in Node, with a plot of an expression sampled as the
// page samples it. This is where a graphics head's example is tested: reference can't import this
// package (it depends on reference), and there is nothing to compare pixel by pixel.
// Evaluating the same example to its held value is reference's `entries.test.ts`.

import { loadReferenceData, PACKAGES } from "@enumeratio/reference/node";
import { expect, test } from "vite-plus/test";
import { declaredEngine } from "../../reference/scripts/engines.ts";
import { boxOfExample, settledShape, shapeOf } from "../scripts/example-boxes.ts";

const { heads } = loadReferenceData(PACKAGES);
const rows = heads.flatMap(({ head, entry }) =>
  entry.examples.flatMap((example) =>
    example.boxes === undefined ? [] : [[`${head}/${example.id}`, example] as const],
  ),
);
const ce = declaredEngine();

test.each(rows)("%s lowers to the box its record states", (_, example) => {
  expect(settledShape(shapeOf(boxOfExample(ce, example.expr), example.boxes!))).toEqual(settledShape(example.boxes!));
});

test("some example states a box shape", () => {
  expect(rows.length).toBeGreaterThan(0);
});

test("a role reaches every mark in a row, and an address names none", () => {
  const point = ["PointBox", { Points: [[0, 0]] }];
  const line = [
    "LineBox",
    {
      Points: [
        [0, 0],
        [1, 1],
      ],
    },
  ];
  const plot = ["GraphicsBox", ["TagBox", ["RowBox", [point, line]], "Series"], {}] as never;
  const figure = [
    "GraphicsBox",
    [
      "RowBox",
      [
        ["TagBox", point, "0,1"],
        ["TagBox", line, "0,1;1,2"],
      ],
    ],
    {},
  ] as never;
  const asked = { head: "GraphicsBox", marks: {}, roles: {} };
  expect(shapeOf(plot, asked)).toEqual({
    head: "GraphicsBox",
    marks: { PointBox: 1, LineBox: 1 },
    roles: { Series: 2 },
  });
  expect(shapeOf(figure, asked)).toEqual({ head: "GraphicsBox", marks: { PointBox: 1, LineBox: 1 }, roles: {} });
});
