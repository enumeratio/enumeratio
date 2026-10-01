// A kernel's core (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends):
// one engine, and the libraries the host's catalogue offers, declared into it as requests
// name them rather than all up front. Transport-free: `./session-worker-core.ts` puts it
// behind a worker's ports. What a request's text means, what a session remembers and how an
// answer is shown are the host's (`KernelOptions`).

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { collectMessages, type Message } from "@enumeratio/engine";
import { createResolver, type Library } from "@enumeratio/manifest";
import { evaluateCooperatively } from "./cooperative-evaluate.ts";

/** Text for the kernel to read, in one of the host's syntaxes (`epsil`, `latex`, `mathjson`). */
export interface KernelSource {
  readonly text: string;
  readonly format: string;
}

export interface KernelRequest {
  /** MathJSON, or `source` for the kernel to parse. */
  readonly json?: unknown;
  readonly source?: KernelSource;
  /** Whose scope and history it runs in. A call with none runs in a scope of its own, which
   *  is forgotten after it: nothing it binds reaches another call. */
  readonly session?: string;
  /** With `session`: forget it (its scope, bindings and history), and do nothing else. */
  readonly close?: boolean;
  /** False to parse (and display) without evaluating. */
  readonly evaluate?: boolean;
  /** Keep the tree as written: no canonical form, so `3 + 4` stays a sum. */
  readonly raw?: boolean;
  /** Only translate: read the input and write it in this syntax (`latex`, `epsil`), evaluating
   *  nothing. */
  readonly write?: string;
  /** Only compile: read the input and hand it to the host's `compile` with this (what to
   *  compile it to, over which variables), evaluating nothing. */
  readonly compile?: unknown;
  readonly timeMs?: number;
}

export interface KernelResult {
  readonly ok: boolean;
  /** The answer (or the parsed input, when not evaluating). */
  readonly json?: unknown;
  readonly error?: string;
  /** The input as parsed, before evaluating. */
  readonly input?: unknown;
  /** Its line in the session's history (`Out[n]`), when the session keeps one. */
  readonly line?: number;
  readonly messages?: readonly Message[];
  /** The libraries this request declared, in order; none when the engine had them. */
  readonly declared: readonly string[];
  /** Packages the expression needs that the catalogue doesn't offer. */
  readonly missing: readonly string[];
  /** The answer's display, as the host's `display` builds it (boxes, by form). */
  readonly boxes?: unknown;
  /** A translation's text (`KernelRequest.write`). */
  readonly written?: string;
  /** Where in the source a syntax error is, as the host's reader reports it. */
  readonly range?: unknown;
  /** What the host's `compile` made of the input (`KernelRequest.compile`). */
  readonly compiled?: unknown;
}

/** A session's scope and history, kept by the host. */
export interface KernelSession {
  /** Runs `fn` in the session's scope; `input` is what's about to evaluate there. */
  run<T>(fn: () => T, input: unknown): T;
  /** Records an evaluation, returning its line number, or `undefined` when there's no history. */
  record?(source: KernelSource | undefined, input: unknown, value: unknown): number | undefined;
}

export interface KernelOptions {
  /** `source` as MathJSON (`raw`: as written, not canonical); throws on a syntax error. */
  readonly parse?: (ce: ComputeEngine, source: KernelSource, raw: boolean) => unknown;
  /** `json` as text in `syntax`; throws when it has no such spelling. */
  readonly write?: (ce: ComputeEngine, json: unknown, syntax: string) => string;
  /** The session called `id`, made the first time it's asked for; `undefined` asks for a
   *  throwaway one, for a call that names none. */
  readonly session?: (ce: ComputeEngine, id: string | undefined) => KernelSession;
  /** The answer's display, built here where the definitions are, so a front end needs no
   *  engine to render it. */
  readonly display?: (ce: ComputeEngine, json: unknown) => unknown;
  /** The input compiled as `spec` asks (code for a plot to run), so a front end draws it
   *  with no engine of its own. */
  readonly compile?: (ce: ComputeEngine, json: unknown, spec: unknown) => unknown;
}

export interface Kernel {
  readonly ce: ComputeEngine;
  /** Parses, declares what the input needs, then evaluates it under `timeMs` (cooperatively). */
  evaluate(request: KernelRequest): Promise<KernelResult>;
}

const failed = (error: unknown, prefix = ""): KernelResult => ({
  ok: false,
  error: `${prefix}${error instanceof Error ? error.message : String(error)}`,
  ...(typeof error === "object" && error !== null && "range" in error ? { range: error.range } : {}),
  declared: [],
  missing: [],
});

/**
 * A kernel over `ce`, declaring from `catalogue` on demand. Requests run one at a time: a
 * library still declaring for one must not be half there for the next.
 */
export function createKernel(
  ce: ComputeEngine,
  catalogue: readonly Library<ComputeEngine>[],
  options: KernelOptions = {},
): Kernel {
  const resolver = createResolver(catalogue);
  const sessions = new Map<string, KernelSession>();
  /** The session called `id`, or, for a call with none, a throwaway one kept by no one. */
  const sessionFor = (id: string | undefined): KernelSession | undefined => {
    if (options.session === undefined) return undefined;
    if (id === undefined) return options.session(ce, undefined);
    let session = sessions.get(id);
    if (session === undefined) sessions.set(id, (session = options.session(ce, id)));
    return session;
  };

  const run = async (request: KernelRequest): Promise<KernelResult> => {
    if (request.close === true) {
      if (request.session !== undefined) sessions.delete(request.session);
      return { ok: true, declared: [], missing: [] };
    }
    const read = (): unknown => {
      if (request.source === undefined) return request.json;
      if (options.parse === undefined) throw new Error("this kernel reads MathJSON only");
      return options.parse(ce, request.source, request.raw === true);
    };
    let input: unknown;
    try {
      input = read();
    } catch (error) {
      return failed(error);
    }
    let resolved: { declared: string[]; missing: string[] };
    try {
      resolved = await resolver.ensure(ce, input);
      // A reader resolves names against what's declared (Epsil's library names), so text is
      // read again once what it named is.
      if (resolved.declared.length > 0 && request.source !== undefined) input = read();
    } catch (error) {
      return failed(error, "declaring: ");
    }
    if (request.write !== undefined) {
      if (options.write === undefined) return failed("this kernel doesn't translate");
      try {
        return { ok: true, json: input, written: options.write(ce, input, request.write), ...resolved };
      } catch (error) {
        return failed(error);
      }
    }
    if (request.compile !== undefined) {
      if (options.compile === undefined) return failed("this kernel doesn't compile");
      try {
        return { ok: true, json: input, compiled: options.compile(ce, input, request.compile), ...resolved };
      } catch (error) {
        return failed(error);
      }
    }
    const session = sessionFor(request.session);
    const within = <T>(fn: () => T): T => (session === undefined ? fn() : session.run(fn, input));
    const { value: answer, messages } = collectMessages(ce, () =>
      within(() =>
        request.evaluate === false
          ? { ok: true, json: request.raw === true ? input : ce.box(input as never).json }
          : evaluateCooperatively(ce, input, request.timeMs),
      ),
    );
    if (!answer.ok) return { ...answer, input, messages, ...resolved };
    const line =
      request.evaluate === false ? undefined : within(() => session?.record?.(request.source, input, answer.json));
    const result: KernelResult = {
      ...answer,
      input,
      messages,
      ...resolved,
      ...(line !== undefined ? { line } : {}),
    };
    if (options.display === undefined) return result;
    try {
      return { ...result, boxes: options.display(ce, answer.json) };
    } catch {
      // No display is still an answer: the front end renders the MathJSON itself.
      return result;
    }
  };

  let queue: Promise<unknown> = Promise.resolve();
  return {
    ce,
    evaluate(request) {
      const result = queue.then(() => run(request));
      queue = result.catch(() => undefined);
      return result;
    },
  };
}
