// combinatorics' maps' generated reference entries (maps used to live in combinatorics' now-
// retired domains area) — one per combinatorial map, plus one per undefined map on the
// frontier. Same shape and the same reason as the statistics entries: the map data carries a
// signature and a summary but no worked example, so this evaluates each map at a fixed subject
// and pins the answer. scripts/collect-map-entries.ts writes them; tests/map-
// generated.test.ts checks they're current.
//
// Used to live in @enumeratio/statistics, not combinatorics, because it needed
// declareStatistics and combinatorics couldn't devDep statistics without cycling back
// (per enumeratio#408) — moot since step 6b moved declareStatistics into combinatorics itself.

import { bareEngine } from "@enumeratio/engine/testing";
import type { ReferenceEntry, ReferenceExample } from "@enumeratio/entry";
import type { GeneratedEntries } from "@enumeratio/entry/node";
import { captionId, dedupeId } from "@enumeratio/entry";
import {
  CARRIERS,
  type CombinatorialMap,
  declareCombinatorics,
  declareMaps,
  MAPS,
  UNDEFINED_MAPS,
} from "../src/index.ts";

/** A sample value per carrier TYPE, as the contents a constructor wraps. */
const SAMPLES: Record<string, { contents: unknown; caption: string }> = {
  permutation: { contents: ["List", 2, 3, 1], caption: "the one-line word $231$" },
  signed_permutation: { contents: ["List", 2, -3, 1], caption: "the signed permutation $2\\,\\bar 3\\,1$" },
  integer_partition: { contents: ["List", 4, 2, 1], caption: "the partition $4 + 2 + 1$" },
  binary_tree: {
    contents: ["List", ["List", 0, 0], ["List", 0, ["List", 0, 0]]],
    caption: "a four-node tree",
  },
  ordered_tree: {
    contents: ["List", ["List", ["List"], ["List"]], ["List"]],
    caption: "an ordered tree with four edges",
  },
  binary_tree_parent_array: { contents: ["List", 2, 0, 2, 3], caption: "the parent array $2023$" },
  dyck_path: { contents: ["List", 1, 1, 0, 0, 1, 0], caption: "the Dyck path $UUDDUD$" },
  set_partition: {
    contents: ["List", ["List", 1, 3], ["List", 2], ["List", 4]],
    caption: "the set partition $\\{1,3\\} \\mid \\{2\\} \\mid \\{4\\}$",
  },
  restricted_growth_string: { contents: ["List", 0, 1, 0, 2], caption: "the restricted growth string $0102$" },
  set_composition: {
    contents: ["List", ["List", 2, 4], ["List", 1], ["List", 3]],
    caption: "the set composition $\\{2,4\\} \\mid \\{1\\} \\mid \\{3\\}$",
  },
  surjection: { contents: ["List", 2, 1, 3, 1], caption: "the surjection $2131$" },
  composition: { contents: ["List", 2, 1, 3], caption: "the composition $2 + 1 + 3$" },
  standard_tableau_pair: {
    contents: [
      "Tuple",
      ["StandardTableau", ["List", ["List", 1, 3], ["List", 2]]],
      ["StandardTableau", ["List", ["List", 1, 2], ["List", 3]]],
    ],
    caption: "the pair of tableaux $13/2$ and $12/3$",
  },
  binary_word: { contents: ["List", 0, 1, 1, 0, 0], caption: "the binary word $01100$" },
  standard_tableau: {
    contents: ["List", ["List", 1, 3], ["List", 2]],
    caption: "the standard tableau with rows $13$ and $2$",
  },
};

const constructorFor = Object.fromEntries(CARRIERS.map((c) => [c.type, c.name]));
const ce = bareEngine();
declareCombinatorics(ce);
declareMaps(ce, constructorFor);

/** Ids for a head's examples, from their captions (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §3). */
const withIds = (examples: readonly { caption?: string }[]): ReferenceExample[] => {
  const taken = new Set<string>();
  return examples.map((e) => ({
    id: dedupeId(captionId(e.caption ?? "") || "example", taken),
    ...e,
  })) as ReferenceExample[];
};

/** The carrier name a signature reads, as the constructor spells it. */
const carrier = (type: string): string => constructorFor[type] ?? type;

function exampleFor(map: CombinatorialMap): { expr: unknown; expected: unknown; caption?: string }[] {
  const sample = SAMPLES[map.from];
  if (sample === undefined) return [];
  const subject = [carrier(map.from), sample.contents];
  const expr = [map.name, subject];
  const result = ce.box(expr as never).evaluate();
  const text = JSON.stringify(result.json);
  if (result.json === undefined || text.includes("Error")) return [];
  return [{ expr, expected: result.json, caption: sample.caption }];
}

/** One record per head, however many carriers it is a map over (`Reverse` is one per carrier): the
 *  first overload gives the signature and summary, and each further one adds a detail and an example. */
const entryFor = (overloads: readonly CombinatorialMap[]): ReferenceEntry => {
  const [map] = overloads as [CombinatorialMap, ...CombinatorialMap[]];
  const details = overloads.flatMap((overload, index) => [
    index === 0
      ? `Takes a \`${carrier(overload.from)}\` and returns a \`${carrier(overload.to)}\` — a typed map, so a wrong carrier is a type error rather than a wrong answer.`
      : `Also takes a \`${carrier(overload.from)}\`, returning a \`${carrier(overload.to)}\`: ${overload.summary}`,
    ...(overload.composedOf === undefined
      ? []
      : [
          `Defined as a COMPOSITION, applied right to left: ${overload.composedOf.map((step) => `[[${step}]]`).join(" after ")}. Each step goes through its own declared head, so every intermediate value is a properly constructed carrier.`,
        ]),
    ...(overload.note === undefined ? [] : [overload.note]),
  ]);
  const composedOf = [...new Set(overloads.flatMap((overload) => overload.composedOf ?? []))];
  return {
    name: map.name,
    domain: "Combinatorial maps",
    signature: `${map.name}(${carrier(map.from)})`,
    summary: map.summary,
    details,
    examples: withIds(overloads.flatMap(exampleFor)),
    ...(composedOf.length === 0 ? {} : { seeAlso: composedOf }),
  };
};

/** The non-conversion maps, grouped by head, in declaration order. */
const mapsByName = (): CombinatorialMap[][] => {
  const groups = new Map<string, CombinatorialMap[]>();
  for (const map of MAPS.filter((m) => m.convert !== true))
    groups.set(map.name, [...(groups.get(map.name) ?? []), map]);
  return [...groups.values()];
};

const frontierEntryFor = (map: (typeof UNDEFINED_MAPS)[number]): ReferenceEntry => {
  const sample = SAMPLES[map.from];
  const examples =
    sample === undefined
      ? []
      : [
          {
            expr: [map.name, [carrier(map.from), sample.contents]],
            // Aspirational: the head is NOT declared, so this records what it would answer
            // and the test asserts the gap is still open.
            expected: ["List"],
            caption: `${sample.caption} — once there is a definition to evaluate`,
            role: "aspirational" as const,
          },
        ];
  return {
    name: map.name,
    domain: "Combinatorial maps",
    signature: `${map.name}(${carrier(map.from)})`,
    summary: `${map.why} Not yet defined.`,
    details: [
      `Would take a \`${carrier(map.from)}\` to a \`${carrier(map.to)}\`.`,
      `On the map frontier: ${map.why}`,
      "Declared undefined for that reason.",
    ],
    examples: withIds(examples),
  };
};

/** One entry per combinatorial map, plus one per undefined map, whose single example is
 * aspirational: the head has no definition, so the example records what it would answer and
 * the test asserts the gap is still open. */
export const generated: GeneratedEntries = {
  entries: [...mapsByName().map(entryFor), ...UNDEFINED_MAPS.map(frontierEntryFor)],
  owned: new Set([...MAPS.filter((m) => m.convert !== true), ...UNDEFINED_MAPS].map((m) => m.name)),
  // Anything else on a record (`formerly`, `references`, `names`) is curated by hand.
  fields: new Set(["name", "domain", "signature", "summary", "details", "examples", "seeAlso"]),
};
