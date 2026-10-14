import { expect, test } from "vite-plus/test";
import { registerModularKernel } from "../src/index.ts";
import { bareEngine } from "../src/testing.ts";

// modular.ts wraps `evaluate` and `evaluateAsync` on the prototype compute-engine's function nodes
// share (ce-internals.ts checks it still can). Each test counts kernel calls, so it shows whether the
// registry was consulted and not only what came back.

/** A head the engine has no handler for, so only the registry can ever evaluate it. */
const engine = () => {
  const ce = bareEngine();
  ce.declare("Triple", { signature: "(integer) -> integer" });
  const calls: bigint[][] = [];
  registerModularKernel(ce, "Triple", (args, m) => {
    calls.push([...args]);
    return (3n * args[0]!) % m;
  });
  return { ce, calls };
};

test("Mod(head(args), m) is answered by the registered kernel, with Mod's own sign convention", () => {
  const { ce, calls } = engine();
  expect(ce.box(["Mod", ["Triple", 10], 7]).evaluate().json).toBe(2);
  expect(calls).toEqual([[10n]]);
  expect(ce.box(["Mod", ["Triple", 10], -7]).evaluate().json).toBe(-5);
  expect(ce.box(["Mod", ["Triple", 7], 7]).evaluate().json).toBe(0);
  expect(ce.box(["Mod", ["Add", ["Triple", 10], ["Triple", 1]], 9]).evaluate().json).toBe(6);
  expect(ce.box(["Mod", ["Power", ["Triple", 2], 1000], 1000007]).evaluate().json).toBe(
    ce.box(["PowerMod", 6, 1000, 1000007]).evaluate().json,
  );
  expect(calls.length).toBe(6);
});

test("it answers under evaluateAsync too", async () => {
  const { ce, calls } = engine();
  expect((await ce.box(["Mod", ["Triple", 10], 7]).evaluateAsync()).json).toBe(2);
  expect(calls).toEqual([[10n]]);
  expect((await ce.box(["Mod", ["List", 5, 6], 4]).evaluateAsync()).json).toEqual(["List", 1, 2]);
});

test("a call the registry cannot answer never consults the kernel", () => {
  const { ce, calls } = engine();
  ce.box(["Mod", ["Triple", 10], 7]).N();
  ce.box(["Mod", ["Triple", 10], 0]).evaluate();
  expect(ce.box(["Mod", ["Triple", "x"], 7]).evaluate().json).toEqual(["Mod", ["Triple", "x"], 7]);
  expect(ce.box(["Mod", ["Triple", 10], "m"]).evaluate().json).toEqual(["Mod", ["Triple", 10], "m"]);
  ce.box(["Mod", ["Triple", ["Rational", 1, 2]], 7]).evaluate();
  expect(ce.box(["Mod", 17, 5]).evaluate().json).toBe(2);
  expect(ce.box(["Mod", ["List", 5, 6], 4]).evaluate().json).toEqual(["List", 1, 2]);
  expect(calls).toEqual([]);
});

test("a power of exponent zero is left to compute-engine, a large one stays modular", () => {
  const { ce, calls } = engine();
  ce.box(["Mod", ["Power", ["Triple", 0], 0], 7]).evaluate();
  expect(calls).toEqual([]);
  expect(ce.box(["Mod", ["Power", ["Triple", 10], 300], 1000007]).evaluate().json).toBe(Number(30n ** 300n % 1000007n));
  expect(calls).toEqual([[10n]]);
});

test("an inner Mod is a ring element only under a modulus that is a multiple of ours", () => {
  const { ce, calls } = engine();
  expect(ce.box(["Mod", ["Add", ["Mod", ["Triple", 10], 63], 5], 7]).evaluate().json).toBe(0);
  expect(calls).toEqual([[10n]]);
  expect(ce.box(["Mod", ["Add", ["Mod", ["Triple", 10], 10], 5], 7]).evaluate().json).toBe(5);
});

test("a second instance of the module shares the registry and does not wrap again", async () => {
  const ce = bareEngine();
  ce.declare("Triple", { signature: "(integer) -> integer" });
  ce.declare("Quad", { signature: "(integer) -> integer" });
  let consulted = 0;
  registerModularKernel(ce, "Triple", () => {
    consulted++;
    return undefined;
  });
  const specifier = "../src/modular.ts?second";
  const second = (await import(/* @vite-ignore */ specifier)) as typeof import("../src/modular.ts");
  expect(second.registerModularKernel).not.toBe(registerModularKernel);
  second.registerModularKernel(ce, "Quad", ([n], m) => (4n * n!) % m);
  ce.box(["Mod", ["Triple", 10], 7]).evaluate();
  expect(consulted).toBe(1); // one wrapper, so one consultation
  expect(ce.box(["Mod", ["Quad", 10], 7]).evaluate().json).toBe(5);
});

test("a rational part declines: Mod of a rational is its rational remainder, never a modular inverse", () => {
  // Triple answers to compute-engine as well, so the exact path has a value to agree with.
  const ce = bareEngine();
  ce.declare("Triple", { signature: "(integer) -> integer", evaluate: ([n]) => ce.number(3n * BigInt(n!.re)) });
  registerModularKernel(ce, "Triple", (args, m) => (3n * args[0]!) % m);
  const exact = (f: unknown, m: number) => ce.box(["Mod", ce.box(f as never).evaluate().json, m]).evaluate().json;
  const fast = (f: unknown, m: number) => ce.box(["Mod", f as never, m]).evaluate().json;
  for (const f of [
    ["Add", ["Triple", 10], ["Rational", 1, 3]],
    ["Add", ["Triple", 10], ["Power", 3, -1]],
    ["Add", ["Triple", 10], ["Divide", 1, 3]],
    ["Add", ["Triple", 10], ["Power", ["Triple", 5], -1]],
    ["Power", ["Triple", 5], -1],
    ["Add", ["Triple", 10], ["Power", ["Triple", 5], -300]],
  ]) {
    for (const m of [1, 7, 9, 1000003]) {
      expect(fast(f, m), `Mod(${JSON.stringify(f)}, ${m})`).toEqual(exact(f, m));
    }
  }
  expect(fast(["Add", ["Triple", 10], ["Rational", 1, 3]], 7)).toEqual(["Rational", 7, 3]); // 91/3 − 28
});

test("a variadic kernel takes any number of arguments", () => {
  const ce = bareEngine();
  ce.declare("Sum", { signature: "(integer*) -> integer" });
  const seen: bigint[][] = [];
  registerModularKernel(
    ce,
    "Sum",
    (args, m) => {
      seen.push([...args]);
      return args.reduce((a, b) => a + b, 0n) % m;
    },
    "variadic",
  );
  expect(ce.box(["Mod", ["Sum", 10, 20, 30], 7]).evaluate().json).toBe(4);
  expect(ce.box(["Mod", ["Sum"], 7]).evaluate().json).toBe(0);
  expect(seen).toEqual([[10n, 20n, 30n], []]);
});

test("an engine that registered nothing is untouched, even in the same process", () => {
  engine();
  const other = bareEngine();
  other.declare("Triple", { signature: "(integer) -> integer", evaluate: ([n]) => other.number(3n * BigInt(n!.re)) });
  expect(other.box(["Mod", ["Triple", 10], 7]).evaluate().json).toBe(2);
});
