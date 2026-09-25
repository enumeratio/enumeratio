import { describe, expect, it } from "vite-plus/test";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { driver, keysOf } from "../src/drive.ts";

const json = (src: string) => parseNotatio(src).json as never;

describe("driver", () => {
  it("moves the focused control from raw terminal input and pins the expression there", () => {
    let screen = "";
    const d = driver(json("Manipulate(a + b, (a, 0, 1, 0.1), ((b, 2), 0, 5, 1))"), {
      show: () => "",
      write: (text) => (screen += text),
      color: false,
      mouse: false,
      cursorRow: () => 24,
      columns: () => 80,
    })!;
    d.draw();
    for (const chunk of ["\x1b[C", "\x1b[C", "\t", "\x1b[D"]) for (const k of keysOf(chunk)) d.key(k);
    expect(screen).toContain("a = 0.2");
    expect(screen).toContain("b = 1");
    expect(keysOf("\r").some((k) => d.key(k))).toBe(true);
  });

  it("names the keys a terminal sends", () => {
    expect(keysOf("\x1b[1;2C")).toEqual([{ name: "right", shift: true, sequence: "\x1b[1;2C" }]);
    expect(keysOf("L").map((k) => [k.name, k.shift])).toEqual([["l", true]]);
    expect(keysOf("\x1b[<0;10;3M")).toEqual([]);
  });
});

describe("a point control", () => {
  it("takes ←/→ as x and ↑/↓ as y, and marks its plot", () => {
    let screen = "";
    const d = driver(json("Row([Plot(Sin(x), (x, 0, 10)), Locator((p, (1, 0.5)))])"), {
      show: (e) => JSON.stringify(e),
      write: (text) => (screen += text),
      color: false,
      mouse: false,
      cursorRow: () => 24,
      columns: () => 200,
    })!;
    d.draw();
    for (const chunk of ["\x1b[C", "\x1b[1;2A"]) for (const k of keysOf(chunk)) d.key(k);
    expect(screen).toContain("p = (1.1, 1.5)");
    expect(JSON.stringify(d.pinned())).toContain('"Epilog"');
  });
});
