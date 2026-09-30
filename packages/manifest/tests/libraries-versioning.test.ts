import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { checkVersion } from "../scripts/check-version.ts";
import { packLibrary } from "../scripts/pack-library.ts";
import type { LibrarySnapshot } from "../src/libraries/versioning.ts";
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

/** The fixture library packed at `version`, with the bodies in `bodies` replaced. */
async function packed(version: string, bodies: Record<string, unknown> = {}): Promise<string> {
  const dir = join(mkdtempSync(join(tmpdir(), "version-")), "ada-primes");
  cpSync(FIXTURE, dir, { recursive: true });
  const pkgPath = join(dir, "package.json");
  writeFileSync(pkgPath, JSON.stringify({ ...JSON.parse(readFileSync(pkgPath, "utf8")), version }));
  for (const [symbol, body] of Object.entries(bodies)) {
    const path = join(dir, `symbols/${symbol}/definition.json`);
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), body }));
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
    // Quad still pins the Twice this version no longer has.
    "example quad-3: ada.Quad: ada.Twice@sha256-a6ca5cce8d3e17fc60c7e9298332578c8a551ba47d71bbb8c10ec667a46acc45 doesn't resolve",
    "example twice-3: now 9",
    "example twice-half: now 0.75",
  ]);
  expect((await checkVersion(await packed("2.0.0", { Twice: thrice }), previous)).says).toBe(true);
  // Quad as 4x rather than Twice of Twice: a new pin, every old example met, a patch. (Twice
  // itself can't change so quietly: Quad pins it.)
  const same = await checkVersion(await packed("1.0.1", { Quad: ["Function", ["Multiply", 4, "x"], "x"] }), previous);
  expect([same.level, same.says]).toEqual(["patch", true]);
});
