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

test.skipIf(!hasSage)(
  "a profinite number of modulus 0 prints as its rational, any other as ours spells it",
  async () => {
    const [rational, profinite] = await runIn("sage", ["Qhat((1/3), 0)", "Qhat(100, 24)"]);
    expect(rational).toMatchObject({ value: "1/3" });
    expect(profinite).toMatchObject({ value: '["ProfiniteNumber", 4, 24]' });
  },
  120_000,
);

test.skipIf(!hasSage)(
  "Zeta(s, a) takes ((n + a)^2)^(-s/2) before the sum turns positive, whatever a's type",
  async () => {
    // Each is 2.5^-3 + 1.5^-3 + 0.5^-3 + zeta(3, 0.5) = 16.77...
    const answers = await runIn("sage", [
      "enumeratio_n(enumeratio_zeta_pair(3, (-5/2)))",
      "enumeratio_n(enumeratio_zeta_pair(3, -2.5))",
      "enumeratio_n(enumeratio_zeta_pair(3, (-2.5 + 0*I)))",
    ]);
    for (const answer of answers) expect(answer).toMatchObject({ value: expect.stringMatching(/^16\.7746946/) });
  },
  120_000,
);
