// The Wolfram triage set, as it lives in the records: examples with `role: triage`, their
// bucket in `triage`, a lane's reason in the Wolfram row's `note`.

import type { HeadImplementations, ReferenceExample, TriageBucket } from "@enumeratio/entry";
import { writeHead } from "@enumeratio/entry/node";
import type { LoadedHead } from "../src/node.ts";

/** One row in triage, with what the lanes need to settle it. */
export interface TriageRow {
  readonly head: string;
  readonly id: string;
  readonly expr: unknown;
  /** Our current answer, the row's `expected`. */
  readonly ours: unknown;
  readonly in?: string;
  readonly wolfram?: string;
  readonly verdict?: string;
  readonly bucket: TriageBucket;
  readonly reason?: string;
}

export const triageRows = (heads: readonly LoadedHead[]): TriageRow[] =>
  heads.flatMap(({ head, entry, implementations }) =>
    entry.examples
      .filter((e) => e.role === "triage")
      .map((e) => {
        const wolfram = implementations?.[e.id]?.wolfram;
        return {
          head,
          id: e.id,
          expr: e.expr,
          ours: e.expected,
          in: wolfram?.in,
          wolfram: wolfram?.out,
          verdict: wolfram?.verdict ?? (wolfram?.out ? "agree" : undefined),
          bucket: e.triage ?? "ours?",
          reason: wolfram?.note,
        };
      }),
  );

/** Each example's new form (or `undefined` to take it out), and its Wolfram row's, written back. */
export async function rewriteExamples(
  loaded: LoadedHead,
  change: (
    example: ReferenceExample,
    wolfram: Record<string, unknown> | undefined,
  ) => { example: ReferenceExample; wolfram?: Record<string, unknown> } | undefined | "keep",
): Promise<number> {
  const implementations = { ...loaded.implementations } as Record<string, Record<string, unknown>>;
  const examples: ReferenceExample[] = [];
  let changed = 0;
  for (const example of loaded.entry.examples) {
    const result = change(example, implementations[example.id]?.wolfram as Record<string, unknown> | undefined);
    if (result === "keep") {
      examples.push(example);
      continue;
    }
    changed++;
    if (result === undefined) {
      delete implementations[example.id];
      continue;
    }
    examples.push(result.example);
    if (result.wolfram !== undefined)
      implementations[example.id] = { ...implementations[example.id], wolfram: result.wolfram };
  }
  if (changed === 0) return 0;
  await writeHead(loaded.dir, loaded.head, {
    entry: { ...loaded.entry, examples },
    implementations: Object.keys(implementations).length > 0 ? (implementations as HeadImplementations) : undefined,
    body: loaded.body,
  });
  return changed;
}

/** A row settled: out of triage, as a plain example. */
export const settle = ({ role: _role, triage: _triage, ...example }: ReferenceExample): ReferenceExample => example;
