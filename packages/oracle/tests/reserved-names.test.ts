import { describe, expect, test } from "vite-plus/test";
import { LANES, laneNamespace, pythonNamespace } from "../scripts/reserved-names.ts";
import { isReserved, PYTHON_NAMES, reservedNames, RESERVED_RUNTIMES, spareName } from "../src/reserved.ts";

// What each Python lane's runtime holds is committed (src/reserved-names-data.ts) and read back
// here: a release that adds `S`, `beta` or a builtin is drift, and the fix is to rerun
//   node packages/oracle/scripts/collect-reserved-names.ts
// A runtime that isn't installed (the gate has no SymPy or Sage), or an interpreter of another
// minor release (its builtins differ), is skipped.

/** What differs between the committed set and the runtime's, as `+added` and `-removed`. */
const drift = (held: ReadonlySet<string>, found: readonly string[]): string[] => [
  ...found.filter((name) => !held.has(name)).map((name) => `+${name}`),
  ...[...held].filter((name) => !found.includes(name)).map((name) => `-${name}`),
];

describe("the sets are what the runtimes say", () => {
  const python = pythonNamespace();

  test.skipIf(python === undefined || python.version !== RESERVED_RUNTIMES.python)(
    "Python's keywords and builtins",
    () => {
      expect(drift(PYTHON_NAMES, python!.names)).toEqual([]);
    },
  );

  for (const lane of LANES) {
    test(`${lane}'s namespace`, () => {
      const found = laneNamespace(lane);
      if (found === undefined) return; // not installed here
      // A pinned runtime that moved: regenerate, don't compare across releases.
      expect(found.version).toBe(RESERVED_RUNTIMES[lane]);
      const held = new Set([...reservedNames(lane)!].filter((name) => !PYTHON_NAMES.has(name)));
      expect(
        drift(
          held,
          found.names.filter((name) => !PYTHON_NAMES.has(name)),
        ),
      ).toEqual([]);
    }, 240_000);
  }
});

describe("a spare name", () => {
  test("is the name with underscores, until the lane and the expression are both clear of it", () => {
    expect(spareName("mpmath", "e", new Set())).toBe("e_");
    expect(spareName("mpmath", "e", new Set(["e_", "e__"]))).toBe("e___");
    expect(spareName("sage", "lambda", new Set())).toBe("lambda_");
  });

  test("the lanes hold the names that matter", () => {
    expect(["lambda", "sum", "max", "len"].every((name) => isReserved("sympy", name))).toBe(true);
    expect(["S", "E", "I", "pi", "gamma", "beta"].every((name) => isReserved("sympy", name))).toBe(true);
    expect(["e", "pi", "j"].every((name) => isReserved("mpmath", name))).toBe(true);
    expect(["e", "pi", "I", "x"].every((name) => isReserved("sage", name))).toBe(true);
    // Wolfram's globals are `isSystemName`'s; Julia, Lean and Rust name no variable.
    expect(reservedNames("wolfram")).toBeUndefined();
    expect(isReserved("julia", "sum")).toBe(false);
  });
});
