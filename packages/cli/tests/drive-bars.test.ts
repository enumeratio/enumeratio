// A bar is boxed as a row of single-entry boxes, and the keyboard driver and the terminal drawer
// read it back as the one control it is.

import { expect, test } from "vite-plus/test";
import { parseExpression } from "@enumeratio/formats/expression";
import { driver, keysOf } from "../src/drive.ts";
import { figureText } from "../src/figure.ts";

const json = (src: string) => parseExpression(src).json as never;

test("each bar is one control in the driver, whatever its number of entries", () => {
  let screen = "";
  const d = driver(
    json('Column([SetterBar((k, 2), [2, 3, 5]), RadioButtonBar(q, ["a", "b"]), TogglerBar(s, [1, 2])])'),
    {
      show: () => "",
      write: (text) => (screen += text),
      color: false,
      mouse: false,
      cursorRow: () => 24,
      columns: () => 80,
    },
  )!;
  d.draw();
  expect(screen.match(/^ {2}[kqs] = /gm)).toEqual(["  k = ", "  q = ", "  s = "]);
  for (const key of keysOf("\x1b[C")) d.key(key);
  expect(screen).toContain("k = 3");
  expect(JSON.stringify(d.pinned())).toContain("3");
});

test("the drawer shows a bar as one line, the chosen entry bracketed", () => {
  expect(figureText(json('Column([SetterBar((k, 3), [2, 3, 5]), RadioButtonBar((q, "b"), ["a", "b"])])'))).toBe(
    "k 2  [3]  5\nq a  [b]",
  );
});
