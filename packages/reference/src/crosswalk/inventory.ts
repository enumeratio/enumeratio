// Links for the Python systems, from their own documentation indexes. A reference into
// SymPy or Sage is usually recorded as a bare call -- `hurwitz_zeta($1, $2)`,
// `Permutations(n)` -- and the page it belongs on is not derivable from the name. Each of
// these systems publishes a Sphinx inventory that is, so the fetch script keeps the entries
// we mention (`inventory-data.ts`) and this resolves an identity against them.

import { inventory } from "../inventory-data.ts";

export type InventorySystem = "sympy" | "mpmath" | "sage" | "numpy" | "scipy";

export interface InventorySource {
  /** Documentation roots whose `objects.inv` to read; Sage's reference is split per subject. */
  readonly inventories: readonly string[];
  /**
   * Module prefixes in order of preference when a bare name is documented in several places
   * (`gamma` is a function in `sympy.functions` and a distribution in `sympy.stats`).
   */
  readonly prefer: readonly string[];
}

export const INVENTORIES: Readonly<Record<InventorySystem, InventorySource>> = {
  sympy: {
    inventories: ["https://docs.sympy.org/latest/"],
    prefer: [
      "sympy.functions.",
      "sympy.ntheory.",
      "sympy.combinatorics.",
      "sympy.utilities.iterables.",
      "sympy.core.",
      "sympy.",
    ],
  },
  mpmath: { inventories: ["https://mpmath.org/doc/current/"], prefer: ["mpmath."] },
  sage: {
    inventories: [
      "https://doc.sagemath.org/html/en/reference/combinat/",
      "https://doc.sagemath.org/html/en/reference/functions/",
      "https://doc.sagemath.org/html/en/reference/rings_standard/",
      "https://doc.sagemath.org/html/en/reference/groups/",
    ],
    prefer: ["sage.combinat.", "sage.functions.", "sage.arith.", "sage."],
  },
  numpy: { inventories: ["https://numpy.org/doc/stable/"], prefer: ["numpy."] },
  scipy: {
    inventories: ["https://docs.scipy.org/doc/scipy/"],
    prefer: ["scipy.special.", "scipy."],
  },
};

export const isInventorySystem = (system: string): system is InventorySystem =>
  system in INVENTORIES;

/** The name an identity is documented under: no call, no module path, no trailing note. */
export const bareName = (identity: string): string =>
  identity.replace(/\(.*$/, "").replace(/\s.*$/, "").replace(/^.*\./, "");

/** The dotted name, when the identity carries one (`sage.combinat.combinat.bell_number(n)`). */
const dottedName = (identity: string): string | undefined => {
  const head = identity.replace(/\(.*$/, "").replace(/\s.*$/, "");
  return head.includes(".") ? head : undefined;
};

// Functions and classes are what a reference points at; a method or attribute of the same
// bare name (`Permutation.inversions`) is a different thing, and so is a class member
// documented under a class (`QuasiSymmetricFunctions.psi`).
const OBJECT_ROLES = new Set(["py:function", "py:class", "py:data", "py:module"]);
const lastSegment = (name: string): string => name.slice(name.lastIndexOf(".") + 1);
const isMember = (name: string): boolean => /\.[A-Z]\w*\.\w+$/.test(name);

/**
 * Whether a documented object is the one a bare name means. Sage documents a callable as
 * the class behind it -- `zeta` is `Function_zeta`, `moebius` is `Moebius`, `euler_phi` is
 * `Euler_Phi` -- so those spellings count as the same name.
 */
export const documents = (name: string, bare: string): boolean => {
  const last = lastSegment(name).toLowerCase();
  const wanted = bare.toLowerCase();
  return last === wanted || last === `function_${wanted}`;
};

/**
 * The documented object for `identity` in `system`, if the inventory has it: an exact dotted
 * match, else the bare name under the most preferred module, else the first documented
 * object of that bare name. `undefined` when the system does not document it.
 */
export function inventoryEntry(
  system: string,
  identity: string,
): { readonly name: string; readonly url: string } | undefined {
  if (!isInventorySystem(system)) return undefined;
  const dotted = dottedName(identity);
  if (dotted) {
    const exact = inventory.find((e) => e.system === system && e.name === dotted);
    if (exact) return exact;
  }
  const bare = bareName(identity);
  const candidates = inventory.filter(
    (e) =>
      e.system === system &&
      OBJECT_ROLES.has(e.role) &&
      !isMember(e.name) &&
      documents(e.name, bare),
  );
  if (!candidates.length) return undefined;
  // The exact spelling anywhere beats a case variant (`Subsets` the class over `subsets` the
  // helper) beats Sage's `Function_` class; within a tier, the preferred module wins.
  const exact = candidates.filter((e) => lastSegment(e.name) === bare);
  const plain = candidates.filter((e) => lastSegment(e.name).toLowerCase() === bare.toLowerCase());
  for (const tier of [exact, plain, candidates]) {
    for (const prefix of INVENTORIES[system].prefer) {
      const found = tier.find((e) => e.name.startsWith(prefix));
      if (found) return found;
    }
  }
  return candidates[0];
}
