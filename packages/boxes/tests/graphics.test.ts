import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import {
  type Box,
  declareBoxes,
  disk,
  fromMathJson,
  graphics,
  graphicsComplex,
  inset,
  isBox,
  line,
  polygon,
  polyhedron,
  row,
  style,
  tag,
  toMathJson,
} from "../src/index.ts";
import { toLatex, toMathML, toText } from "../src/render/index.ts";

// Two marks, a link and a caption: the shape a figure frame lowers to.
const figure: Box = graphics(
  graphicsComplex(
    row([
      style(tag(disk({ Radius: 0.12 }), "0,0"), { FaceForm: "#d97706" }),
      style(tag(disk({ Radius: 0.12, Center: [1, 0.5] }), "1,0"), { FaceForm: "#d97706" }),
      tag(inset("a", { Center: [0, 0], Size: 0.4, Opacity: 0.5, Role: "Caption" }), "0,0"),
      style(
        tag(
          line({
            Points: [
              [0, 0],
              [0.5, 0.2],
              [1, 0.5],
            ],
            Breaks: [2],
          }),
          "0,0;1,0",
        ),
        {
          EdgeForm: [["#d97706", 2, 1, []]],
        },
      ),
      tag(
        polygon({
          Points: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        }),
        "2,0",
      ),
      tag(
        polyhedron({
          Faces: [
            [
              [0, 0, 0],
              [1, 0, 0],
              [0, 1, 0],
            ],
          ],
        }),
        "3,0",
      ),
    ]),
    {
      Addresses: [
        [0, 0],
        [1, 0],
      ],
      Places: [
        [0, 0],
        [1, 0.5],
      ],
    },
  ),
  { ColorMixing: "First", Selection: [[0, 0]], ViewKind: "fixed" },
);

test("a graphics box is a box, and round-trips as MathJSON", () => {
  expect(isBox(figure)).toBe(true);
  expect(fromMathJson(toMathJson(figure))).toEqual(figure);
});

test("a malformed primitive is not a box", () => {
  expect(isBox(["DiskBox", 1])).toBe(false);
  expect(isBox(["GraphicsBox"])).toBe(false);
  expect(isBox(["InsetBox", { Size: 1 }])).toBe(false);
});

test("a drawing reads as Wolfram prints it, in every serialiser", () => {
  expect(toText(figure)).toBe("-Graphics-");
  expect(toLatex(figure)).toBe("\\text{-Graphics-}");
  expect(toMathML(figure, { fragment: true })).toBe("<mtext>-Graphics-</mtext>");
});

test("the graphics heads are declared inert boxes", () => {
  const ce = new ComputeEngine();
  declareBoxes(ce);
  const json = toMathJson(figure);
  const evaluated = ce.box(json as never).evaluate();
  expect(evaluated.type.toString()).toBe("boxes");
  expect(fromMathJson(evaluated.json as never)).toEqual(figure);
});
