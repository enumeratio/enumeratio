// A published library's records, for a scan of the systems it tracks
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.4): its heads, read from
// the folder its index sits in, the targets its `enumeratio.mappings` names, and the mappings its
// records' `origin: mapped` bindings make, by the name an expression calls each head (`ns.Name`).

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ReferenceEntry } from "@enumeratio/entry";
import { headNames, readHead } from "@enumeratio/entry/node";
import type { Mapping } from "@enumeratio/oracle";
// From the source, as collect-mappings does: oracle's build runs before oracle is built.
import { mappingsFromBindings } from "../../oracle/src/mapping-rows.ts";

export interface LibraryHead {
  readonly head: string;
  readonly dir: string;
  readonly entry: ReferenceEntry;
  readonly implementations?: Record<string, unknown>;
}

export interface LibraryRecords {
  readonly namespace: string;
  /** The systems and sources it tracks. */
  readonly targets: readonly string[];
  readonly heads: readonly LibraryHead[];
  readonly mappings: readonly Mapping[];
}

/** The library rooted at `root`, as its `package.json` describes it. */
export function libraryRecords(root: string): LibraryRecords {
  const at = resolve(root);
  const field = (
    JSON.parse(readFileSync(join(at, "package.json"), "utf8")) as {
      enumeratio?: { namespace: string; index: string; mappings?: readonly string[] };
    }
  ).enumeratio;
  if (field === undefined) throw new Error(`${at}: package.json has no "enumeratio" field`);
  const dir = dirname(join(at, field.index));
  const heads = headNames(dir).map((head) => {
    const { entry, implementations } = readHead(dir, head);
    return { head, dir, entry, ...(implementations === undefined ? {} : { implementations }) };
  });
  const mappings = mappingsFromBindings(
    heads.map(({ entry }) => ({ name: `${field.namespace}.${entry.name}`, bindings: entry.bindings })),
  );
  return { namespace: field.namespace, targets: field.mappings ?? [], heads, mappings };
}
