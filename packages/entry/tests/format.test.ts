import { fmt } from "@enumeratio/config";
import { expect, test } from "vite-plus/test";
import { FORMAT } from "../src/format.ts";

// The record writer formats with FORMAT; `vp fmt` uses the shared config's.
test("the record writer's format is the shared config's", () => {
  expect(FORMAT).toMatchObject(fmt);
});
