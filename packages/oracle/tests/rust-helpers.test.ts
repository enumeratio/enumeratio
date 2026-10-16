import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { runIn } from "../src/run.ts";

// The Rust adapters build against the crates pinned in packages/oracle/rust, on the toolchain
// its rust-toolchain.toml names. A machine without either (the gate) skips them: the probe
// asks rustup for the toolchain without installing it, then builds the adapters from the crates
// already downloaded, which the batches below would have to do anyway.
const crate = fileURLToPath(new URL("../rust", import.meta.url));
const probe = (command: string, args: string[], timeout: number): boolean =>
  spawnSync(command, args, {
    cwd: crate,
    env: { ...process.env, RUSTUP_AUTO_INSTALL: "0" },
    stdio: "ignore",
    timeout,
    killSignal: "SIGKILL",
  }).status === 0;
const hasRust =
  probe("rustup", ["which", "cargo"], 30_000) && probe("cargo", ["build", "--offline", "--quiet"], 300_000);

type Answer = { value: string } | { error: string };
const value = (answer: Answer | undefined): string => (answer !== undefined && "value" in answer ? answer.value : "");
const error = (answer: Answer | undefined): string => (answer !== undefined && "error" in answer ? answer.error : "");

// What each of these once answered with, or agreed to by accident.
test.skipIf(!hasRust)(
  "a NaN or an infinity is an error, never a value to agree with",
  async () => {
    const [nan, infinity, overflow, literal, zero] = (await runIn("rust", [
      "sqrt(n(-1))",
      "(n(1) / tanh(n(0)))",
      "nf(factorial(n(1000)))",
      // A literal is the double it names: only a computed float is checked.
      "x(2.5)",
      "signum(n(0))",
    ])) as Answer[];
    expect(error(nan)).toContain("non-finite");
    expect(error(infinity)).toContain("non-finite");
    expect(error(overflow)).toContain("non-finite");
    expect(value(literal)).toBe("2.5");
    expect(value(zero)).toBe("0");
  },
  300_000,
);

test.skipIf(!hasRust)(
  "a float identity holds relative to its size, so rounding noise is not zero",
  async () => {
    const [noise, close, exact, cap, counted] = (await runIn("rust", [
      "equal(sin(x(std::f64::consts::PI)), n(0))",
      "equal(x(1.0000000001), x(1.0))",
      "equal(sin(n(0)), n(0))",
      // A size cap, not a clock: past it the count is refused on every host.
      "prime_pi(n(100000000000))",
      "prime_pi(n(1000))",
    ])) as Answer[];
    expect(value(noise)).toBe("false");
    expect(value(close)).toBe("true");
    expect(value(exact)).toBe("true");
    expect(error(cap)).toContain("too large");
    expect(value(counted)).toBe("168");
  },
  300_000,
);

test.skipIf(!hasRust)(
  "an operand a crate cannot hold says why",
  async () => {
    const [negative, large, fractional, argument, adic] = (await runIn("rust", [
      "is_prime(n(-7))",
      "is_prime((n(1) + power(n(2), n(128))))",
      "quotient(rational(n(7), n(2)), n(2))",
      "beta(n(-1), n(2))",
      "adic_digits(adic(n(5), n(0)), n(3))",
    ])) as Answer[];
    expect(error(negative)).toContain("unsigned");
    expect(error(large)).toContain("2^64");
    expect(error(fractional)).toContain("an integer");
    expect(error(argument)).toContain("ANotGreaterThanZero");
    expect(error(adic)).toContain("unit part");
  },
  300_000,
);

test.skipIf(!hasRust)(
  "the adapters answer exactly where the crates are exact, in the shape ours has",
  async () => {
    const [digits, gcd, floor, ties, padded] = (await runIn("rust", [
      "integer_digits(n(-58127), n(16))",
      "extended_gcd(n(6), n(4))",
      "quotient(n(-7), n(2))",
      "list(vec![round(rational(n(5), n(2))), round(rational(n(-5), n(2))), round(x(2.5))])",
      // A terminating expansion goes on in zeros, as an infinite one does.
      "adic_digits(adic(n(5), rational(n(7), n(25))), n(5))",
    ])) as Answer[];
    expect(value(digits)).toBe("[14, 3, 0, 15]");
    expect(value(gcd)).toBe("[2, 1, -1]");
    expect(value(floor)).toBe("-4");
    // Ties go away from zero, as num-rational's and std's do.
    expect(value(ties)).toBe("[3, -3, 3.0]");
    expect(value(padded)).toBe("[2, 1, 0, 0, 0]");
  },
  300_000,
);
