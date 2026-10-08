// A cell's side of a kernel (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends):
// it sends text and renders what comes back -- the value, its display as boxes, the parsed
// input, its history line and its messages -- with no engine of its own. A `<DynamicModule
// Evaluator -> Worker>` has a kernel of its own; every other cell on the page shares the
// page's kernel, when the host provides one.

import {
  type BrowserSession,
  openSession,
  type SharedWorkerFactory,
  type WorkerFactory,
} from "@enumeratio/evaluation/browser";
import type { Message } from "@enumeratio/engine";

/** Thrown by `evaluateRemote` when a session's worker (and its one respawned retry)
 * both failed to ever start -- `notatio-out.ts`'s worker branch catches exactly this and
 * evaluates that one cell locally instead of showing `$Aborted` for a failure that was
 * never the reader's doing. */
export class WorkerUnavailableError extends Error {
  constructor() {
    super('Evaluator -> "Worker": no worker could be started for this session');
    this.name = "WorkerUnavailableError";
  }
}

export interface RemoteRequest {
  /** MathJSON, or `source` for the kernel to parse. */
  readonly json?: unknown;
  readonly source?: { readonly text: string; readonly format: string };
  /** False to parse and display without evaluating. */
  readonly evaluate?: boolean;
  /** Keep the tree as written, not canonical. */
  readonly raw?: boolean;
  /** Only translate, into this syntax. */
  readonly write?: string;
  /** Only compile (`@enumeratio/frontend/plot-compile`'s `PlotCompileSpec`). */
  readonly compile?: unknown;
  /** A row source's call (`@enumeratio/frontend/row-source`'s `RowsRequest`), answered beside the queue. */
  readonly rows?: unknown;
}

export interface RemoteAnswer {
  readonly value: unknown;
  /** The kernel was hard-killed and restarted: earlier bindings are gone. */
  readonly reset: boolean;
  /** The answer's display (`@enumeratio/frontend/kernel-host`'s `Display`). */
  readonly boxes?: unknown;
  readonly input?: unknown;
  readonly line?: number;
  readonly messages?: readonly Message[];
  /** Why the kernel couldn't answer: a syntax error, a library that failed to declare. */
  readonly error?: string;
  /** Where in the source a syntax error is. */
  readonly range?: unknown;
  /** A translation's text. */
  readonly written?: string;
  /** What the kernel compiled (`compile`). */
  readonly compiled?: unknown;
}

/** The session a page's loose cells share (`@enumeratio/frontend/kernel-host`'s `PAGE_SESSION`). */
const PAGE_SESSION = "page";

type WorkerSetupGate = { __notatioWorkerSetup?: string };
type WorkerFactoriesGate = {
  __notatioWorkerFactories?: {
    readonly createWorker?: WorkerFactory;
    readonly createSharedWorker?: SharedWorkerFactory;
  };
};

/** A private session with the host's kernel worker, or `undefined` when the host has none. */
export function openKernelSession(setup?: string): BrowserSession | undefined {
  const factories = (globalThis as WorkerFactoriesGate).__notatioWorkerFactories;
  if (factories === undefined) return undefined;
  return openSession({
    setup: setup ?? (globalThis as WorkerSetupGate).__notatioWorkerSetup,
    createWorker: factories.createWorker,
    // Chrome for Android has no SharedWorker: the dedicated worker from the same entry instead.
    createSharedWorker: typeof SharedWorker === "undefined" ? undefined : factories.createSharedWorker,
  });
}

let page: BrowserSession | null | undefined;
let pageUnavailable = false;

/** The page's kernel, for a cell outside any module (the page's session) or in a notebook with
 *  no worker of its own (the notebook's); `undefined` when the host has none, or it couldn't
 *  start (the cell then evaluates on the page itself). */
export function pageKernel(
  sessionId: string = PAGE_SESSION,
): ((request: RemoteRequest, options?: { signal?: AbortSignal }) => Promise<RemoteAnswer>) | undefined {
  if (pageUnavailable) return undefined;
  if (page === undefined) {
    try {
      page = openKernelSession() ?? null;
    } catch {
      // The host's factory threw: no worker can start on this page, so cells run locally.
      page = null;
    }
  }
  const session = page;
  if (session === null) return undefined;
  return async (request, options = {}) => {
    const ask = () =>
      session.evaluate(request.json, { ...request, ...options, session: sessionId }) as Promise<RemoteAnswer>;
    // A worker that never started gets one more try on its replacement, as a module's does.
    const first = await ask();
    if (!first.reset) return first;
    const second = await ask();
    if (!second.reset) return second;
    pageUnavailable = true;
    throw new WorkerUnavailableError();
  };
}

/** `request`'s translation by the page's kernel: the MathJSON read, and the text written if
 *  it asked for one. `undefined` without a kernel; a syntax error throws, with its `range`. */
export async function translate(request: RemoteRequest): Promise<{ json: unknown; written?: string } | undefined> {
  const ask = pageKernel();
  if (ask === undefined) return undefined;
  let answer: RemoteAnswer;
  try {
    answer = await ask(request);
  } catch (err) {
    if (err instanceof WorkerUnavailableError) return undefined;
    throw err;
  }
  if (answer.error !== undefined) throw Object.assign(new Error(answer.error), { range: answer.range });
  return { json: answer.value, ...(answer.written !== undefined ? { written: answer.written } : {}) };
}

const notebookIds = new WeakMap<Element, number>();
let nextNotebook = 1;
// The kernel is a SharedWorker every tab reaches: without the tab in the name, two tabs'
// first notebooks would share one session, and each other's bindings.
const TAB = Math.random().toString(36).slice(2);

/** The session a notebook's cells share in the page's kernel. */
export function notebookSession(host: Element): string {
  let id = notebookIds.get(host);
  if (id === undefined) notebookIds.set(host, (id = nextNotebook++));
  return `notebook:${TAB}:${id}`;
}

/** Tell the page's kernel to forget `sessionId` (a notebook that left the page). */
export function closePageSession(sessionId: string): void {
  if (page === undefined || page === null) return;
  void page.evaluate(undefined, { session: sessionId, close: true }).catch(() => undefined);
}
