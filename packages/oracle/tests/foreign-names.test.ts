import { spawnSync } from "node:child_process";
import { fromWolfram, SYSTEM_NAMES } from "@enumeratio/wolfram";
import { describe, expect, test } from "vite-plus/test";
import { emit, type MathJSON } from "../src/emit.ts";
import type { Mapping } from "../src/mappings.ts";
import { reservedNames, restoreNames, SAGE_UNBINDABLE } from "../src/reserved.ts";
import { runIn } from "../src/run.ts";
import type { System } from "../src/systems.ts";

// Per format: an expression whose free and bound variables are exactly the names the other side
// reserves goes out, is evaluated or read back there, and means what it meant. Needs no examples.

const iterate = (v: string): MathJSON => ["Sum", ["Multiply", v, 2], ["Tuple", v, 1, 3]];

/** The names of `system`'s namespace that emit treats as variables (not ours, not a constant). */
const variables = (system: System): string[] =>
  [...(reservedNames(system) ?? [])].filter((name) => {
    const emitted = emit(name, system);
    return emitted.ok && emitted.freeSymbols !== undefined;
  });

test("Wolfram: every System name survives as a free variable, and as a Sum index", () => {
  const names = SYSTEM_NAMES.filter((name) => {
    const emitted = emit(name, "wolfram");
    return emitted.ok && emitted.freeSymbols !== undefined;
  });
  // `Names["System`*"]` has thousands of symbols that are plain variables to us.
  expect(names.length).toBeGreaterThan(5000);
  for (const expr of [
    ["List", ...names],
    ["List", ...names.map(iterate)],
  ] as MathJSON[]) {
    const emitted = emit(expr, "wolfram");
    expect(emitted.ok && fromWolfram(emitted.source)).toEqual(expr);
  }
  // None of them reaches the kernel bare, where it would be Wolfram's own.
  expect(emit(iterate("E"), "wolfram")).toMatchObject({
    source: "Sum[Times[enumeratio`E, 2], List[enumeratio`E, 1, 3]]",
  });
});

// A library's own rows (`mappingsFromBindings`), as a lane would add them: a sum over an index.
const sumRows = (system: "mpmath" | "sage", sum: string): Mapping[] => [
  { head: "Sum", arity: 2, emit: { [system]: sum } },
  { head: "Tuple", arity: 3, emit: { [system]: "$1" } },
];

describe("bound names a lane holds are written under another name", () => {
  test("a Python keyword, a builtin and an imported constant", () => {
    const rows = sumRows("mpmath", "nsum(lambda $2: $1, [1, 3])");
    expect(emit(["Sum", ["Multiply", "ExponentialE", "e"], ["Tuple", "e", 1, 3]], "mpmath", rows)).toEqual({
      ok: true,
      source: "nsum(lambda e_: (e * e_), [1, 3])",
      renamed: { e: "e_" },
    });
    // `lambda` is no identifier at all, and `sum` and `max` would shadow the builtins a template calls.
    for (const name of ["lambda", "sum", "max", "class"]) {
      const emitted = emit(["Sum", name, ["Tuple", name, 1, 3]], "mpmath", rows);
      expect(emitted).toMatchObject({ ok: true, renamed: { [name]: `${name}_` } });
    }
    // The spare is one the expression doesn't already use.
    const nested: MathJSON = ["Sum", ["Sum", ["Add", "e", "e_"], ["Tuple", "e_", 1, 2]], ["Tuple", "e", 1, 3]];
    expect(emit(nested, "mpmath", rows)).toMatchObject({ renamed: { e: "e__" } });
  });

  test("an index nothing reserves is written as it is; SymPy quotes every one", () => {
    expect(
      emit(["Sum", "k", ["Tuple", "k", 1, 3]], "mpmath", sumRows("mpmath", "nsum(lambda $2: $1, [1, 3])")),
    ).toEqual({
      ok: true,
      source: "nsum(lambda k: k, [1, 3])",
    });
    expect(emit(iterate("e"), "sympy")).toEqual({
      ok: true,
      source: 'summation((Symbol("e") * 2), (Symbol("e"), 1, 3))',
    });
  });
});

describe("a free variable Sage refuses is written under a spare name", () => {
  test("a keyword, exec and print; the spare is one the expression doesn't use", () => {
    for (const name of ["lambda", "class", "None", "exec", "print"]) {
      expect(emit(["Add", name, 1], "sage")).toEqual({
        ok: true,
        source: `(SR.var("${name}_") + 1)`,
        freeSymbols: [name],
        renamed: { [name]: `${name}_` },
      });
    }
    expect(emit(["Add", "lambda", "lambda_"], "sage")).toMatchObject({
      freeSymbols: ["lambda", "lambda_"],
      renamed: { lambda: "lambda__" },
    });
    // A name Sage binds fine, and every other lane, are untouched.
    expect(emit(["Add", "sum", 1], "sage")).toEqual({ ok: true, source: '(SR.var("sum") + 1)', freeSymbols: ["sum"] });
    expect(emit(["Add", "lambda", 1], "sympy")).toMatchObject({ source: '(Symbol("lambda") + 1)' });
  });

  test("the answer reads the names back", () => {
    const renamed = { lambda: "lambda_", e: "e_" };
    expect(restoreNames("lambda_ + e_*2 + lambda__ + x", renamed)).toBe("lambda + e*2 + lambda__ + x");
    expect(restoreNames("x + 1", undefined)).toBe("x + 1");
  });

  const keywords = spawnSync("python3", ["-c", "import keyword; print(*keyword.kwlist, 'exec', 'print')"], {
    encoding: "utf8",
  });
  test.skipIf(keywords.status !== 0)("the set is Python's keywords, and exec and print", () => {
    expect([...SAGE_UNBINDABLE].toSorted()).toEqual(keywords.stdout.trim().split(" ").toSorted());
  });
});

/** Names we write as values, not variables. */
const CONSTANT_NAMES = new Set(["True", "False"]);
const hasPython = (module: string): boolean =>
  spawnSync("python3", ["-c", `import ${module}`], { stdio: "ignore" }).status === 0;
const hasSage = spawnSync("sage", ["--version"], { stdio: "ignore" }).status === 0;

/** The one value `source` evaluates to in `system`. */
async function value(system: System, source: string): Promise<string> {
  const [result] = await runIn(system, [source]);
  if (result === undefined || "error" in result)
    throw new Error(`${system}: ${JSON.stringify(result)} for ${source.slice(0, 200)}`);
  return result.value;
}

const emitted = (expr: MathJSON, system: System, rows: readonly Mapping[] = []): string => {
  const result = emit(expr, system, rows);
  if (!result.ok) throw new Error(`${system}: unmapped ${result.missing.join(", ")}`);
  return result.source;
};

describe.skipIf(!hasPython("sympy"))("SymPy", () => {
  test("every name it holds comes back a free symbol with its own name, and as a summation index", async () => {
    const names = variables("sympy");
    expect(names.length).toBeGreaterThan(500);
    const list = emitted(["List", ...names], "sympy");
    expect(await value("sympy", `[str(v) for v in ${list}] == ${JSON.stringify(names)}`)).toBe("True");
    expect(await value("sympy", `all(v.is_Symbol for v in ${list})`)).toBe("True");
    // The index is a Symbol too, so a sum over `E` still leaves SymPy's constant `E` alone.
    const sums = emitted(
      ["List", ...names.map((v) => ["Sum", ["Multiply", "ExponentialE", v], ["Tuple", v, 1, 3]])],
      "sympy",
    );
    expect(await value("sympy", `all(s == 6 * E for s in ${sums})`)).toBe("True");
  }, 120_000);
});

describe.skipIf(!hasPython("mpmath"))("mpmath", () => {
  test("a sum over each name it holds is 6e, whatever the index is called", async () => {
    const rows = sumRows("mpmath", "nsum(lambda $2: $1, [1, 3])");
    const names = [...(reservedNames("mpmath") ?? [])].filter((name) => !CONSTANT_NAMES.has(name));
    expect(names).toContain("e");
    const sums = emitted(
      ["List", ...names.map((v) => ["Sum", ["Multiply", "ExponentialE", v], ["Tuple", v, 1, 3]])],
      "mpmath",
      rows,
    );
    expect(await value("mpmath", `all(abs(s - 6 * e) < 1e-20 for s in ${sums})`)).toBe("True");
  }, 120_000);
});

describe.skipIf(!hasSage)("Sage", () => {
  test("every name it holds comes back a free variable with its own name; an index named `e` leaves the constant alone", async () => {
    const names = variables("sage");
    expect(names.length).toBeGreaterThan(1000);
    // The keywords `SR.var` refuses are written under a spare name.
    expect(names).toContain("lambda");
    const out = emit(["List", ...names], "sage");
    if (!out.ok) throw new Error(`sage: unmapped ${out.missing.join(", ")}`);
    expect(Object.keys(out.renamed ?? {}).toSorted()).toEqual(names.filter((n) => SAGE_UNBINDABLE.has(n)).toSorted());
    const list = out.source;
    const spelled = names.map((name) => out.renamed?.[name] ?? name);
    expect(await value("sage", `[str(v) for v in ${list}] == ${JSON.stringify(spelled)}`)).toBe("True");
    expect(await value("sage", `all(v.is_symbol() for v in ${list})`)).toBe("True");
    const rows = sumRows("sage", "sum(($1) for $2 in range(1, 4))");
    const sum = emitted(["Sum", ["Multiply", "ExponentialE", "e"], ["Tuple", "e", 1, 3]], "sage", rows);
    expect(sum).toBe("sum(((e * e_)) for e_ in range(1, 4))");
    expect(await value("sage", `bool(abs(${sum} - 6 * e) < 1e-20)`)).toBe("True");
  }, 240_000);
});
