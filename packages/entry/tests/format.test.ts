import { fmt } from "@enumeratio/config";
import { expect, test } from "vite-plus/test";
import { FORMAT } from "../src/format.ts";

// The record writer formats with FORMAT; `vp fmt` uses the shared config's style (its ignore
// list says which files `vp fmt` skips, not how a record is written).
test("the record writer's format is the shared config's", () => {
  const { ignorePatterns: _, ...style } = fmt;
  expect(FORMAT).toMatchObject(style);
});
