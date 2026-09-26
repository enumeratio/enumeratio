// The enumeratio catalog, as resources in a context. Nothing here declares a
// compute-engine head — registering 280 collections costs one Map insert each.

import { CARRIERS, COLLECTIONS, MAPS, STATS } from "./catalog-records-data.ts";
import { ResourceRegistry } from "./registry.ts";
import type { Resource } from "./types.ts";

/** The context enumeratio's own catalog registers into. */
export const ENUMERATIO = "enumeratio";

/** Every catalog name as a resource, in the `enumeratio` context. */
export function catalogResources(context: string = ENUMERATIO): Resource[] {
  return [
    ...CARRIERS.map((c): Resource => ({ name: c.name, kind: "carrier", context })),
    ...COLLECTIONS.map((c): Resource => ({
      name: c.name,
      kind: "collection",
      context,
      ...(c.carrier ? { carrier: c.carrier } : {}),
      grades: c.grades,
      ...(c.description ? { description: c.description } : {}),
      ...(c.unbounded ? { unbounded: true } : {}),
    })),
    ...STATS.map((s): Resource => ({
      name: s.name,
      kind: "stat",
      context,
      on: s.on,
      ...(s.description ? { description: s.description } : {}),
    })),
    ...MAPS.map((m): Resource => ({
      name: m.name,
      kind: "map",
      context,
      on: m.on,
      ...(m.description ? { description: m.description } : {}),
    })),
  ];
}

/** A registry holding the whole catalog, with nothing blessed. Bare names do not resolve
 *  until a context is blessed — which is the point: the namespace is opt-in. */
export function catalogRegistry(context: string = ENUMERATIO): ResourceRegistry {
  return new ResourceRegistry().addAll(catalogResources(context));
}
