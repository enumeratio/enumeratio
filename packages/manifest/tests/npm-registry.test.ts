// Symbol packages on npm, read the way a page reads them from jsDelivr, but served from
// tests/fixtures/npm by an injected fetch: @ada/primes, and @bob/extra, which pins two of
// ada's symbols and uses a system one unpinned.

import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { packSymbols } from "../scripts/pack-symbols.ts";
import {
  combineRegistries,
  createRegistryResolver,
  type FetchJson,
  type Library,
  lockPackages,
  manifestRegistry,
  npmRegistry,
  searchPath,
  specsOf,
} from "../src/index.ts";

const FIXTURES = new URL("./fixtures/npm/", import.meta.url).pathname;
const CDN = "https://cdn.jsdelivr.net/npm";
const PACKAGES: Readonly<Record<string, string>> = {
  "@ada/primes@1.0.0": "ada-primes",
  "@bob/extra@2.0.0": "bob-extra",
};
const SPECS = Object.keys(PACKAGES);

/** jsDelivr, as far as these packages go: each URL a fixture file, and every read logged. */
function cdn(edit: (url: string, json: unknown) => unknown = (_url, json) => json) {
  const log: string[] = [];
  const fetch: FetchJson = async (url) => {
    log.push(url.slice(CDN.length + 1));
    const spec = SPECS.find((s) => url.startsWith(`${CDN}/${s}/`));
    if (spec === undefined) throw new Error(`${url}: 404`);
    const file = join(FIXTURES, PACKAGES[spec]!, url.slice(`${CDN}/${spec}/`.length));
    return edit(url, JSON.parse(readFileSync(file, "utf8")));
  };
  return { fetch, log };
}

type Engine = InstanceType<typeof ComputeEngine>;
const evaluate = (ce: Engine, json: unknown): unknown => ce.box(json as never).evaluate().json;

test("the fixtures' indexes are what packing their definitions writes", async () => {
  for (const dir of Object.values(PACKAGES)) {
    const copy = join(mkdtempSync(join(tmpdir(), "pack-")), dir);
    cpSync(join(FIXTURES, dir), copy, { recursive: true });
    const index = (path: string) => readFileSync(path, "utf8");
    expect(index(await packSymbols(copy))).toBe(index(join(FIXTURES, dir, "symbols/index.json")));
  }
});

test("a package's symbols evaluate at their pins, fetching only what the expression uses", async () => {
  const { fetch, log } = cdn();
  const npm = npmRegistry<Engine>(SPECS, { fetch });
  const ce = new ComputeEngine();
  const octuple = ["MemberCall", "bob", "'Octuple'", 1];
  const ensured = await createRegistryResolver(npm).ensure(ce, octuple);
  expect(ensured.errors).toEqual([]);
  expect(evaluate(ce, octuple)).toBe(8);
  expect(log.toSorted()).toEqual([
    "@ada/primes@1.0.0/package.json",
    "@ada/primes@1.0.0/symbols/Quad/definition.json",
    "@ada/primes@1.0.0/symbols/Twice/definition.json",
    "@ada/primes@1.0.0/symbols/index.json",
    "@bob/extra@2.0.0/package.json",
    "@bob/extra@2.0.0/symbols/Octuple/definition.json",
    "@bob/extra@2.0.0/symbols/index.json",
  ]);
});

test("a definition that doesn't hash to its pin isn't served", async () => {
  const { fetch } = cdn((url, json) =>
    url.endsWith("Twice/definition.json")
      ? { ...(json as object), body: ["Function", ["Multiply", 3, "x"], "x"] }
      : json,
  );
  const ensured = await createRegistryResolver(npmRegistry<Engine>(SPECS, { fetch })).ensure(new ComputeEngine(), [
    "MemberCall",
    "ada",
    "'Twice'",
    1,
  ]);
  expect(ensured.unresolved).toEqual(["ada.Twice"]);
});

test("a scoped package's namespace is its scope", async () => {
  const { fetch } = cdn((url, json) =>
    url.endsWith("@bob/extra@2.0.0/package.json")
      ? { ...(json as object), enumeratio: { namespace: "ada", index: "./symbols/index.json" } }
      : json,
  );
  await expect(npmRegistry<Engine>(SPECS, { fetch }).names!("bob")).rejects.toThrow(
    "@bob/extra@2.0.0 claims the namespace ada, not its scope bob",
  );
  expect(() => npmRegistry<Engine>(["@ada/primes"], { fetch })).toThrow("needs a version");
});

test("beside the system: a search path over npm namespaces, and system names unpinned", async () => {
  const log: string[] = [];
  const analytic: Library<Engine> = { name: "analytic", declare: () => void log.push("analytic") };
  const registry = combineRegistries(manifestRegistry([analytic]), npmRegistry<Engine>(SPECS, cdn()));
  const path = await searchPath(registry, { use: ["ada", "bob"] });
  const ensured = await createRegistryResolver(registry, { path }).ensure(new ComputeEngine(), [
    "Add",
    ["Quad", 1],
    ["Zh", 2],
  ]);
  expect(ensured.errors).toEqual([]);
  expect(ensured.expression).toEqual(["Add", ["MemberCall", "ada", "'Quad'", 1], ["MemberCall", "bob", "'Zh'", 2]]);
  expect(log).toEqual(["analytic"]);
});

test("install check over npm: each package's examples, fetched only to check", async () => {
  const { fetch, log } = cdn();
  const resolver = createRegistryResolver(npmRegistry<Engine>(SPECS, { fetch }), {
    check: { engine: () => new ComputeEngine() },
  });
  const ce = new ComputeEngine();
  const ensured = await resolver.ensure(ce, ["MemberCall", "bob", "'Octuple'", 2]);
  expect([ensured.errors, ensured.failed]).toEqual([[], {}]);
  expect(evaluate(ce, ["MemberCall", "bob", "'Octuple'", 2])).toBe(16);
  expect(log.filter((url) => url.endsWith("examples.json")).toSorted()).toEqual([
    "@ada/primes@1.0.0/symbols/Quad/examples.json",
    "@ada/primes@1.0.0/symbols/Twice/examples.json",
    "@bob/extra@2.0.0/symbols/Octuple/examples.json",
  ]);
});

test("install check over npm: a published example the definition doesn't meet refuses it", async () => {
  const { fetch } = cdn((url, json) =>
    url.endsWith("Quad/examples.json")
      ? [{ id: "quad-3", expr: ["MemberCall", "ada", "'Quad'", 3], expected: 13 }]
      : json,
  );
  const resolver = createRegistryResolver(npmRegistry<Engine>(SPECS, { fetch }), {
    check: { engine: () => new ComputeEngine() },
  });
  const ensured = await resolver.ensure(new ComputeEngine(), ["MemberCall", "bob", "'Octuple'", 2]);
  expect(ensured.failed).toEqual({ "ada.Quad": ["quad-3: 12, expected 13"] });
  expect(ensured.errors).toEqual(["ada.Quad: 1 example(s) fail"]);
});

test("a packed package is a plain library too: declare(ce), and compiled functions", async () => {
  // Installed side by side, as npm would: bob's entry imports @ada/primes by name.
  const root = mkdtempSync(join(tmpdir(), "install-"));
  for (const [spec, dir] of Object.entries(PACKAGES)) {
    const target = join(root, "node_modules", spec.slice(0, spec.lastIndexOf("@")));
    cpSync(join(FIXTURES, dir), target, { recursive: true });
    await packSymbols(target);
  }
  const ada = await import(join(root, "node_modules/@ada/primes/dist/index.js"));
  const bob = await import(join(root, "node_modules/@bob/extra/dist/index.js"));
  // Self-contained compiled code is exported; code needing compute-engine's runtime isn't.
  expect(ada.Twice(21)).toBe(42);
  expect(ada.Quad).toBeUndefined();
  const ce = new ComputeEngine();
  bob.declare(ce);
  expect(evaluate(ce, ["MemberCall", "bob", "'Octuple'", 2])).toBe(16);
  expect(evaluate(ce, ["MemberCall", "ada", "'Quad'", 2])).toBe(8);
  // The heads are the registry's, so a pin means the same thing either way.
  const npm = npmRegistry<Engine>(SPECS, cdn());
  expect((await npm.resolve("ada.Quad"))?.head).toBe(ada.definitions.Quad.head);
  expect(readFileSync(join(root, "node_modules/@ada/primes/dist/index.d.ts"), "utf8")).toContain(
    "export declare const Twice: (x0: number) => number;",
  );
});

test("from ranges: lock the versions, then read them", async () => {
  const { fetch } = cdn();
  const listVersions = async (name: string) =>
    SPECS.filter((spec) => spec.startsWith(`${name}@`)).map((spec) => spec.slice(name.length + 1));
  const lock = await lockPackages(["@bob/extra@^2.0.0"], { fetch, listVersions });
  expect(lock).toEqual({ "@ada/primes": "1.0.0", "@bob/extra": "2.0.0" });
  const ce = new ComputeEngine();
  await createRegistryResolver(npmRegistry<Engine>(specsOf(lock), { fetch })).ensure(ce, [
    "MemberCall",
    "bob",
    "'Octuple'",
    1,
  ]);
  expect(evaluate(ce, ["MemberCall", "bob", "'Octuple'", 1])).toBe(8);
});
