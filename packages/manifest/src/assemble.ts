// The manifest assembled from each library's slice of it (https://github.com/enumeratio/enumeratio/wiki/Speculative-Per-Package-Repos
// §4.1): a library's index carries what its records say about the heads it documents, and the
// tables every consumer reads (`SYMBOLS`, each package's declared symbols and example counts, the
// notation entries) are put together from the indexes a distribution has. Here for the build, and
// for a host that assembles from the libraries it installs.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { canonicalOrder } from "./canonical.ts";
import type { DeclaredSymbol, FindStatId, Overload, SymbolAttribute, SymbolInfo } from "./types.ts";

const ENGINE = "compute-engine";
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A signature row of a record: the call form a library contributes, and its type. */
export interface IndexedSignature {
  readonly library?: string;
  readonly type?: string;
  readonly overrides?: string;
  readonly on?: readonly string[];
  readonly symbols?: readonly string[];
  readonly types?: readonly string[];
}

/** What a library's record says about a head, as far as the manifest reads it. */
export interface IndexedRecord {
  readonly name: string;
  readonly summary: string;
  /** Its usage line, `SetMinus(a, b)`, which names the parameters. */
  readonly signature?: string;
  readonly attributes?: readonly SymbolAttribute[];
  readonly references?: readonly { readonly system: string; readonly identity: string; readonly on?: string }[];
  readonly catalog?: readonly { readonly system: string; readonly identity: string; readonly on?: string }[];
  readonly signatures?: readonly IndexedSignature[];
}

/** A library's slice of the manifest: its records, in head order, and its notation entry. */
export interface PackageIndex {
  /** Its manifest name: `boxes`, not `@enumeratio/boxes`. */
  readonly package: string;
  /** The specifier a host imports its notation entry by. */
  readonly notation?: string;
  readonly records: readonly { readonly record: IndexedRecord; readonly examples: number }[];
}

/** compute-engine's own heads, as a bare engine has them, and an engine to type overloads with. */
export interface EngineHeads {
  /** Each capitalised name a bare engine defines, by its signature or type. */
  readonly types: ReadonlyMap<string, string>;
  readonly typing: ComputeEngine;
}

export interface Manifest {
  readonly symbols: Record<string, SymbolInfo>;
  /** What each package's `declare` reads for each head it documents. */
  readonly declared: ReadonlyMap<string, Record<string, DeclaredSymbol>>;
  /** How many examples each head's record shows, by package, where it has any. */
  readonly examples: ReadonlyMap<string, Record<string, number>>;
  readonly notations: Record<string, string>;
}

/** A signature row's `library`, as the package it names: `enumeratio-boxes` and
 *  `@enumeratio/boxes` are both `boxes`; absent is the engine's own. */
export const packageOf = (library: string | undefined): string =>
  library === undefined ? ENGINE : library.replace(/^@enumeratio\//, "").replace(/^enumeratio-/, "");

/** `SetMinus(a, b)` -> `["a", "b"]`, for a fixed arity spelled with plain names. */
function paramsOf(signature: string | undefined): string[] | undefined {
  const m = signature === undefined ? null : /^\w+\((.*)\)$/.exec(signature.trim());
  if (!m || m[1]!.includes("…") || m[1]!.includes("...")) return undefined;
  const list = m[1]!
    .split(",")
    .map((p) => p.trim().replace(/\?$/, ""))
    .filter((p) => p.length > 0);
  return list.length > 0 && list.every((p) => /^[a-z][A-Za-z0-9]*$/.test(p)) ? list : undefined;
}

/** The manifest from `indexes`, in the order given, and compute-engine's own heads. */
export function assembleManifest(indexes: readonly PackageIndex[], engine: EngineHeads): Manifest {
  const records = indexes.flatMap((index) =>
    index.records.map(({ record, examples }) => ({ package: index.package, record, examples })),
  );

  const byName = new Map<
    string,
    {
      documented: string[];
      overloads: Overload[];
      params?: string[];
      attributes: Set<SymbolAttribute>;
      findstat: Map<string, FindStatId>;
    }
  >();
  const entry = (name: string) => {
    let info = byName.get(name);
    if (info === undefined)
      byName.set(name, (info = { documented: [], overloads: [], attributes: new Set(), findstat: new Map() }));
    return info;
  };

  for (const [name, type] of engine.types) entry(name).overloads.push({ package: ENGINE, type });

  // reference's own copy of a head is the canonical one (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §9), so
  // its signature spells the parameter names when it has one.
  const ranked = [...records].toSorted((a, b) =>
    cmp(a.package === "reference" ? "0" : "1", b.package === "reference" ? "0" : "1"),
  );
  for (const { package: pkg, record } of ranked) {
    const info = entry(record.name);
    info.documented.push(pkg);
    info.params ??= paramsOf(record.signature);
    for (const attribute of record.attributes ?? []) info.attributes.add(attribute);
    for (const row of [...(record.references ?? []), ...(record.catalog ?? [])])
      if (row.system === "findstat")
        info.findstat.set(`${row.identity}@${row.on ?? ""}`, {
          id: row.identity,
          ...(row.on !== undefined ? { on: row.on } : {}),
        });
    for (const row of record.signatures ?? []) {
      const from = packageOf(row.library);
      if (from === ENGINE) continue; // the engine's overload already came from the engine
      const same = info.overloads.find((o) => o.package === from && o.type === row.type);
      const untyped = info.overloads.find((o) => o.package === from && o.type === undefined);
      if (same !== undefined) continue;
      if (untyped !== undefined && row.type !== undefined) info.overloads.splice(info.overloads.indexOf(untyped), 1);
      else if (row.type === undefined && info.overloads.some((o) => o.package === from)) continue;
      info.overloads.push({
        package: from,
        ...(row.type !== undefined ? { type: row.type } : {}),
        ...(row.overrides !== undefined ? { overrides: packageOf(row.overrides) } : {}),
        ...(row.on !== undefined ? { on: row.on } : {}),
        ...(row.symbols !== undefined ? { symbols: row.symbols } : {}),
        ...(row.types !== undefined ? { types: row.types } : {}),
      });
    }
  }

  // A head's overloads in canonical order (canonical.ts), typed against a bare engine.
  const symbols: Record<string, SymbolInfo> = {};
  for (const name of [...byName.keys()].toSorted(cmp)) {
    const info = byName.get(name)!;
    symbols[name] = {
      name,
      documented: info.documented.toSorted(cmp),
      overloads: canonicalOrder(info.overloads, engine.typing),
      ...(info.params !== undefined ? { params: info.params } : {}),
      ...(info.attributes.size > 0 ? { attributes: [...info.attributes].toSorted(cmp) } : {}),
      ...(info.findstat.size > 0
        ? { findstat: [...info.findstat.keys()].toSorted(cmp).map((key) => info.findstat.get(key)!) }
        : {}),
    };
  }

  // What each package's `declare` reads: its records' summaries, and its own typed overload.
  const declared = new Map<string, Record<string, DeclaredSymbol>>();
  const examples = new Map<string, Record<string, number>>();
  for (const { package: pkg, record, examples: count } of records) {
    if (count > 0) examples.set(pkg, { ...examples.get(pkg), [record.name]: count });
    const own = (record.signatures ?? []).filter((row) => packageOf(row.library) === pkg && row.type !== undefined);
    const types = new Set(own.map((row) => row.type));
    if (types.size > 1) {
      // One declared signature per head until dispatch can combine overloads (https://github.com/enumeratio/enumeratio/wiki/Manifest).
      throw new Error(`manifest: ${pkg} gives ${record.name} ${types.size} types; one per package for now`);
    }
    const table = declared.get(pkg) ?? {};
    table[record.name] = {
      summary: record.summary,
      ...(own[0]?.type !== undefined ? { type: own[0].type } : {}),
      ...(record.attributes !== undefined ? { attributes: record.attributes } : {}),
    };
    declared.set(pkg, table);
  }

  const notations = Object.fromEntries(
    indexes.flatMap((index) => (index.notation === undefined ? [] : [[index.package, index.notation]])),
  );
  return { symbols, declared, examples, notations };
}
