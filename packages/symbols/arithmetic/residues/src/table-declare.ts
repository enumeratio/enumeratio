import { bigIntegerAt, type Engine, type Expr, operandsOf, optionsOf } from "@enumeratio/engine";
import { SUMMARIES } from "@enumeratio/manifest/package/residues";
import { QUOTIENT_RING, RESIDUE_CLASS } from "./names.ts";
import { combine, type ElementOrder, type TableOperation, tableElements } from "./table.ts";

// AdditionTable(R) and MultiplicationTable(R): ℤ/n's Cayley tables as the matrix of ResidueClass
// entries, row i and column j the i-th and j-th elements as `ElementOrder` lists them. A `Show`
// draws the same tables held, at any size, through ./table.ts; as values they stop at
// `TABLE_LIMIT`, past which a matrix is no use to read.

/** The largest n whose table evaluates: 64² = 4096 entries. */
const TABLE_LIMIT = 64n;

const ORDERS: ReadonlySet<string> = new Set<ElementOrder>(["Natural", "ChineseRemainder", "Adic"]);

/** The table of `ops`'s ring, or `undefined` when it isn't ℤ/n for 2 ≤ n ≤ TABLE_LIMIT. */
function table(ce: Engine, head: string, operation: TableOperation, ops: readonly Expr[]): Expr | undefined {
  const { ops: positional, options } = optionsOf([head, ...ops.map((op) => op.json)] as never);
  if (positional.length !== 1 || Object.keys(options).some((k) => k !== "ElementOrder")) return undefined;
  const order = options.ElementOrder ?? "Natural";
  if (typeof order !== "string" || !ORDERS.has(order)) return undefined;
  const ring = ce.box(positional[0] as never);
  const [base, modulus] = operandsOf(ring);
  if (ring.operator !== QUOTIENT_RING || base?.json !== "Integers") return undefined;
  const n = bigIntegerAt(modulus);
  if (n === undefined || n < 2n || n > TABLE_LIMIT) return undefined;
  const m = Number(n);
  const elements = tableElements(m, order as ElementOrder);
  const entry = (v: number): Expr => ce.function(RESIDUE_CLASS, [ce.number(v), ce.number(m)]);
  const rows = elements.map((a) =>
    ce.function(
      "List",
      elements.map((b) => entry(combine(operation, a, b, m))),
    ),
  );
  return ce.function("Matrix", [ce.function("List", rows)]);
}

export function declareTables(ce: Engine): void {
  for (const [head, operation] of [
    ["AdditionTable", "Add"],
    ["MultiplicationTable", "Multiply"],
  ] as const) {
    ce.declare(head, {
      description: SUMMARIES[head],
      signature: "(value, value*) -> list",
      evaluate: (ops: readonly Expr[]) => table(ce, head, operation, ops),
    });
  }
}
