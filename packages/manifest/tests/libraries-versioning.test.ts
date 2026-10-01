import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { checkVersion } from "../scripts/check-version.ts";
import { packLibrary } from "../scripts/pack-library.ts";
import type { LibrarySnapshot } from "../src/libraries/versioning.ts";
import { type Definition, pinOf } from "../src/registry.ts";
import { changesOf, levelOf, versionSays } from "../src/libraries/versioning.ts";

const ce = new ComputeEngine();
const isSubtype = (a: string, b: string): boolean => ce.type(a).matches(ce.type(b));

const snapshot = (
  symbols: Record<string, { signature: string; pin: string; examples?: number }>,
  system?: string,
): LibrarySnapshot => ({ version: "1.0.0", index: { namespace: "ada", symbols }, ...(system ? { system } : {}) });

test("each surface's change, and the level it needs", () => {
  const before = snapshot(
    {
      Gone: { signature: "(number) -> number", pin: "sha256-a" },
      Widened: { signature: "(integer) -> number", pin: "sha256-b" },
      Narrowed: { signature: "(number) -> number", pin: "sha256-c" },
      Rewritten: { signature: "(number) -> number", pin: "sha256-d", examples: 1 },
    },
    "0.x",
  );
  const after = snapshot(
    {
      Widened: { signature: "(number) -> integer", pin: "sha256-b" },
      Narrowed: { signature: "(integer) -> number", pin: "sha256-c" },
      Rewritten: { signature: "(number) -> number", pin: "sha256-e", examples: 2 },
      New: { signature: "(number) -> number", pin: "sha256-f" },
    },
    ">=0.2.0 <1",
  );
  const changes = changesOf(before, after, isSubtype);
  expect(changes).toEqual([
    { symbol: "Gone", level: "major", what: "removed" },
    { symbol: "Narrowed", level: "major", what: "signature (number) -> number to (integer) -> number" },
    { symbol: "Rewritten", level: "patch", what: "definition changed" },
    { symbol: "Rewritten", level: "minor", what: "examples added" },
    { symbol: "Widened", level: "minor", what: "signature (integer) -> number to (number) -> integer, widened" },
    { symbol: "New", level: "minor", what: "added" },
    { level: "major", what: "system 0.x to >=0.2.0 <1" },
  ]);
  expect(levelOf(changes)).toBe("major");
  expect(levelOf([])).toBe("none");
});

test("named slots, attributes and notation: renamed or rebound is a break", () => {
  const before: LibrarySnapshot = {
    version: "1.0.0",
    index: {
      namespace: "ada",
      symbols: {
        Scaled: { signature: "(x: number, factor: number?) -> number", pin: "sha256-a", params: ["x", "factor"] },
        Quoted: { signature: "(any) -> any", pin: "sha256-b", attributes: ["HoldAll"] },
      },
      notation: {
        latex: [
          { trigger: "\\scaled", name: "Scaled" },
          { trigger: "\\q", name: "Quoted" },
        ],
        traditional: [],
      },
    },
  };
  const after: LibrarySnapshot = {
    version: "1.1.0",
    index: {
      namespace: "ada",
      symbols: {
        Scaled: { signature: "(x: number, by: number?) -> number", pin: "sha256-c", params: ["x", "by"] },
        Quoted: { signature: "(any) -> any", pin: "sha256-b" },
      },
      notation: {
        latex: [
          { trigger: "\\scaled", name: "Quoted" },
          { trigger: "\\twice", name: "Scaled" },
        ],
        traditional: ["Scaled"],
      },
    },
  };
  expect(changesOf(before, after, isSubtype)).toEqual([
    { symbol: "Quoted", level: "major", what: "attributes HoldAll to none" },
    { symbol: "Scaled", level: "major", what: "parameter factor renamed by" },
    { symbol: "Scaled", level: "patch", what: "definition changed" },
    { level: "major", what: "notation \\q removed" },
    { level: "major", what: "notation \\scaled now reads as Quoted" },
    { level: "minor", what: "notation \\twice added" },
    { level: "patch", what: "TraditionalForm rules none to Scaled" },
  ]);
});

test("a symbol's own notation: a trigger moving to another symbol is a break, a new template a patch", () => {
  const symbol = (notation: object) => ({ signature: "(number) -> number", pin: "sha256-a", notation });
  const before = snapshot({
    A: symbol({ latex: [{ trigger: "\\a" }], traditional: [{ params: ["x"], call: "A" }] }),
    B: symbol({}),
  } as never);
  const after = snapshot({
    A: symbol({ traditional: [{ params: ["x"], call: "𝒜" }] }),
    B: symbol({ latex: [{ trigger: "\\a" }] }),
  } as never);
  expect(changesOf(before, after, isSubtype)).toEqual([
    { level: "major", what: "notation \\a now reads as B" },
    { symbol: "A", level: "patch", what: "TraditionalForm changed" },
  ]);
});

test("what a version number says, as a caret range reads it", () => {
  expect(versionSays("1.2.3", "2.0.0", "major")).toBe(true);
  expect(versionSays("1.2.3", "1.3.0", "major")).toBe(false);
  // In 0.x a minor bump leaves the caret range, so it can carry a break.
  expect(versionSays("0.1.0", "0.2.0", "major")).toBe(true);
  expect(versionSays("1.2.3", "1.2.4", "minor")).toBe(false);
  expect(versionSays("1.2.3", "1.3.0", "minor")).toBe(true);
  expect(versionSays("1.2.3", "1.2.4", "patch")).toBe(true);
  expect(versionSays("1.2.3", "1.2.3", "patch")).toBe(false);
  expect(versionSays("1.2.3", "1.2.3", "none")).toBe(true);
});

const FIXTURE = new URL("./fixtures/npm/ada-primes", import.meta.url).pathname;

/**
 * The fixture library at `version`, with the bodies in `bodies` replaced and, as its author
 * would, each of its own pins moved to the new definitions (unless `repin` is false); packed.
 */
async function packed(version: string, bodies: Record<string, unknown> = {}, repin = true): Promise<string> {
  const dir = join(mkdtempSync(join(tmpdir(), "version-")), "ada-primes");
  cpSync(FIXTURE, dir, { recursive: true });
  const pkgPath = join(dir, "package.json");
  writeFileSync(pkgPath, JSON.stringify({ ...JSON.parse(readFileSync(pkgPath, "utf8")), version }));
  const path = (symbol: string): string => join(dir, `symbols/${symbol}/definition.json`);
  const read = (symbol: string): Definition => JSON.parse(readFileSync(path(symbol), "utf8")) as Definition;
  for (const [symbol, body] of Object.entries(bodies))
    writeFileSync(path(symbol), JSON.stringify({ ...read(symbol), body }));
  // Twice before Quad, which pins it.
  if (repin)
    for (const symbol of ["Twice", "Quad"]) {
      const definition = read(symbol);
      const requires = Object.fromEntries(
        await Promise.all(
          Object.keys(definition.requires ?? {}).map(async (used) => [used, await pinOf(read(used.split(".")[1]!))]),
        ),
      );
      writeFileSync(path(symbol), JSON.stringify({ ...definition, ...(definition.requires ? { requires } : {}) }));
    }
  await packLibrary(dir);
  return dir;
}

test("a definition whose old examples now fail is a break, and needs a major version", async () => {
  const previous = await packed("1.0.0");
  const thrice = ["Function", ["Multiply", 3, "x"], "x"];
  const patched = await checkVersion(await packed("1.0.1", { Twice: thrice }), previous);
  expect(patched.level).toBe("major");
  expect(patched.says).toBe(false);
  expect(patched.changes.filter((c) => c.what.startsWith("example")).map((c) => c.what)).toEqual([
    "example quad-3: now 27",
    "example twice-3: now 9",
    "example twice-half: now 0.75",
  ]);
  expect((await checkVersion(await packed("2.0.0", { Twice: thrice }), previous)).says).toBe(true);
  // Quad as 4x rather than Twice of Twice: a new pin, every old example met, a patch.
  const same = await checkVersion(await packed("1.0.1", { Quad: ["Function", ["Multiply", 4, "x"], "x"] }), previous);
  expect([same.level, same.says]).toEqual(["patch", true]);
});

test("packing refuses a pin its library doesn't have", async () => {
  // Twice rewritten, and Quad left pinning the old one.
  await expect(packed("1.0.1", { Twice: ["Function", ["Multiply", 3, "x"], "x"] }, false)).rejects.toThrow(
    /ada\.Quad pins ada\.Twice@sha256-a6ca5cce[0-9a-f]+, and it's sha256-/,
  );
});
