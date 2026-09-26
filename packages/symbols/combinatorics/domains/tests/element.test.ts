// `Element(x, <plural>)` membership (design/domains.md §2, `declareDomainElement` in
// declare.ts): True for a value of the matching carrier, False for one of ours on a
// DIFFERENT carrier, unevaluated for anything else (a bare symbol, a value with no
// declared carrier at all).

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareDomainElement, declareDomainPlurals, declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import type { Domain } from "../src/types.ts";

const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  declareDomains(ce);
  // No collections declared in this package's own tests, so every plural is free to mint.
  declareDomainPlurals(ce);
  declareDomainElement(ce);
  return ce;
};

/** Split `tuple<A, B, …>`'s inner list on top-level commas — a shape can nest (`tuple<list
 *  <integer>, list<integer>>`), so a plain `.split(",")` would cut inside the nested one. */
function splitArgs(inner: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "<") depth++;
    if (ch === ">") depth--;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim().length > 0) args.push(current.trim());
  return args;
}

/** A structurally-valid (not necessarily combinatorially meaningful) MathJSON value for a
 *  shape: a leaf primitive, a one-element `list<...>`, a `tuple<...>` of its parts, or —
 *  for a composite carrier's shape naming another carrier by TYPE (a tableau pair is two
 *  tableaux) — that other domain's own constructor, applied recursively. */
function sampleFor(shape: string, byType: ReadonlyMap<string, Domain>): unknown {
  if (shape === "integer" || shape === "number") return 1;
  if (shape === "string") return "'a'";
  if (shape === "boolean") return true;
  if (shape.startsWith("list<")) return ["List", sampleFor(shape.slice(5, -1), byType)];
  if (shape.startsWith("tuple<")) {
    return ["Tuple", ...splitArgs(shape.slice(6, -1)).map((part) => sampleFor(part, byType))];
  }
  const domain = byType.get(shape);
  if (domain === undefined) throw new Error(`element.test.ts: no sample for shape "${shape}"`);
  return [domain.name, sampleFor(domain.shape, byType)];
}

test("Element(DyckPath([1, 0]), DyckPaths) is True", () => {
  const ce = engine();
  expect(ce.box(["Element", ["DyckPath", ["List", 1, 0]], "DyckPaths"]).evaluate().json).toBe("True");
});

test("Element(Permutation([1]), DyckPaths) is False", () => {
  const ce = engine();
  expect(ce.box(["Element", ["Permutation", ["List", 1]], "DyckPaths"]).evaluate().json).toBe("False");
});

test("Element stays unevaluated for a bare, unresolved symbol", () => {
  const ce = engine();
  const result = ce.box(["Element", "unresolvedThing", "DyckPaths"]).evaluate();
  expect(result.operator).toBe("Element");
});

test("a compute-engine native meaning still answers when x is not one of ours", () => {
  // RationalNumbers is both a compute-engine native (the mathematical set of all rationals)
  // and one of our own carriers (@enumeratio/domains' rational_number) -- our layer only
  // claims the case it recognises, so a plain number still gets compute-engine's own answer.
  const ce = engine();
  expect(ce.box(["Element", 3, "RationalNumbers"]).evaluate().json).toBe("True");
});

test("every domain with a plural answers Element for its own constructor", () => {
  const ce = engine();
  const byType = new Map(DOMAINS.map((d) => [d.type, d]));
  for (const domain of DOMAINS) {
    if (domain.plural === undefined) continue;
    const value = [domain.name, sampleFor(domain.shape, byType)];
    const result = ce.box(["Element", value, domain.plural] as never).evaluate();
    expect(result.json, `Element(${domain.name}(…), ${domain.plural})`).toBe("True");
  }
});

test("the two domains with no plural type space stay that way", () => {
  const noPlural = DOMAINS.filter((d) => d.plural === undefined).map((d) => d.name);
  expect(noPlural).toEqual(["ContinuedFraction", "PermutationCycles"]);
});
