// The statistics `Columns -> Automatic` opens a table with, for the runtime, which loads no
// manifest: built from the records (scripts/build-carrier-statistics.ts), the first few per carrier.

import table from "../generated/carrier-statistics.json" with { type: "json" };

const { carriers, heads } = table as {
  readonly carriers: Readonly<Record<string, readonly string[]>>;
  readonly heads: Readonly<Record<string, string>>;
};

const HEAD = /^\s*([A-Za-z]\w*)/;

/** The statistics a carrier opens with: named directly, else the carrier of the collection `expr` heads. */
export function automaticStatistics(carrier: string, expr: string): readonly string[] {
  const head = HEAD.exec(expr)?.[1] ?? "";
  return carriers[carrier] ?? carriers[heads[head] ?? head] ?? [];
}
