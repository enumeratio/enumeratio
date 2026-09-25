// Where each reference entry's YAML goes (design/examples-as-data.md §7): the package that
// declares its head. Extensions name it in `declared`. For an override that names nothing,
// the package is found by leaving each library out in turn: the one whose absence makes our
// answers match a bare engine again is the one overriding it. Heads that are
// compute-engine's own, and whatever the probe can't pin, stay in reference; ROUTES says
// otherwise by hand.
//
//   node packages/reference/scripts/migrate/route.ts     # writes migrate/routes.json

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { entryFiles } from "../../src/entries.ts";
import { provenance } from "../../src/provenance-data.ts";
import type { MathJSON } from "../../src/types.ts";
import { DECLARATIONS } from "../engines.ts";
import { divergences, findCall } from "../provenance.ts";

/** Hand calls, `<stem>/<Head>` → package name, where the rules below get it wrong. */
export const ROUTES: Readonly<Record<string, string>> = {
  // collections' own src/entries.ts already documents these; its file keeps the head there.
  "enumerable-families/Subsets": "@enumeratio/reference",
  "enumerable-families/SymmetricGroup": "@enumeratio/reference",
  "enumerable-families/IntegerPartitions": "@enumeratio/reference",
  "enumerable-families/SetPartitions": "@enumeratio/reference",
};

const root = fileURLToPath(new URL("../../../../", import.meta.url));

// `@enumeratio/<name>` → its directory, from the lockfile's importers.
const dirOf = new Map<string, string>();
for (const [, dir] of readFileSync(`${root}pnpm-lock.yaml`, "utf8").matchAll(
  /^ {2}(packages\/\S+):$/gm,
)) {
  const { name } = JSON.parse(readFileSync(`${root}${dir}/package.json`, "utf8")) as {
    name: string;
  };
  dirOf.set(name, dir!);
}

// `declareDiagrams` → `@enumeratio/diagram`, from engines.ts's own imports.
const packageOfDeclare = new Map(
  [
    ...readFileSync(new URL("../engines.ts", import.meta.url), "utf8").matchAll(
      /import \{ (declare\w+) \} from "(@enumeratio\/[\w-]+)\/src";/g,
    ),
  ].map(([, fn, pkg]) => [fn!, pkg!]),
);

const libraryToPackage = (library: string): string =>
  `@${library.replace(/^enumeratio-/, "enumeratio/")}`;

const engineWithout = (skip: number): ComputeEngine => {
  const ce = new ComputeEngine();
  DECLARATIONS.forEach((declare, i) => {
    if (i === skip) return;
    try {
      declare(ce);
    } catch {
      // A library that needs the skipped one can't declare without it; it's left out too.
    }
  });
  return ce;
};

const record = new Map(provenance.map((r) => [r.name, r]));
const bare = new ComputeEngine();
const all = engineWithout(-1);
const without = DECLARATIONS.map((_, i) => engineWithout(i));

interface Route {
  readonly package: string;
  readonly why: string;
}
const routes: Record<string, Route> = {};
for (const { stem, entries } of entryFiles) {
  for (const entry of entries) {
    const key = `${stem}/${entry.name}`;
    const r = record.get(entry.name);
    const hand = ROUTES[key];
    if (hand !== undefined) {
      routes[key] = { package: hand, why: "hand" };
      continue;
    }
    if (r?.declared) {
      routes[key] = { package: libraryToPackage(r.declared), why: `declared ${r.declared}` };
      continue;
    }
    if (r?.provenance !== "override") {
      routes[key] = { package: "@enumeratio/reference", why: r?.provenance ?? "no row" };
      continue;
    }
    const corpus = entry.examples
      .map((example) => findCall(example.expr as MathJSON, entry.name))
      .filter((call): call is MathJSON => call !== undefined);
    const changed = divergences(bare, all, corpus).map((d) => JSON.stringify(d.expression));
    const owners = DECLARATIONS.flatMap((declare, i) => {
      const still = new Set(
        divergences(bare, without[i]!, corpus).map((d) => JSON.stringify(d.expression)),
      );
      return changed.some((c) => !still.has(c)) ? [packageOfDeclare.get(declare.name)!] : [];
    });
    routes[key] =
      owners.length === 1
        ? { package: owners[0]!, why: "override; only it changes the answers" }
        : {
            package: "@enumeratio/reference",
            why: `override; changed by ${owners.join(", ") || "none alone"}`,
          };
  }
}

for (const { package: pkg } of Object.values(routes))
  if (!dirOf.has(pkg)) throw new Error(`no workspace package ${pkg}`);

writeFileSync(
  new URL("./routes.json", import.meta.url),
  `${JSON.stringify(
    Object.fromEntries(
      Object.entries(routes).map(([k, v]) => [k, { ...v, dir: dirOf.get(v.package) }]),
    ),
    null,
    2,
  )}\n`,
);
const tally: Record<string, number> = {};
for (const { package: pkg } of Object.values(routes)) tally[pkg] = (tally[pkg] ?? 0) + 1;
console.log(tally);
for (const [k, v] of Object.entries(routes))
  if (v.why.startsWith("override; changed")) console.log(`  ${k}: ${v.why}`);
