// Our packages as a library hierarchy: each one a library extension over a small base. What
// a package extends is what the resolver declares before it (`plan`'s requirements), and the
// only packages its code may import, with the infrastructure. Each package states its place
// in its `package.json` (`enumeratio.layer`, `extends`, `area`); the build gathers them, and
// `tests/hierarchy.test.ts` holds the code to them.

import { HIERARCHY_DATA } from "./generated/hierarchy.ts";
import type { Area, Layer } from "./package-field.ts";

export type { Layer };

export interface Placement {
  readonly layer: Layer;
  /** The libraries it extends: declared before it, and all it may import besides infra. */
  readonly extends: readonly string[];
  /** The family it belongs to, where one is settled. */
  readonly area?: Area;
}

/** Each package by manifest name. An entry point placed apart from its package is keyed
 *  `package/subpath` (boxes' serialisers). */
export const HIERARCHY: Readonly<Record<string, Placement>> = HIERARCHY_DATA;

/** Each package's requirements for `plan`: what it extends. */
export const PACKAGES: Readonly<Record<string, { readonly requires: readonly string[] }>> = Object.fromEntries(
  Object.entries(HIERARCHY).map(([name, placement]) => [name, { requires: placement.extends }]),
);
