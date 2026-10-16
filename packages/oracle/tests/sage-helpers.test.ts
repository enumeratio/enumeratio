import { spawnSync } from "node:child_process";
import { expect, test } from "vite-plus/test";
import { symbolicAgreementSource } from "../src/symbolic.ts";
import { runIn } from "../src/run.ts";

// The Sage helpers run in Sage; a machine without it (the gate) skips them.
const hasSage = spawnSync("sage", ["--version"], { stdio: "ignore" }).status === 0;

test.skipIf(!hasSage)(
  "a root list too long for Sage to build is refused up front, and costs only its own item",
  async () => {
    const [many, few, none, unit] = await runIn("sage", [
      "enumeratio_power_mod_list(0, (1/2), ((3)^40))",
      "enumeratio_power_mod_list(0, (1/2), ((3)^6))",
      "enumeratio_power_mod_list(2, (1/2), 7)",
      "enumeratio_power_mod_list(8, (-1/2), 12)",
    ]);
    expect(many).toEqual({ error: expect.stringContaining("roots to list") });
    // 3^3 square roots of 0 mod 3^6: the bound lets a list this size through.
    expect(few).toHaveProperty("value");
    expect((few as { value: string }).value).toMatch(/^\[0, 27, 54,/);
    expect(none).toMatchObject({ value: "[3, 4]" });
    // A negative power of a non-unit has no root, as in ours.
    expect(unit).toMatchObject({ value: "[]" });
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

const X = 'SR.var("x")';

test.skipIf(!hasSage)(
  "a series agrees only where it is a sum of integer powers Sage's own expansion stands for, to a relative 2^-150",
  async () => {
    const taylor = `${X} - ${X}^3/6`;
    const [agrees, small, tiny, root, absolute, power, laurent] = await runIn("sage", [
      `enumeratio_series_agree(sin(${X}), ${taylor}, ${X}, 0, 5, None)`,
      // A wrong coefficient of 1e-12 is no zero, and neither is 1/14!.
      `enumeratio_series_agree(sin(${X}), ${taylor} + ${X}^4/10^12, ${X}, 0, 5, None)`,
      `enumeratio_series_agree(sin(${X}), ${taylor} + ${X}^4/factorial(14), ${X}, 0, 5, None)`,
      // Sage's series of an expression that is no power series is 1 + O(x^n): it stands for nothing.
      `enumeratio_series_agree(sqrt(${X}), 1, ${X}, 0, 4, None)`,
      `enumeratio_series_agree(sqrt(${X}^2), 1, ${X}, 0, 4, None)`,
      `enumeratio_series_agree(${X}^(3/2), 1, ${X}, 0, 4, None)`,
      `enumeratio_series_agree(cot(${X}), 1/${X} - ${X}/3 - ${X}^3/45, ${X}, 0, 4, None)`,
    ]);
    expect([agrees, small, tiny, root, absolute, power, laurent]).toMatchObject([
      { value: "True" },
      { value: "False" },
      { value: "False" },
      { value: "None" },
      { value: "None" },
      { value: "None" },
      { value: "True" },
    ]);
  },
  120_000,
);

test.skipIf(!hasSage)(
  "an antiderivative agrees only where the difference is constant at points of both signs",
  async () => {
    const poles = `(${X}+13/4)*(${X}+7/3)*(${X}+1/2)`;
    const [constant, wrong, oneSided] = await runIn("sage", [
      `enumeratio_antiderivative_agree(-cos(${X}), 1 - cos(${X}), [${X}])`,
      `enumeratio_antiderivative_agree(-cos(${X}), cos(${X}), [${X}])`,
      // The difference is -1 wherever it is defined, but it is undefined at every negative sample point.
      `enumeratio_antiderivative_agree(log(1/(${poles})), 1 - log(${poles}), [${X}])`,
    ]);
    expect([constant, wrong, oneSided]).toMatchObject([{ value: "True" }, { value: "False" }, { value: "None" }]);
  },
  120_000,
);

test.skipIf(!hasSage)(
  "a transform's answer variable is sampled after the call, not passed to it as a number",
  async () => {
    const laplace = symbolicAgreementSource(
      "sage",
      ["LaplaceTransform", ["Power", "t", 3], "t", "s"],
      ["Divide", 6, ["Power", "s", 4]],
      ["t", "s"],
    );
    const inverse = symbolicAgreementSource(
      "sage",
      ["InverseLaplaceTransform", ["Divide", 1, ["Power", "s", 2]], "s", "t"],
      "t",
      ["s", "t"],
    );
    expect(laplace).toBeDefined();
    expect(inverse).toBeDefined();
    expect(await runIn("sage", [laplace!, inverse!])).toMatchObject([{ value: "True" }, { value: "True" }]);
  },
  120_000,
);
