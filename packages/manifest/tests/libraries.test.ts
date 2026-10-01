// Libraries on npm, read the way a page reads them from jsDelivr, but served from
// tests/fixtures/npm by an injected fetch: @ada/primes, and @bob/extra, which pins two of
// ada's symbols and uses a system one unpinned.

import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { packLibrary } from "../scripts/pack-library.ts";
import { combineRegistries, createRegistryResolver, type Library, manifestRegistry, searchPath } from "../src/index.ts";
import { type FetchJson, githubHost, lockLibraries, npmHost, catalog, specsOf } from "../src/libraries/index.ts";

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
    const index = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
    expect(index(await packLibrary(copy))).toEqual(index(join(FIXTURES, dir, "symbols/index.json")));
  }
});

test("packing maps each symbol to the targets its library tracks, and only those", async () => {
  const copy = join(mkdtempSync(join(tmpdir(), "pack-")), "ada-primes");
  cpSync(join(FIXTURES, "ada-primes"), copy, { recursive: true });
  await packLibrary(copy);
  const mappings = JSON.parse(readFileSync(join(copy, "symbols/Twice/mappings.json"), "utf8"));
  // The record also has a MathWorld reference, which ada doesn't track.
  expect(mappings.references.map((r: { system: string }) => r.system)).toEqual(["wikipedia"]);
  expect(Object.keys(mappings.implementations)).toEqual(["twice-3"]);
  const pkgPath = join(copy, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  writeFileSync(
    pkgPath,
    JSON.stringify({ ...pkg, enumeratio: { ...pkg.enumeratio, mappings: ["wolfram", "nowhere"] } }),
  );
  await expect(packLibrary(copy)).rejects.toThrow('"mappings" names nowhere, which no target is');
});

test("a package's symbols evaluate at their pins, fetching only what the expression uses", async () => {
  const { fetch, log } = cdn();
  const npm = catalog<Engine>(SPECS, { host: npmHost({ fetch }) });
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
  const ensured = await createRegistryResolver(catalog<Engine>(SPECS, { host: npmHost({ fetch }) })).ensure(
    new ComputeEngine(),
    ["MemberCall", "ada", "'Twice'", 1],
  );
  expect(ensured.unresolved).toEqual(["ada.Twice"]);
});

test("a scoped package's namespace is its scope", async () => {
  const { fetch } = cdn((url, json) =>
    url.endsWith("@bob/extra@2.0.0/package.json")
      ? { ...(json as object), enumeratio: { namespace: "ada", index: "./symbols/index.json" } }
      : json,
  );
  await expect(catalog<Engine>(SPECS, { host: npmHost({ fetch }) }).names!("bob")).rejects.toThrow(
    "@bob/extra@2.0.0 claims the namespace ada, not bob",
  );
  expect(() => catalog<Engine>(["@ada/primes"], { host: npmHost({ fetch }) })).toThrow("needs a version");
});

test("beside the system: a search path over npm namespaces, and system names unpinned", async () => {
  const log: string[] = [];
  const analytic: Library<Engine> = { name: "analytic", declare: () => void log.push("analytic") };
  const registry = combineRegistries(manifestRegistry([analytic]), catalog<Engine>(SPECS, { host: npmHost(cdn()) }));
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
  const resolver = createRegistryResolver(catalog<Engine>(SPECS, { host: npmHost({ fetch }) }), {
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
  const resolver = createRegistryResolver(catalog<Engine>(SPECS, { host: npmHost({ fetch }) }), {
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
    await packLibrary(target);
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
  expect(evaluate(ce, ["MemberCall", "bob", "'Scaled'", 3])).toBe(6);
  expect(evaluate(ce, [bob.definitions.Quoted.head, ["Add", 1, 2]])).toEqual(["Hold", ["Add", 1, 2]]);
  // A definition with defaults or attributes isn't a plain function.
  expect(bob.Scaled).toBeUndefined();
  // The heads are the registry's, so a pin means the same thing either way.
  const npm = catalog<Engine>(SPECS, { host: npmHost(cdn()) });
  expect((await npm.resolve("ada.Quad"))?.head).toBe(ada.definitions.Quad.head);
  expect(readFileSync(join(root, "node_modules/@ada/primes/dist/index.d.ts"), "utf8")).toContain(
    "export declare const Twice: (x0: number) => number;",
  );
});

test("options are optional named parameters, defaults filling what a call leaves out; attributes hold", async () => {
  const { fetch } = cdn();
  const npm = catalog<Engine>(SPECS, { host: npmHost({ fetch }) });
  const written: [string, unknown][] = [];
  const resolver = createRegistryResolver(npm, {
    check: { engine: () => new ComputeEngine(), mode: "enforce" },
    notation: (_ce, head, data) => written.push([head, data]),
  });
  const ce = new ComputeEngine();
  const scaled = (...args: unknown[]) => ["MemberCall", "bob", "'Scaled'", ...args];
  const quoted = ["MemberCall", "bob", "'Quoted'", ["Add", 1, 2]];
  const ensure = async (json: unknown) => {
    const ensured = await resolver.ensure(ce, json);
    expect(ensured.errors).toEqual([]);
    return evaluate(ce, ensured.expression);
  };
  expect(await ensure(scaled(3))).toBe(6);
  // As Epsil's parser gives it: the long form, with source offsets.
  const parsed = { fn: ["MemberCall", { sym: "bob", sourceOffsets: [0, 3] }, { str: "Scaled" }, { num: "3" }] };
  expect(await ensure(parsed)).toBe(6);
  expect(await ensure(scaled(3, 5))).toBe(15);
  // By name, and held: the expression ensure returns calls these by head, where compute-engine
  // sees the parameter names and the attributes a namespace record hides.
  expect(await ensure(scaled(3, ["NamedArgument", "'factor'", 5]))).toBe(15);
  expect(await ensure(quoted)).toEqual(["Hold", ["Add", 1, 2]]);
  expect(evaluate(ce, quoted)).toEqual(["Hold", 3]);
  // Its notation is handed over under the head it was declared as, which it never had to name.
  const head = (await npm.resolve("bob.Scaled"))!.head;
  expect(written.map(([h]) => h)).toEqual([head]);
  expect(written[0]![1]).toMatchObject({ latex: [{ trigger: "\\scaled", kind: "function" }] });
});

test("a symbol is described from the index alone: no definition fetched, no install check", async () => {
  const { fetch, log } = cdn();
  const npm = catalog<Engine>(SPECS, { host: npmHost({ fetch }) });
  const resolver = createRegistryResolver(npm, {
    check: { engine: () => new ComputeEngine() },
    describeOnly: ["About"],
  });
  const { described, declared } = await resolver.ensure(new ComputeEngine(), ["About", ["Field", "bob", "'Scaled'"]]);
  expect(declared).toEqual([]);
  expect(described["bob.Scaled"]).toMatchObject({
    description: "Its argument times factor, two unless given.",
    signature: "(x: number, factor: number?) -> number",
    defaults: { factor: 2 },
    examples: 2,
    triggers: ["\\scaled"],
    package: "@bob/extra@2.0.0",
  });
  expect(log.filter((path) => !path.endsWith("package.json") && !path.endsWith("index.json"))).toEqual([]);
});

test("from ranges: lock the versions, then read them", async () => {
  const { fetch } = cdn();
  const listVersions = async (name: string) =>
    SPECS.filter((spec) => spec.startsWith(`${name}@`)).map((spec) => spec.slice(name.length + 1));
  const lock = await lockLibraries(["@bob/extra@^2.0.0"], { host: { ...npmHost({ fetch }), versions: listVersions } });
  expect(lock).toEqual({ "@ada/primes": "1.0.0", "@bob/extra": "2.0.0" });
  const ce = new ComputeEngine();
  await createRegistryResolver(catalog<Engine>(specsOf(lock), { host: npmHost({ fetch }) })).ensure(ce, [
    "MemberCall",
    "bob",
    "'Octuple'",
    1,
  ]);
  expect(evaluate(ce, ["MemberCall", "bob", "'Octuple'", 1])).toBe(8);
});

test("a package whose system range doesn't admit the system's version isn't read", async () => {
  const { fetch } = cdn();
  expect(await catalog<Engine>(SPECS, { host: npmHost({ fetch }), system: "0.9.0" }).names!("ada")).toContain("Twice");
  await expect(catalog<Engine>(SPECS, { host: npmHost({ fetch }), system: "1.0.0" }).names!("ada")).rejects.toThrow(
    "catalog: @ada/primes@1.0.0 is for the system 0.x, not 1.0.0",
  );
});

test("the same package from GitHub, versioned by its tags: the owner is the namespace", async () => {
  const urls: string[] = [];
  const fetch = async (url: string) => {
    urls.push(url);
    const path = url.replace("https://cdn.jsdelivr.net/gh/ada/primes@1.0.0/", "");
    return JSON.parse(readFileSync(join(FIXTURES, "ada-primes", path), "utf8"));
  };
  const ce = new ComputeEngine();
  const registry = catalog<Engine>(["ada/primes@1.0.0"], { host: githubHost({ fetch }) });
  await createRegistryResolver(registry).ensure(ce, ["MemberCall", "ada", "'Quad'", 3]);
  expect(evaluate(ce, ["MemberCall", "ada", "'Quad'", 3])).toBe(12);
  expect(urls[0]).toBe("https://cdn.jsdelivr.net/gh/ada/primes@1.0.0/package.json");
  await expect(
    catalog<Engine>(["bob/primes@1.0.0"], {
      host: githubHost({ fetch: async (url) => fetch(url.replace("bob/", "ada/")) }),
    }).names!("ada"),
  ).rejects.toThrow("claims the namespace ada, not bob");
});
