// A library symbol's definition as its author writes it, in Epsil in its record's front matter,
// made into what `definition.json` holds (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2):
//
//   definition:
//     signature: (n: integer, sides: integer?) -> integer
//     body: Sum(enumeratio.PolygonalNumber(k, sides), (k, 1, n))
//     defaults: { sides: "3" }
//
// The body becomes a `Function` over the signature's parameter names (parsed as a lambda, so the
// parameters shadow the engine's own names), each default is parsed,
// and every qualified name the body uses is pinned: the library's own symbols at the pin their
// own definitions get, a dependency's at the pin its installed index gives, anything else only
// if the author wrote it in `requires`.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseEpsil, resolveLibraryNames } from "@cortex-js/compute-engine/epsil";
import type { EpsilDefinition, SymbolAttribute } from "@enumeratio/entry";
import { type Definition, pinOf, qualifiedNamesOf, shortForm } from "../src/registry.ts";

let engine: ComputeEngine | undefined;

/** Epsil as short-form MathJSON, or an error naming where it came from. */
function parsed(epsil: string, where: string): unknown {
  const [json, diagnostics] = parseEpsil(epsil);
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) throw new Error(`${where}: ${errors.map((d) => d.message).join("; ")} in ${epsil}`);
  resolveLibraryNames(json, epsil, (engine ??= new ComputeEngine()) as never);
  return shortForm(json);
}

/** A signature's parameter names, in order: `(n: integer, sides: integer?) -> integer` is `[n, sides]`. */
export function parameterNames(signature: string): string[] | undefined {
  const open = signature.indexOf("(");
  if (open !== 0) return undefined;
  let depth = 0;
  let close = -1;
  for (let i = 0; i < signature.length && close < 0; i++) {
    if ("(<[{".includes(signature[i]!)) depth++;
    else if (")>]}".includes(signature[i]!) && --depth === 0) close = i;
  }
  if (close < 0) return undefined;
  const params: string[] = [];
  let start = 1;
  depth = 0;
  const inner = signature.slice(0, close);
  for (let i = 1; i <= inner.length; i++) {
    const c = inner[i];
    if (c !== undefined && "(<[{".includes(c)) depth++;
    else if (c !== undefined && ")>]}".includes(c)) depth--;
    else if ((c === "," && depth === 0) || i === inner.length) {
      const part = inner.slice(start, i).trim();
      start = i + 1;
      if (part === "") continue;
      const name = /^([A-Za-z_][\w]*)\s*:/.exec(part)?.[1];
      if (name === undefined) return undefined;
      params.push(name);
    }
  }
  return params;
}

/**
 * Each symbol's definition from its record's `definition`, pinned. `pinOfDependency` answers a
 * qualified name another installed library serves. Throws on a body that doesn't parse, a
 * signature without parameter names, a name nothing pins, or two symbols that use each other.
 */
export async function definitionsOf(
  namespace: string,
  written: Readonly<Record<string, { definition: EpsilDefinition; attributes?: readonly SymbolAttribute[] }>>,
  pinOfDependency: (qualified: string) => string | undefined,
): Promise<Record<string, Definition>> {
  const done = new Map<string, Promise<Definition>>();
  const make = (name: string, path: readonly string[]): Promise<Definition> => {
    if (path.includes(name)) throw new Error(`${[...path, name].join(" uses ")}: a pin can't depend on itself`);
    const found = done.get(name);
    if (found !== undefined) return found;
    const made = (async () => {
      const { definition, attributes } = written[name]!;
      const params = parameterNames(definition.signature);
      if (params === undefined)
        throw new Error(`${name}: give each parameter of ${definition.signature} a name (\`n: integer\`)`);
      // As a lambda, so a parameter keeps its name: alone, `factor` would resolve to `Factor`.
      const body = parsed(`(${params.join(", ")}) => (${definition.body})`, `${name}'s body`);
      const requires: Record<string, string> = {};
      for (const used of [...qualifiedNamesOf(body)].toSorted()) {
        const [ns, member] = used.split(".") as [string, string];
        const pin =
          definition.requires?.[used] ??
          (ns === namespace && member in written
            ? await pinOf(await make(member, [...path, name]))
            : pinOfDependency(used));
        if (pin === undefined)
          throw new Error(`${name} uses ${used}, and nothing installed pins it: add it to requires`);
        requires[used] = pin;
      }
      const defaults = Object.fromEntries(
        Object.entries(definition.defaults ?? {}).map(([p, epsil]) => [p, parsed(epsil, `${name}'s default for ${p}`)]),
      );
      return {
        signature: definition.signature,
        body,
        ...(Object.keys(requires).length > 0 ? { requires } : {}),
        ...(attributes?.length ? { attributes } : {}),
        ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
      };
    })();
    done.set(name, made);
    return made;
  };
  const out: Record<string, Definition> = {};
  for (const name of Object.keys(written).toSorted()) out[name] = await make(name, []);
  return out;
}
