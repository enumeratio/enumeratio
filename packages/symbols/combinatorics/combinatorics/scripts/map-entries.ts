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

import { ComputeEngine } from "@cortex-js/compute-engine";
import type { ReferenceEntry, ReferenceExample } from "@enumeratio/entry";
import type { GeneratedEntries } from "@enumeratio/entry/node";
import { captionId, dedupeId } from "@enumeratio/entry";
import { ALL_STATISTICS } from "../src/statistics/all.ts";
import { declareStatistics } from "../src/statistics/declare.ts";
import {
  CARRIERS,
  type CombinatorialMap,
  declareCombinatoricsCarriers,
  declareMaps,
  MAPS,
  UNDEFINED_MAPS,
} from "../src/index.ts";

/** A sample value per carrier TYPE, as the contents a constructor wraps. */
const SAMPLES: Record<string, { contents: unknown; caption: string }> = {
  permutation: { contents: ["List", 2, 3, 1], caption: "the one-line word $231$" },
  integer_partition: { contents: ["List", 3, 2, 1], caption: "the partition $3 + 2 + 1$" },
  binary_tree: {
    contents: ["List", ["List", 0, 0], ["List", 0, ["List", 0, 0]]],
    caption: "a four-node tree",
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
  binary_word: { contents: ["List", 0, 1, 1, 0, 0], caption: "the binary word $01100$" },
};

const constructorFor = Object.fromEntries(CARRIERS.map((c) => [c.type, c.name]));
const ce = new ComputeEngine();
declareCombinatoricsCarriers(ce);
// A guard may read a statistic (KrewerasComplement's counts cycles), so the statistics go in
// before the maps — the same order tests/entries.test.ts uses.
declareStatistics(ce, ALL_STATISTICS, {
  domainTypes: Object.fromEntries(CARRIERS.map((c) => [c.name, c.type])),
});
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

const entryFor = (map: CombinatorialMap): ReferenceEntry => {
  const details = [
    `Takes a \`${carrier(map.from)}\` and returns a \`${carrier(map.to)}\` — a typed map, so a wrong carrier is a type error rather than a wrong answer.`,
    ...(map.composedOf === undefined
      ? []
      : [
          `Defined as a COMPOSITION, applied right to left: ${map.composedOf.map((step) => `[[${step}]]`).join(" after ")}. Each step goes through its own declared head, so every intermediate value is a properly constructed carrier.`,
        ]),
    ...(map.note === undefined ? [] : [map.note]),
  ];
  return {
    name: map.name,
    domain: "Combinatorial maps",
    signature: `${map.name}(${carrier(map.from)})`,
    summary: map.summary,
    details,
    examples: withIds(exampleFor(map)),
    ...(map.composedOf === undefined ? {} : { seeAlso: [...map.composedOf] }),
  };
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
            aspirational: true,
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
      "Listed in `UNDEFINED_MAPS` (@enumeratio/combinatorics) with that reason — a claim to be justified, not a place to put anything inconvenient.",
    ],
    examples: withIds(examples),
  };
};

/** One entry per combinatorial map, plus one per undefined map, whose single example is
 * aspirational: the head has no definition, so the example records what it would answer and
 * the test asserts the gap is still open. */
export const generated: GeneratedEntries = {
  entries: [...MAPS.filter((m) => m.convert !== true).map(entryFor), ...UNDEFINED_MAPS.map(frontierEntryFor)],
  owned: new Set([...MAPS.filter((m) => m.convert !== true), ...UNDEFINED_MAPS].map((m) => m.name)),
  // Anything else on a record (`formerly`, `references`, `names`) is curated by hand.
  fields: new Set(["name", "domain", "signature", "summary", "details", "examples", "seeAlso"]),
};
