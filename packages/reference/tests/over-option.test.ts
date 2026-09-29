// A-85: `Over -> R` retires the `GaussianIntegers -> True` option KEY (a key is never a
// domain/collection name), and the plural rejoin folds every carrier's plural type-space name
// and `Element` membership into its own `declareCarriers` call by default — including on the
// REFERENCE engine, which used to skip that step entirely (see structures' `carriers.ts` and
// combinatorics' own `declareCarrierPlurals` step in `scripts/engines.ts`). This pins both: the
// option itself works on the fully-declared reference engine, and it does so with the carrier
// plurals actually declared, not despite them being skipped.

import { expect, test } from "vite-plus/test";
import { declaredEngine } from "../scripts/engines.ts";

test("IsPrime(2, Over -> GaussianIntegers) works on the reference engine, plurals declared", () => {
  const ce = declaredEngine();

  // The plural rejoin actually happened: `GaussianIntegers` is a real `set<gaussian_integer>`
  // symbol here, not left undeclared the way the reference engine used to leave it.
  expect(ce.lookupDefinition("GaussianIntegers")).toBeDefined();
  expect(String(ce.box("GaussianIntegers").type)).toBe("set<gaussian_integer>");

  // 2 ramifies in ℤ[i] (2 = -i(1+i)²), so it is no longer prime there — the same answer
  // `IsPrime(2, GaussianIntegers -> True)` gave before the option's key retired.
  expect(ce.box(["IsPrime", 2, ["KeyValuePair", "Over", "GaussianIntegers"]]).evaluate().json).toBe("False");
  // Over -> Integers, the default, is the ordinary rational-integer answer.
  expect(ce.box(["IsPrime", 2, ["KeyValuePair", "Over", "Integers"]]).evaluate().json).toBe("True");
  expect(ce.box(["IsPrime", 2]).evaluate().json).toBe("True");

  // The retired key spelling is not read as this option any more: it neither errors nor
  // silently answers as if `Over` were given — the call just stays unevaluated.
  const retired = ce.box(["IsPrime", 2, ["KeyValuePair", "GaussianIntegers", "True"]]).evaluate();
  expect(retired.operator).toBe("IsPrime");

  // Element(x, GaussianIntegers) — the carrier's own membership, also folded in by default now.
  expect(ce.box(["Element", ["GaussianInteger", ["Tuple", 1, 1]], "GaussianIntegers"]).evaluate().json).toBe("True");
});
