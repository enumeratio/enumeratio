// The engine's half of the explorer: whether a derived expression opens as a table, and whether
// a statistic answers on its first row. A build or a test passes these as the catalog's probes.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { toText } from "@enumeratio/boxes/render";
import { parseExpression } from "@enumeratio/formats/expression";
import type { ExplorerCatalog } from "./explorer.ts";
import { openRowSource } from "./row-source.ts";

/** Rows of the derived collection a statistic is compared over: all of a small one. */
const VARIES_ROWS = 24n;

/**
 * `ensure` declares what an expression names into `ce` before it is boxed, for an engine that
 * loads its libraries lazily; one that has them all needs none.
 */
export function engineProbes(
  ce: ComputeEngine,
  ensure: (json: unknown) => Promise<unknown> = async () => undefined,
): Required<Pick<ExplorerCatalog, "opens" | "usable" | "varies">> {
  const open = async (expr: string, columns: string[]) => {
    const { json, errors } = parseExpression(expr);
    if (errors.length > 0) return undefined;
    try {
      await ensure(["List", json, ...columns.map((c) => c.replace(/\(.*$/s, ""))]);
      return openRowSource(ce, { collection: json, columns });
    } catch {
      return undefined;
    }
  };
  return {
    // A collection of one row cannot show a statistic vary, so nothing is dropped there.
    varies: async (expr, statistic) => {
      const opened = await open(expr, [statistic]);
      if (opened?.ok !== true) return true;
      const count = opened.source.count();
      if (count.kind !== "exact" || count.n < 2n) return true;
      try {
        const to = (count.n < VARIES_ROWS ? count.n : VARIES_ROWS) + 1n;
        const batch = await opened.source.rows([1n, to], [0, opened.source.columns.length]);
        const values = new Set(batch.rows.map((row) => toText(row.at(-1) ?? "")));
        return values.size > 1;
      } catch {
        return true;
      }
    },
    opens: async (expr) => (await open(expr, []))?.ok === true,
    usable: async (expr, statistic) => {
      const opened = await open(expr, [statistic]);
      if (opened?.ok !== true) return false;
      try {
        const batch = await opened.source.rows([1n, 2n], [0, opened.source.columns.length]);
        const cell = batch.rows[0]?.at(-1);
        return cell !== undefined && cell !== "" && toText(cell) !== "⚠";
      } catch {
        return false;
      }
    },
  };
}
