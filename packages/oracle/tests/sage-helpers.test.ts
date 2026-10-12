import { spawnSync } from "node:child_process";
import { expect, test } from "vite-plus/test";
import { runIn } from "../src/run.ts";

// The Sage helpers run in Sage; a machine without it (the gate) skips them.
const hasSage = spawnSync("sage", ["--version"], { stdio: "ignore" }).status === 0;

test.skipIf(!hasSage)(
  "a root list too long for Sage to build is refused up front, and costs only its own item",
  async () => {
    const [many, few, none] = await runIn("sage", [
      "enumeratio_power_mod_list(0, (1/2), ((3)^40))",
      "enumeratio_power_mod_list(0, (1/2), ((3)^6))",
      "enumeratio_power_mod_list(2, (1/2), 7)",
    ]);
    expect(many).toEqual({ error: expect.stringContaining("roots to list") });
    // 3^3 square roots of 0 mod 3^6: the bound lets a list this size through.
    expect(few).toHaveProperty("value");
    expect((few as { value: string }).value).toMatch(/^\[0, 27, 54,/);
    expect(none).toMatchObject({ value: "[3, 4]" });
  },
  120_000,
);

test.skipIf(!hasSage)(
  "a helper is visible inside the lambda a broadcast emit writes",
  async () => {
    const [threaded] = await runIn("sage", [
      "enumeratio_broadcast(lambda _a0, _a1: enumeratio_gcd(_a0, _a1), [2, 4], [6, 8])",
    ]);
    expect(threaded).toMatchObject({ value: "[2, 4]" });
  },
  120_000,
);
