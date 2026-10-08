// A table's side of a row source (https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Grid, §3): register the
// source with the page's kernel once, then ask for ranges by its handle, abort what a scroll has
// moved on from. A page with no worker kernel runs the same host in the page's own engine, so the
// element is the same either way.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import type { IndexRange } from "@enumeratio/boxes";
import type { RowsReply, RowsRequest } from "@enumeratio/frontend/row-source";
import { pageKernel } from "./kernel-client.ts";

type Json = MathJsonExpression;

export interface RowsClient {
  /** Register the source (a `RowSource(…)` expression) and learn its columns and count. */
  register(source: Json, signal?: AbortSignal): Promise<RowsReply>;
  /** Rows of each range, in one call; an aborted call rejects. */
  range(ranges: readonly IndexRange[], columns: readonly [number, number], signal?: AbortSignal): Promise<RowsReply>;
  /** Let a stalled scan look at more of the source. */
  extend(): Promise<RowsReply>;
  /** Forget the source. */
  release(): void;
}

const TAB = Math.random().toString(36).slice(2, 8);
let nextHandle = 1;

const isReply = (value: unknown): value is RowsReply =>
  typeof value === "object" && value !== null && "ok" in value && typeof (value as { ok: unknown }).ok === "boolean";

/** A client over the page's kernel when it has one that answers rows, else the page's own engine. */
export function openRowsClient(): RowsClient {
  const handle = `rows:${TAB}:${nextHandle++}`;
  let local: ((request: RowsRequest, signal: AbortSignal) => Promise<RowsReply>) | undefined;
  let registered: Json | undefined;
  /** Use the page's own engine from here on (no kernel, or a kernel that does not answer rows). */
  let onPage = false;

  const localHost = async (): Promise<NonNullable<typeof local>> => {
    if (local !== undefined) return local;
    const [{ createRowsHost }, { parseFor, ensureFor }, { parseExpression }] = await Promise.all([
      import("@enumeratio/frontend/row-source"),
      import("@enumeratio/frontend/core"),
      import("@enumeratio/formats/expression"),
    ]);
    const { engine } = await parseFor(() => ({}));
    const read = async ({ text }: { text: string }): Promise<unknown> => {
      const parse = () => parseExpression(text, { ce: engine, parseLatex: (tex) => engine.parse(tex).json });
      const parsed = parse();
      if (parsed.errors.length > 0) throw new Error(parsed.errors.join("; "));
      return (await ensureFor(engine, parsed.json)) ? parse().json : parsed.json;
    };
    return (local = createRowsHost(engine, read));
  };

  const ask = async (request: RowsRequest, signal?: AbortSignal): Promise<RowsReply> => {
    const kernel = onPage ? undefined : pageKernel();
    if (kernel !== undefined) {
      try {
        const answer = await kernel({ rows: request }, signal === undefined ? {} : { signal });
        if (isReply(answer.value)) return answer.value;
        if (answer.error !== undefined) return { ok: false, error: answer.error };
      } catch (error) {
        if (signal?.aborted) throw error;
      }
      // The kernel answered something else, or not at all: this page runs the rows itself.
      onPage = true;
      if (request.op !== "register" && registered !== undefined) {
        await (
          await localHost()
        )({ op: "register", handle, source: registered }, signal ?? new AbortController().signal);
      }
    }
    return (await localHost())(request, signal ?? new AbortController().signal);
  };

  return {
    async register(source, signal) {
      registered = source;
      return ask({ op: "register", handle, source }, signal);
    },
    range: (ranges, columns, signal) => ask({ op: "range", handle, ranges, columns }, signal),
    extend: () => ask({ op: "extend", handle }),
    release() {
      registered = undefined;
      void ask({ op: "release", handle }).catch(() => undefined);
    },
  };
}
