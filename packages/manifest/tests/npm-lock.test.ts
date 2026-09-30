import { expect, test } from "vite-plus/test";
import { type FetchJson, lockPackages, specsOf } from "../src/index.ts";

// A small npm: each package's versions and what each version's package.json says.
const symbols = (namespace: string, dependencies: Record<string, string> = {}, system?: string) => ({
  enumeratio: { namespace, index: "./symbols/index.json", ...(system === undefined ? {} : { system }) },
  dependencies,
});
const WORLD: Readonly<Record<string, Readonly<Record<string, object>>>> = {
  "@ada/primes": { "1.0.0": symbols("ada"), "1.1.0": symbols("ada"), "1.2.0": symbols("ada"), "2.0.0": symbols("ada") },
  // 1.1.0 runs on any 0.x system, 1.2.0 needs 0.2.
  "@dee/sieve": { "1.1.0": symbols("dee", {}, "0.x"), "1.2.0": symbols("dee", {}, ">=0.2.0 <1") },
  "@bob/extra": {
    "2.0.0": symbols("bob", { "@ada/primes": "^1.0.0", "left-pad": "^1.0.0" }),
    "2.1.0": symbols("bob", { "@ada/primes": "~1.1.0", "left-pad": "^1.0.0" }),
  },
  "@cat/old": { "1.0.0": symbols("cat", { "@ada/primes": "^2.0.0" }) },
  "left-pad": { "1.3.0": { name: "left-pad" } },
};

function npm() {
  const listed: string[] = [];
  const fetch: FetchJson = async (url) => {
    const match = /^https:\/\/cdn\.jsdelivr\.net\/npm\/(.+)@([^@/]+)\/package\.json$/.exec(url);
    const pkg = match === null ? undefined : WORLD[match[1]!]?.[match[2]!];
    if (pkg === undefined) throw new Error(`${url}: 404`);
    return pkg;
  };
  const listVersions = async (name: string) => {
    listed.push(name);
    return Object.keys(WORLD[name] ?? {});
  };
  return { fetch, listVersions, listed };
}

test("ranges to the highest versions every asker admits, closed over symbol dependencies", async () => {
  // bob@2.1.0 narrows ada to ~1.1.0; left-pad isn't a symbol package, so it isn't locked.
  const lock = await lockPackages(["@bob/extra@^2.0.0", "@ada/primes@^1.0.0"], npm());
  expect(lock).toEqual({ "@ada/primes": "1.1.0", "@bob/extra": "2.1.0" });
  expect(specsOf(lock)).toEqual(["@ada/primes@1.1.0", "@bob/extra@2.1.0"]);
  expect(await lockPackages(["@bob/extra@2.0.0"], npm())).toEqual({ "@ada/primes": "1.2.0", "@bob/extra": "2.0.0" });
});

test("a lock holds while every range still admits it, with nothing listed", async () => {
  const world = npm();
  const lock = { "@ada/primes": "1.0.0", "@bob/extra": "2.0.0" };
  expect(await lockPackages(["@bob/extra@^2.0.0"], { ...world, lock })).toEqual(lock);
  expect(world.listed).toEqual(["left-pad"]);
  // Asked for more than it admits, a locked version moves.
  expect(await lockPackages(["@bob/extra@^2.0.0", "@ada/primes@^1.2.0"], { ...npm(), lock })).toEqual({
    "@ada/primes": "1.2.0",
    "@bob/extra": "2.0.0",
  });
});

test("ranges no one version meets throw, naming who asked", async () => {
  await expect(lockPackages(["@bob/extra@2.1.0", "@cat/old@1.0.0"], npm())).rejects.toThrow(
    "no version of @ada/primes satisfies ~1.1.0 (@bob/extra@2.1.0), ^2.0.0 (@cat/old@1.0.0)",
  );
  await expect(lockPackages(["@ada/primes@^9.0.0"], npm())).rejects.toThrow(
    "no version of @ada/primes satisfies ^9.0.0 (the host)",
  );
  await expect(lockPackages(["@ada/primes@banana"], npm())).rejects.toThrow("isn't a version range");
  await expect(lockPackages(["left-pad@^1.0.0"], npm())).rejects.toThrow("left-pad@1.3.0 isn't a symbol package");
});

test("the highest version whose system range admits the system's version", async () => {
  expect(await lockPackages(["@dee/sieve@^1.0.0"], { ...npm(), system: "0.2.0" })).toEqual({ "@dee/sieve": "1.2.0" });
  expect(await lockPackages(["@dee/sieve@^1.0.0"], { ...npm(), system: "0.1.0" })).toEqual({ "@dee/sieve": "1.1.0" });
  // A lock the system can't run moves.
  const lock = { "@dee/sieve": "1.2.0" };
  expect(await lockPackages(["@dee/sieve@^1.0.0"], { ...npm(), lock, system: "0.1.0" })).toEqual({
    "@dee/sieve": "1.1.0",
  });
  await expect(lockPackages(["@dee/sieve@1.2.0"], { ...npm(), system: "0.1.0" })).rejects.toThrow(
    "no version of @dee/sieve satisfies 1.2.0 (the host) and runs on the system 0.1.0",
  );
});
