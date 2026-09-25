import { expect, test } from "vite-plus/test";
import { collectWolfram } from "../src/run.ts";

// The Wolfram lane's transcript, one marked line per form: the value, its N, its InputForm,
// the TeX pair, and for an arbitrary-precision value the digits Wolfram displays.

test("the displayed digits of an arbitrary-precision value come back as `shown`", () => {
  const transcript = [
    "<<1>>0.125`2.",
    "<<1#>>0.125`2.",
    "<<1|>>0.125`2.",
    "<<1~>>0.13",
    "<<2>>Pi",
    "<<2#>>3.141592653589793",
    "<<2|>>Pi",
  ].join("\n");
  const [tie, pi] = collectWolfram(transcript, 2);
  expect(tie).toEqual({
    value: "0.125`2.",
    numeric: "0.125`2.",
    display: "0.125`2.",
    shown: "0.13",
  });
  expect(pi).toEqual({ value: "Pi", numeric: "3.141592653589793", display: "Pi" });
});
