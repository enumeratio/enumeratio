// The Epsil definitions behind a head's page: each statistic's expression over `_x`, and each
// Epsil family's count, unrank, rank and membership. Node-only, read at build straight from the
// sources (nothing is written to disk), printed as InputForm so a reader can type it back.

import { ALL_STATISTICS } from "@enumeratio/combinatorics";
import { allFamilies, type AnyFamily, type EpsilFamily } from "@enumeratio/combinatorics/collections";
import { toInputForm } from "@enumeratio/formats";

/** One definition as the page shows it. */
export interface HeadDefinition {
  /** What the expression defines: a carrier for a statistic, an operation for a family. */
  readonly label: string;
  /** InputForm; read back, it is the expression the implementation runs. */
  readonly source: string;
}

/** A call whose head is itself an expression (the tree statistics' self-application) written as
 *  `Apply`, which InputForm can print and which means the same. */
export function applied(expr: unknown): unknown {
  if (!Array.isArray(expr)) return expr;
  const [head, ...operands] = expr;
  const rest = operands.map(applied);
  return typeof head === "string" ? [head, ...rest] : ["Apply", applied(head), ...rest];
}

const print = (expr: unknown): string => toInputForm(applied(expr) as Parameters<typeof toInputForm>[0]);

export const isEpsilFamily = (family: AnyFamily): family is EpsilFamily => "epsil" in family;

const FAMILY_OPERATIONS = ["count", "unrank", "rank", "valid", "tables"] as const;

const byHead = new Map<string, HeadDefinition[]>();
const add = (head: string, definition: HeadDefinition): void => {
  byHead.set(head, [...(byHead.get(head) ?? []), definition]);
};

for (const { head, on, expr } of ALL_STATISTICS) add(head, { label: `on ${on}, over _x`, source: print(expr) });

for (const family of allFamilies.filter(isEpsilFamily))
  for (const operation of FAMILY_OPERATIONS) {
    const expr = family.epsil[operation];
    if (expr === undefined) continue;
    const over =
      operation === "unrank"
        ? [...family.params, "_r"]
        : operation === "count" || operation === "tables"
          ? family.params
          : [...family.params, "_x"];
    add(family.head, { label: `${operation}(${over.join(", ")})`, source: print(expr) });
  }

/** A head's definitions, in source order; empty for a head with none. */
export const definitionsOf = (head: string): readonly HeadDefinition[] => byHead.get(head) ?? [];

/** Every head with a definition, for the test that sweeps them all. */
export const definedHeads = (): string[] => [...byHead.keys()];
