// Generate `src/entries.ts` — one reference entry per declared statistic, plus one per
// frontier signature. The definitions already carry a head, a carrier and a summary; what
// they cannot carry is a worked example, so this script evaluates each definition against a
// couple of fixed inputs per carrier and writes the results out inline.
//
// Generated rather than derived at import time because the `expected` values have to be
// committed data a test can re-derive and compare — the golden rule this repo runs on.
//
//   vp node packages/statistics/scripts/collect-entries.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCollections } from "@enumeratio/collections/src";
import { ALL_STATISTICS } from "../src/all.ts";
import { declareStatistics } from "../src/declare.ts";
import { CARRIER_TYPES, declareCarriers } from "./carriers.ts";
import { FRONTIER } from "../src/frontier.ts";
import type { Definition } from "../src/types.ts";

/** Sample subjects per carrier: small enough to read, varied enough to differ. */
const SAMPLES: Record<string, { list: number[] | number[][]; caption: string }[]> = {
  Permutation: [
    { list: [3, 1, 2], caption: "the one-line word $312$" },
    { list: [2, 4, 1, 3], caption: "the one-line word $2413$" },
  ],
  IntegerPartition: [
    { list: [4, 2, 1], caption: "the partition $4 + 2 + 1$ of $7$" },
    { list: [3, 3, 1], caption: "the partition $3 + 3 + 1$ of $7$" },
  ],
  DyckPath: [
    { list: [1, 1, 0, 0, 1, 0], caption: "the step word $UUDDUD$" },
    { list: [1, 0, 1, 1, 0, 0], caption: "the step word $UDUUDD$" },
  ],
  SetPartition: [
    { list: [[1, 3], [2]], caption: "the partition $\\{1,3\\} \\mid \\{2\\}$" },
    { list: [[1], [2, 4], [3]], caption: "the partition $\\{1\\} \\mid \\{2,4\\} \\mid \\{3\\}$" },
  ],
};

/** What to call the subject in a signature, per carrier — `Descents(p)`, not `Descents(_)`. */
const SUBJECT_NAME: Record<string, string> = {
  Permutation: "p",
  IntegerPartition: "partition",
  DyckPath: "path",
  SetPartition: "partition",
};

/** The human name of a carrier, as a reference `domain` reads. */
const DOMAIN: Record<string, string> = {
  Permutation: "Permutation statistics",
  IntegerPartition: "Partition statistics",
  DyckPath: "Dyck path statistics",
  SetPartition: "Set partition statistics",
};

const listOf = (value: number | number[] | number[][]): unknown =>
  Array.isArray(value) ? ["List", ...value.map(listOf)] : value;

// The order both engines use: carriers, then collections (which owns the fast permutation
// heads), then the definitions with `skipDeclared`. A pinned value is therefore the one a
// cell or a REPL line actually produces, not the definition's in isolation.
// Heads compute-engine itself owns (`Sign`) are never declared from a definition here --
// `skipDeclared` leaves them alone -- so they are documented by the core reference, not by
// this package. Probe a bare engine to find them.
const bare = new ComputeEngine();
const CORE_OWNED = new Set(
  ALL_STATISTICS.map((d) => d.head).filter((head) => bare.lookupDefinition(head) !== undefined),
);

const ce = new ComputeEngine();
declareCarriers(ce);
declareCollections(ce, { permutationType: CARRIER_TYPES.Permutation });
declareStatistics(ce, ALL_STATISTICS, { skipDeclared: true, domainTypes: CARRIER_TYPES });

// `declareStatistics` declares the FIRST definition of each head and skips the rest, so a
// head defined on two carriers (MajorIndex, Peaks, Valleys) has exactly one live meaning.
// The entry follows that: one page per head, the other carriers noted as defined-but-shadowed.
const owner = new Map<string, Definition>();
const shadowed = new Map<string, Definition[]>();
for (const definition of ALL_STATISTICS) {
  if (CORE_OWNED.has(definition.head)) continue;
  if (owner.has(definition.head)) {
    shadowed.set(definition.head, [...(shadowed.get(definition.head) ?? []), definition]);
  } else owner.set(definition.head, definition);
}

interface Example {
  expr: unknown;
  expected: unknown;
  caption?: string;
  aspirational?: boolean;
}

/**
 * Every subject a head accepts: the carrier, and a bare list when the reading also stands on
 * one. A carrier not in `CARRIER_TYPES` is not typed over at all (SetPartition), so those
 * heads still take the bare value and that is the only example to give.
 */
function subjectsFor(definition: Definition, sample: { list: number[] | number[][] }): unknown[] {
  const value = listOf(sample.list);
  if (CARRIER_TYPES[definition.on] === undefined) return [value];
  const carrier = [definition.on, value];
  return definition.alsoOnList === true ? [carrier, value] : [carrier];
}

function examplesFor(definition: Definition): Example[] {
  const samples = SAMPLES[definition.on] ?? [];
  const out: Example[] = [];
  for (const sample of samples) {
    for (const subject of subjectsFor(definition, sample)) {
      const bare = !Array.isArray(subject) || subject[0] !== definition.on;
      // One carrier example per sample, and a single bare-list example overall — enough to
      // show the reading stands on its own without doubling every row.
      if (bare && out.some((e) => e.caption?.endsWith("as a plain list"))) continue;
      const expr = [definition.head, subject];
      const result = ce.box(expr as never).evaluate();
      if (result.json === undefined || JSON.stringify(result.json).includes("Error")) continue;
      out.push({
        expr,
        expected: result.json,
        caption: bare ? `${sample.caption}, as a plain list` : sample.caption,
      });
    }
  }
  return out;
}

const json = (value: unknown): string => JSON.stringify(value);

const entryFor = (definition: Definition): string => {
  const also = shadowed.get(definition.head) ?? [];
  const details = [
    `Defined over \`${definition.on}\` as an expression in \`_x\`, evaluated by compute-engine — the definition IS the implementation.`,
    CARRIER_TYPES[definition.on] === undefined
      ? `Not yet typed over its carrier: \`${definition.on}\` is a restricted growth string in @enumeratio/domains but a list of BLOCKS here, so the head still takes the bare blocks until the two representations are reconciled.`
      : definition.alsoOnList === true
        ? `Takes a \`${definition.on}\`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.`
        : `Takes a \`${definition.on}\` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.`,
    ...(definition.note === undefined ? [] : [definition.note]),
    ...also.map(
      (d) =>
        `A separate definition exists for \`${d.on}\` (${d.summary}) but is not the one declared: one head, one owner.`,
    ),
  ];
  return `  {
    name: ${json(definition.head)},
    domain: ${json(DOMAIN[definition.on] ?? definition.on)},
    signature: ${json(`${definition.head}(${SUBJECT_NAME[definition.on] ?? "_"})`)},
    summary: ${json(definition.summary)},
    details: ${json(details)},
    examples: ${json(examplesFor(definition))},
  },`;
};

const frontierEntryFor = (frontier: (typeof FRONTIER)[number]): string => {
  const sample = SAMPLES[frontier.on]?.[0];
  const examples: Example[] =
    sample === undefined
      ? []
      : [
          {
            expr: [
              frontier.head,
              CARRIER_TYPES[frontier.on] === undefined
                ? listOf(sample.list)
                : [frontier.on, listOf(sample.list)],
            ],
            // Aspirational: the head is NOT declared, so this is a claim about what it would
            // answer, and the test asserts the gap is still open.
            expected: 0,
            caption: `${sample.caption} — once there is a definition to evaluate`,
            aspirational: true,
          },
        ];
  return `  {
    name: ${json(frontier.head)},
    domain: ${json(DOMAIN[frontier.on] ?? frontier.on)},
    signature: ${json(`${frontier.head}(${SUBJECT_NAME[frontier.on] ?? "_"})`)},
    summary: ${json(`${frontier.why} Not yet defined.`)},
    details: ${json([
      `On the primitive frontier for \`${frontier.on}\`: ${frontier.why}`,
      `Classified \`${frontier.reason}\`. Being on this list is a claim to be justified, not a place to put anything inconvenient — see \`FRONTIER\` in @enumeratio/statistics.`,
    ])},
    examples: ${json(examples)},
  },`;
};

const body = [...[...owner.values()].map(entryFor), ...FRONTIER.map(frontierEntryFor)].join("\n");

const file = `// GENERATED by scripts/collect-entries.ts from the definitions and the frontier.
// Do not edit -- regenerate with \`vp node packages/statistics/scripts/collect-entries.ts\`.
//
// One entry per DECLARED head (a head defined on two carriers is declared once), plus one
// per frontier signature, whose single example is aspirational: the head has no definition,
// so the example records what it would answer and the test asserts the gap is still open.

import type { ReferenceEntry } from "@enumeratio/entry";

export const entries: readonly ReferenceEntry[] = [
${body}
];
`;

writeFileSync(new URL("../src/entries.ts", import.meta.url), file);
process.stdout.write(`wrote ${owner.size + FRONTIER.length} entries\n`);
