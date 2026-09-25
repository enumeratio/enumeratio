import { DeadlineExceededError, withDeadline } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { factorInteger } from "../src/index.ts";

test("rho's checkpoint aborts under an already-expired deadline", () => {
  // Outside SMALL_PRIMES' trial-division range and not a perfect power, so factorInteger
  // reaches Pollard's rho — whose batch loop calls checkpoint() after every batch,
  // win or lose. A negative budget is already expired before the first call.
  const n = 10_007n * 10_009n;
  expect(() => withDeadline(-1, () => factorInteger(n))).toThrow(DeadlineExceededError);
});

test("a generous deadline does not interfere with a normal factorisation", () => {
  const n = 10_007n * 10_009n;
  expect(withDeadline(5_000, () => factorInteger(n))).toEqual([
    [10_007n, 1],
    [10_009n, 1],
  ]);
});
