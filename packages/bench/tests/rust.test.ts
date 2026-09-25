// Structural checks on the generated Rust harness (design/benchmarking.md §4): no kernel, no
// cargo, just the emitted text. `generated.test.ts` checks the committed files match a fresh
// generation; these check what a fresh generation should contain.

import { describe, expect, test } from "vite-plus/test";
import { catalogPlan, planned } from "../src/generate.ts";
import { CACHES_RUST, generateRust, harnessRust } from "../src/generators/rust.ts";
import { PROTOCOL } from "../src/protocol.ts";

const plan = catalogPlan();
const files = generateRust(plan);
const main = files["src/main.rs"] as string;
const cases = planned(plan, "rust");

test("emits the crate's project files, and only those", () => {
  expect(Object.keys(files).sort()).toEqual(
    [".gitignore", "Cargo.toml", "rust-toolchain.toml", "src/main.rs"].sort(),
  );
  expect(main.length).toBeGreaterThan(0);
});

test("the crate depends on the oracle's adapters by path, not by copy", () => {
  expect(files["Cargo.toml"]).toContain('enumeratio-oracle = { path = "../../../oracle/rust" }');
});

test("target/ is ignored", () => {
  expect(files[".gitignore"]).toContain("target/");
});

test("every case planned for rust is present, by name", () => {
  for (const { name } of cases) expect(main.includes(JSON.stringify(name)), name).toBe(true);
});

test("the PROTOCOL numbers are embedded, not hard-coded", () => {
  for (const [key, value] of Object.entries(PROTOCOL)) {
    if (key === "version" || key === "tooFastNs") continue;
    expect(
      main.includes(`PROTOCOL_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`),
      key,
    ).toBe(true);
    expect(main.includes(String(value)), key).toBe(true);
  }
});

test("CACHES_RUST matches what the harness actually does: nothing to clear", () => {
  expect(CACHES_RUST).toBe("uncleared");
  // No per-sample clear hook in `measure`: it takes only a budget and a call.
  const measureFn = main.slice(main.indexOf("fn measure("), main.indexOf("struct CaseEntry"));
  expect(measureFn).not.toMatch(/clear/i);
});

test("each source is a zero-argument fn, compiled once, and the timed loop calls only it", () => {
  cases.forEach((c, i) => {
    c.sources.forEach((_source, j) => {
      const fnName = `b_${i}_${j}`;
      expect(main).toContain(`fn ${fnName}() -> V`);
      expect(main).toContain(fnName);
    });
  });
  // The timed region (inside `run_case`'s closure, through `measure`) never parses text: it
  // only calls the pre-built `calls` array of function pointers.
  const timedRegion = main.slice(main.indexOf("fn measure("), main.indexOf("fn json_string("));
  expect(timedRegion).not.toMatch(/serde_json|from_str|parse\(\)/);
});

test("literal constructors are black-boxed against constant folding", () => {
  for (const { sources } of cases) {
    for (const source of sources) {
      if (/\bn\(-?\d+\)/.test(source)) expect(main).toMatch(/n\(std::hint::black_box\(-?\d+\)\)/);
      if (/\bx\(/.test(source)) expect(main).toMatch(/x\(std::hint::black_box\(/);
    }
  }
  // The result of every timed call is black-boxed too, or the loop could be optimised away.
  expect(main).toMatch(/next \+= 1;\s*black_box\(v\);/);
});

test("an unknown case name and a case-not-found are both handled, not left to crash", () => {
  expect(main).toContain('"no case {name}"');
});

test("the crate is built before the run, and the binary runs directly", () => {
  const command = harnessRust();
  expect(command.cwd).toContain("generated/rust");
  expect(command.prepare).toEqual({ command: "cargo", args: ["build", "--release", "--quiet"] });
  expect(command.command).toMatch(/generated\/rust\/target\/release\/bench$/);
});

describe("regenerating is deterministic", () => {
  test("the same plan yields byte-identical output", () => {
    expect(generateRust(plan)).toEqual(files);
  });
});
