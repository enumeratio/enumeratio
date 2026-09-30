// A kernel's core (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends):
// one engine, and the libraries the host's catalogue offers, declared into it as requests
// name them rather than all up front. Transport-free: `./session-worker-core.ts` puts it
// behind a worker's ports.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { createResolver, type Library } from "@enumeratio/manifest";
import { evaluateCooperatively } from "./cooperative-evaluate.ts";

export interface KernelResult {
  readonly ok: boolean;
  readonly json?: unknown;
  readonly error?: string;
  /** The libraries this request declared, in order; none when the engine had them. */
  readonly declared: readonly string[];
  /** Packages the expression needs that the catalogue doesn't offer. */
  readonly missing: readonly string[];
}

export interface Kernel {
  readonly ce: ComputeEngine;
  /** Declares what `json` needs, then evaluates it under `timeMs` (cooperatively). */
  evaluate(json: unknown, timeMs?: number): Promise<KernelResult>;
}

/**
 * A kernel over `ce`, declaring from `catalogue` on demand. Requests run one at a time: a
 * library still declaring for one must not be half there for the next.
 */
export function createKernel(ce: ComputeEngine, catalogue: readonly Library<ComputeEngine>[]): Kernel {
  const resolver = createResolver(catalogue);
  let queue: Promise<unknown> = Promise.resolve();
  const run = async (json: unknown, timeMs?: number): Promise<KernelResult> => {
    let resolved: { declared: string[]; missing: string[] };
    try {
      resolved = await resolver.ensure(ce, json);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `declaring: ${message}`, declared: [], missing: [] };
    }
    return { ...evaluateCooperatively(ce, json, timeMs), ...resolved };
  };
  return {
    ce,
    evaluate(json, timeMs) {
      const result = queue.then(() => run(json, timeMs));
      queue = result.catch(() => undefined);
      return result;
    },
  };
}
