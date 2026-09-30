// Declaring a map between carriers: a function from an element of one to an element of
// another. This is what the carriers are for. Without them every map has the type
// `list<integer> -> list<integer>`, which is to say no type at all — two unrelated maps are
// indistinguishable to the engine and a composition of them is unchecked. With them, each map
// has a real signature, and the engine can act on it.
//
// A map's BODY is an expression over `_raw` (the contents of its argument), and its result is
// re-wrapped in the target carrier's constructor. So a map is data, like a statistic — and the
// same reduction analysis applies to it.
//
// The area-specific catalog of maps (their bodies, FindStat ids, the compiled fast paths) is
// each area's own data; this only declares whatever table of them a host hands over.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { attachConversion } from "./carriers.ts";
import { applyComposition } from "./compose.ts";
import { extendBuiltin } from "./extend.ts";
import { registerEquivalence, registerOperation } from "./operations.ts";

/** A map's law: f∘f = id, f∘f = f, or g∘f = id for the named map g. */
export type Law = "involution" | "idempotent" | { readonly inverse: string };

export interface MapDeclaration {
  readonly name: string;
  /** The carrier type this map takes. */
  readonly from: string;
  /** The carrier type it produces. */
  readonly to: string;
  /** The body, over `_raw` — the CONTENTS of the argument, since generic heads cannot see
   *  through a domain constructor. */
  readonly body?: unknown;
  /** A conversion between sibling carriers: no head of its own, but an overload of the target's
   *  constructor. Its `name` is that constructor, which is also its key for laws. */
  readonly convert?: boolean;
  /** A predicate over `_raw`, checked before `body`. When it evaluates to anything but
   *  `"True"` the map DECLINES — the call stays unevaluated, rather than answering wrong for a
   *  subject outside the map's actual domain. Absent, every subject of the right carrier is in
   *  domain. A guard may name `_image` for the MATERIALISED body: embedding the body
   *  expression itself hands a lazy `Map` to whatever reads it, and a kernel-backed statistic
   *  never finishes. */
  readonly guard?: unknown;
  /** Defined as a COMPOSITION of other maps, applied right to left. A composed map has no body
   *  of its own; it is the case that makes typed maps worth having, since each step's output
   *  type has to match the next step's input. */
  readonly composedOf?: readonly string[];
  /** Extra constructor arguments, for a carrier whose shape is a tuple. */
  readonly extra?: readonly unknown[];
  readonly summary: string;
  readonly note?: string;
  /** What Plausible checks on every element of every family over `from` (laws.ts). Beyond
   *  these, every map is checked to be TYPED: its result is a `to`. */
  readonly laws?: readonly Law[];
  /**
   * Whether the map preserves rank between two collections: the k-th element of `from` at
   * size n goes to the k-th of `to` at size n + `sizeOffset`. The strongest claim a bijection
   * can make; it lets either collection borrow the other's ranking.
   */
  readonly orderIsomorphism?: { readonly from: string; readonly to: string; readonly sizeOffset?: number };
}

/** What a map's definition gives for `contents` (MathJSON): the body, materialised, or
 *  undefined when its guard declines. */
export function evaluateDefinition(
  ce: ComputeEngine,
  map: Pick<MapDeclaration, "body" | "guard">,
  contents: unknown,
): unknown {
  const main = materialise(ce, ce.box(fill(map.body, contents) as never).evaluate());
  if (map.guard !== undefined) {
    const guard = fill(fill(map.guard, contents), main.json, "_image");
    if (ce.box(guard as never).evaluate().json !== "True") return undefined;
  }
  return main.json;
}

/** Force a lazy result into a concrete List.
 *
 *  `Map` and `Filter` over a `Range` stay lazy — `Range(1, 3)` does not even evaluate to a
 *  list on its own — which is right for a collection and wrong for a carrier VALUE. A
 *  permutation is a list of numbers, not a promise of one, so a map materialises before
 *  wrapping. */
function materialise(ce: ComputeEngine, value: BoxedExpression): BoxedExpression {
  // A Tuple is already a concrete value — and materialising one would flatten it into a
  // List, which is exactly wrong for a composite carrier like `standard_tableau_pair`.
  const concrete = value.operator === "List" || value.operator === "Tuple";
  let items: readonly BoxedExpression[];
  if (concrete) items = operandsOf(value);
  else {
    const size = ce.function("Count", [value]).evaluate().re;
    if (!Number.isFinite(size)) return value;
    items = Array.from({ length: size }, (_, index) => ce.function("At", [value, ce.number(index + 1)]).evaluate());
  }
  // An item may itself be lazy (a `Map` of `Filter`s), so each is forced too.
  const forced = items.map((item) =>
    item.operator !== "List" && item.isCollection === true ? materialise(ce, item) : item,
  );
  if (concrete && forced.every((item, index) => item === items[index])) return value;
  return ce.function(concrete ? value.operator : "List", forced).evaluate();
}

/** Replace `_raw` (or another placeholder) with the argument's contents, before boxing. */
function fill(node: unknown, contents: unknown, placeholder = "_raw"): unknown {
  if (node === placeholder) return contents;
  return Array.isArray(node) ? node.map((operand) => fill(operand, contents, placeholder)) : node;
}

export interface DeclareMapsOptions<M extends MapDeclaration> {
  /** The package extending built-ins with these maps, as the manifest names it. */
  readonly package: string;
  /** The map's definition as a function of its argument's contents — compiled, cached,
   *  whatever the host wants — or undefined when `map.body` is absent. Absent entirely, every
   *  map falls back to interpreting `evaluateDefinition` directly. */
  readonly definitionFor?: (map: M) => ((contents: unknown) => unknown) | undefined;
  /** FindStat (or another catalog's) ids for `map`, given the carrier constructor its `from`
   *  resolves to. Absent, no ids are registered. */
  readonly findstatFor?: (map: M, from: string) => readonly string[];
}

/** Declare each map, typed by carrier: it takes a constructed value of `from` and returns a
 *  constructed value of `to`, so a composition that does not typecheck is caught. */
export function declareMaps<M extends MapDeclaration>(
  ce: ComputeEngine,
  constructorFor: Readonly<Record<string, string>>,
  maps: readonly M[],
  options: DeclareMapsOptions<M>,
): void {
  const { package: hostPackage, definitionFor, findstatFor } = options;
  for (const map of maps) {
    const wrap = constructorFor[map.to];
    if (wrap === undefined) throw new Error(`no constructor for ${map.to}`);
    // The definition as it runs: whatever the host builds (compiled, memoized), or the
    // interpreter directly.
    const definition =
      map.body === undefined
        ? undefined
        : (definitionFor?.(map) ?? ((contents) => evaluateDefinition(ce, map, contents)));

    const handle = (subject: BoxedExpression): BoxedExpression | undefined => {
      // A composed map applies its steps right to left, each through its own declared head —
      // so every intermediate value is a properly constructed carrier and the composition is
      // type-checked at each step rather than only at the ends.
      if (map.composedOf !== undefined) return applyComposition(ce, map.composedOf, subject);
      const contents = operandsOf(subject)[0];
      if (contents === undefined) return undefined;
      const image = definition?.(contents.json);
      if (image === undefined) return undefined;
      const main = ce.box(image as never);
      const extra = (map.extra ?? []).map((argument) => ce.box(fill(argument, contents.json) as never).evaluate());
      // A tuple-shaped carrier takes ONE argument that is a Tuple, not several arguments —
      // a carrier like `finset` is `(members, n)`, so a map into it hands over a single Tuple.
      const argument = extra.length === 0 ? main : ce.function("Tuple", [main, ...extra]).evaluate();
      return ce.function(wrap, [argument]).evaluate();
    };

    const from = constructorFor[map.from];
    if (from !== undefined) {
      const findstat = findstatFor?.(map, from) ?? [];
      // One closed expression (no guard to decline with, no composition, no extra arguments) is
      // what a definition calling this map can be compiled through.
      const closed = map.body !== undefined && map.guard === undefined && map.extra === undefined;
      registerOperation(ce, "CombinatorialMap", from, {
        name: map.name,
        type: map.to,
        findstat,
        definition: handle,
        ...(closed ? { epsil: { expression: map.body, subject: "_raw", wrap } } : {}),
      });
      // A map with an inverse between two carriers makes them equivalent: what one carrier
      // defines, the other reaches through the map (set partitions and their growth strings).
      const to = constructorFor[map.to];
      if (to !== undefined && to !== from && map.laws?.some((law) => typeof law === "object"))
        registerEquivalence(ce, from, to, handle);
    }

    if (map.convert === true) {
      if (from === undefined || map.name !== wrap) throw new Error(`${map.name}: a conversion is named for its target`);
      attachConversion(ce, wrap, from, map.from, map.to, handle);
      continue;
    }

    // A map may reuse an existing compute-engine head (`Reverse`, `Complement`, `Inverse`).
    // Extending rather than replacing keeps every overload it had — see extend.ts for why that
    // is possible even for the collection-backed ones.
    const extended = extendBuiltin(ce, {
      package: hostPackage,
      head: map.name,
      on: map.from,
      returns: map.to,
      handle,
    });
    if (extended) continue;

    ce.declare(map.name, {
      signature: `(${map.from}) -> ${map.to}`,
      evaluate: (ops) => {
        const subject = ops[0];
        return subject === undefined ? undefined : handle(subject);
      },
    });
  }
}
