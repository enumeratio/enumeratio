// Generate `reference/*.yaml` — one reference entry per combinatorial map, plus one per
// undefined map on the frontier. Same shape and the same reason as the statistics
// generator next door: the map data carries a signature and a summary but no worked
// example, so this evaluates each map at a fixed subject and writes the answer out inline.
//
//   vp node packages/symbols/combinatorics/domains/scripts/collect-entries.ts

import { ComputeEngine } from "@cortex-js/compute-engine";
import type { ReferenceEntry } from "@enumeratio/entry";
import { writeEntries } from "@enumeratio/entry/node";
import { captionId, dedupeId } from "@enumeratio/entry";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics/src";
import { declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import { UNDEFINED_MAPS } from "../src/frontier-maps.ts";
import { type CombinatorialMap, declareMaps, MAPS } from "../src/map.ts";

/** A sample value per carrier TYPE, as the contents a constructor wraps. */
const SAMPLES: Record<string, { contents: unknown; caption: string }> = {
  permutation: { contents: ["List", 2, 3, 1], caption: "the one-line word $231$" },
  integer_partition: { contents: ["List", 3, 2, 1], caption: "the partition $3 + 2 + 1$" },
  binary_tree: { contents: ["List", 1, 2, 3], caption: "a three-node tree" },
  set_partition: {
    contents: ["List", 1, 2, 1, 3],
    caption: "the restricted growth string of $\\{1,3\\} \\mid \\{2\\} \\mid \\{4\\}$",
  },
};

const constructorFor = Object.fromEntries(DOMAINS.map((d) => [d.type, d.name]));
const ce = new ComputeEngine();
declareDomains(ce);
// A guard may read a statistic (KrewerasComplement's counts cycles), so the statistics go in
// before the maps — the same order tests/entries.test.ts uses.
declareStatistics(ce, ALL_STATISTICS, {
  domainTypes: Object.fromEntries(
    DOMAINS.filter((d) => d.name !== "SetPartition").map((d) => [d.name, d.type]),
  ),
});
declareMaps(ce, constructorFor);

const json = (value: unknown): string => JSON.stringify(value);

/** Ids for a head's examples, from their captions (design/examples-as-data.md §3). */
const withIds = (examples: readonly { caption?: string }[]): unknown[] => {
  const taken = new Set<string>();
  return examples.map((e) => ({
    id: dedupeId(captionId(e.caption ?? "") || "example", taken),
    ...e,
  }));
};

/** The carrier name a signature reads, as the constructor spells it. */
const carrier = (type: string): string => constructorFor[type] ?? type;

function exampleFor(
  map: CombinatorialMap,
): { expr: unknown; expected: unknown; caption?: string }[] {
  const sample = SAMPLES[map.from];
  if (sample === undefined) return [];
  const subject = [carrier(map.from), sample.contents];
  const expr = [map.name, subject];
  const result = ce.box(expr as never).evaluate();
  const text = JSON.stringify(result.json);
  if (result.json === undefined || text.includes("Error")) return [];
  return [{ expr, expected: result.json, caption: sample.caption }];
}

const entryFor = (map: CombinatorialMap): string => {
  const details = [
    `Takes a \`${carrier(map.from)}\` and returns a \`${carrier(map.to)}\` — a typed map, so a wrong carrier is a type error rather than a wrong answer.`,
    ...(map.composedOf === undefined
      ? []
      : [
          `Defined as a COMPOSITION, applied right to left: ${map.composedOf.map((step) => `[[${step}]]`).join(" after ")}. Each step goes through its own declared head, so every intermediate value is a properly constructed carrier.`,
        ]),
    ...(map.note === undefined ? [] : [map.note]),
  ];
  return `  {
    name: ${json(map.name)},
    domain: "Combinatorial maps",
    signature: ${json(`${map.name}(${carrier(map.from)})`)},
    summary: ${json(map.summary)},
    details: ${json(details)},
    examples: ${json(withIds(exampleFor(map)))},
    ${map.composedOf === undefined ? "" : `seeAlso: ${json([...map.composedOf])},\n    `}},`;
};

const frontierEntryFor = (map: (typeof UNDEFINED_MAPS)[number]): string => {
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
  return `  {
    name: ${json(map.name)},
    domain: "Combinatorial maps",
    signature: ${json(`${map.name}(${carrier(map.from)})`)},
    summary: ${json(`${map.why} Not yet defined.`)},
    details: ${json([
      `Would take a \`${carrier(map.from)}\` to a \`${carrier(map.to)}\`.`,
      `On the map frontier: ${map.why}`,
      "Listed in `UNDEFINED_MAPS` (@enumeratio/domains) with that reason — a claim to be justified, not a place to put anything inconvenient.",
    ])},
    examples: ${json(withIds(examples))},
  },`;
};

const file = `// GENERATED by scripts/collect-entries.ts from MAPS and UNDEFINED_MAPS.
// Do not edit -- regenerate with \`vp node packages/symbols/combinatorics/domains/scripts/collect-entries.ts\`.
//
// One entry per combinatorial map, plus one per undefined map, whose single example is
// aspirational: the head has no definition, so the example records what it would answer and
// the test asserts the gap is still open.

import type { ReferenceEntry } from "@enumeratio/entry";

export const entries: readonly ReferenceEntry[] = [
${[...MAPS.map(entryFor), ...UNDEFINED_MAPS.map(frontierEntryFor)].join("\n")}
];
`;

// The module text is evaluated into one YAML per entry, and src/entries.ts is its shim.
// The entries are built as object-literal text; evaluated here, each becomes one YAML.
const moduleBody = file.slice(file.indexOf("export const entries"));
const js = moduleBody.replace(/: readonly ReferenceEntry\[\]/, "");
const { entries } = (await import(`data:text/javascript,${encodeURIComponent(js)}`)) as {
  entries: ReferenceEntry[];
};
writeEntries(new URL("../reference/", import.meta.url), entries);
process.stdout.write(`wrote ${MAPS.length + UNDEFINED_MAPS.length} entries\n`);
