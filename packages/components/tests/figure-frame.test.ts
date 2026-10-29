import { expect, it } from "vite-plus/test";
import { captionPlacement, COMPACT_HEIGHT } from "../src/figure-frame.ts";

it("drops the caption of a compact glyph, not of a plot", () => {
  expect(captionPlacement("", 72)).toBe("none");
  expect(captionPlacement("", COMPACT_HEIGHT)).toBe("none");
  expect(captionPlacement("", 480)).toBe("below");
});

it("lets caption-at override the height", () => {
  expect(captionPlacement("below", 72)).toBe("below");
  expect(captionPlacement("none", 480)).toBe("none");
  expect(captionPlacement("sideways", 480)).toBe("below");
});
