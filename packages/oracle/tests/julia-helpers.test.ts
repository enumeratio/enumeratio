import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { runIn } from "../src/run.ts";

// The Julia helpers run in Julia with Nemo and Combinatorics.jl installed in packages/oracle/julia; a machine
// without them (the gate) skips them. The probe only asks Julia to locate the packages, which is quick and
// never precompiles, and is cut off at 30 s.
const project = fileURLToPath(new URL("../julia", import.meta.url));
const hasJulia =
  spawnSync(
    "julia",
    [
      `--project=${project}`,
      "--startup-file=no",
      "-e",
      'exit(Base.find_package("Nemo") !== nothing && Base.find_package("Combinatorics") !== nothing ? 0 : 1)',
    ],
    { stdio: "ignore", timeout: 30_000, killSignal: "SIGKILL" },
  ).status === 0;

// What each of these once answered with a tight ball that was wrong, or agreed with by accident.
test.skipIf(!hasJulia)(
  "a ball that does not vouch for its answer is an error, never a value",
  async () => {
    const [lerch, digits, round, infinite, theta] = await runIn("julia", [
      // The series cannot reach its tail bound this close to |z| = 1.
      'enumeratio_lerch(enumeratio_decimal("0.999999"), -1, 1)',
      // exp(x) - 1 - x at x = 1e-30 is 5e-61: 50 digits need the retry at more bits, and are right.
      'enumeratio_nshow(enumeratio_ball(exp, enumeratio_decimal("1e-30")) - 1 - enumeratio_decimal("1e-30"), 50)',
      // exp(log(7/2)) is 3.5 to within the ball, so it has no rounding.
      "enumeratio_round(enumeratio_ball(exp, enumeratio_ball(log, enumeratio_div(7, 2))))",
      // An infinite intermediate is a NaN ball, which says nothing about the value.
      "enumeratio_ball(abs, Inf * onei(CC))",
      // The nome 0 has no logarithm; the series is its constant term.
      'enumeratio_theta(3, enumeratio_decimal("0.5"), 0)',
    ]);
    expect(lerch).toEqual({ error: expect.stringContaining("ball too wide") });
    expect(digits).toHaveProperty("value");
    expect((digits as { value: string }).value).toMatch(/^5\.0{29}1666/);
    expect(round).toHaveProperty("error");
    expect(infinite).toEqual({ error: expect.stringContaining("ball not finite") });
    expect(theta).toMatchObject({ value: "1.0" });
  },
  300_000,
);

test.skipIf(!hasJulia)(
  "a decimal is exact: 0.1 is no double, and 1e-400 does not underflow",
  async () => {
    const [tenth, tiny, ties] = await runIn("julia", [
      'enumeratio_ball(x -> x - CC(1) / 10, enumeratio_decimal("0.1"))',
      'enumeratio_ball(x -> x, enumeratio_decimal("1e-400"))',
      // N writes d digits, ties to the even digit, as Wolfram shows N[1/8, 2] and N[3/8, 2].
      "Any[enumeratio_nshow(enumeratio_div(1, 8), 2), enumeratio_nshow(enumeratio_div(3, 8), 2)]",
    ]);
    expect(Math.abs(Number((tenth as { value: string }).value))).toBeLessThan(1e-70);
    expect((tiny as { value: string }).value).toMatch(/e-40[01]$/);
    expect(ties).toMatchObject({ value: "[1.2e-01, 3.8e-01]" });
  },
  300_000,
);
