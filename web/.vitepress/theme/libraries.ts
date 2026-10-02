// The published libraries the site reads (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2),
// beside its own packages: a qualified name a page uses (`enumeratio.PolygonalNumber`) is
// fetched, checked and declared by the kernel the first time a call names it, over jsDelivr.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { compileNotation, registerNotation } from "@enumeratio/boxes";
import type { NotationData, Registry } from "@enumeratio/manifest";
import { catalog, githubHost, type LibraryField, type LibraryIndex } from "@enumeratio/manifest/libraries";

/** Each library at an exact version: GitHub's `owner/repo@version`. */
export const LIBRARIES: readonly string[] = ["enumeratio/library-template@0.1.0"];

/** The libraries as a registry, as a kernel reads them. */
export const libraryRegistry = (): Registry<ComputeEngine> => catalog<ComputeEngine>(LIBRARIES, { host: githubHost() });

/** A library definition's TraditionalForm, registered on the kernel's engine under its pinned head. */
export const registerLibraryNotation = (ce: ComputeEngine, head: string, data: NotationData): void =>
  registerNotation(ce, compileNotation(head, data).traditional);

/**
 * Each library symbol's parameter names, by qualified name, from the libraries' indexes: what
 * the markup on a page places named slots by (`<enumeratio.PolygonalNumber sides="5">`).
 */
export async function libraryParams(): Promise<Record<string, readonly string[]>> {
  const host = githubHost();
  const out: Record<string, readonly string[]> = {};
  for (const spec of LIBRARIES) {
    const at = spec.lastIndexOf("@");
    const [name, version] = [spec.slice(0, at), spec.slice(at + 1)];
    const field = ((await host.file(name, version, "package.json")) as { enumeratio?: LibraryField }).enumeratio;
    if (field === undefined) continue;
    const index = (await host.file(name, version, field.index)) as LibraryIndex;
    for (const [symbol, entry] of Object.entries(index.symbols))
      if (entry.params !== undefined) out[`${index.namespace}.${symbol}`] = entry.params;
  }
  return out;
}
