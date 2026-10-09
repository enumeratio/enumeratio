import { expect, test } from "vite-plus/test";
import { parseExpression } from "@enumeratio/formats/expression";
import { figureText } from "../src/figure.ts";

const draw = (src: string) => figureText(parseExpression(src).json as never);

test("a slider is a track with a marker and its value, and a Dynamic is written at its value (the session evaluates it)", () => {
  expect(draw("Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])")).toBe("k ━━━━●━━━━━━━ 2 2²");
});

test("each kind of control draws by its intent", () => {
  const column = draw(
    'Column([PopupMenu((c, "b"), ["a", "b"]), Checkbox((on, True)), Slider2D((p, (1, 1)), ((0, 0), (2, 2)))])',
  );
  expect(column).toBe("c a  [b]\non [x]\np ⌖ (1, 1)");
});
