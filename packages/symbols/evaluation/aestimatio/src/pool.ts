// Generic worker pool: reuse a bounded number of workers across calls instead of
// spawning one per call. Keyed by an arbitrary string -- Node keys by memory limit
// (`resourceLimits` are fixed at spawn, so a different `memoryBytes` needs its own
// worker -- see node.ts), the browser has no such split and uses a single "default"
// bucket (see browser.ts). Host-agnostic on purpose: no worker_threads or DOM Worker
// types here, just the opaque `W` each host plugs in.

/**
 * What becomes of a worker when its caller is done with it: `"reused"` when it finished
 * cleanly and is fit for the next caller, `"replace"` when it was killed for time or
 * memory (or otherwise errored) and should not be handed to anyone else.
 */
export type Disposition = "reused" | "replace";

export interface PoolOptions<W> {
  readonly create: (key: string) => W;
  readonly destroy: (worker: W) => void;
  /** Total live workers across every key combined, not per key. */
  readonly maxSize: number;
}

export interface Pool<W> {
  /** Resolves with an idle worker for `key`, a freshly created one, or (once at
   * `maxSize`) once one is released. */
  acquire(key: string): Promise<W>;
  /** Returns a worker this call is done with -- reused workers go back to `key`'s idle
   * list, replaced ones are destroyed and the slot freed for the next `acquire`. */
  release(key: string, worker: W, disposition: Disposition): void;
  /** Live worker count, across every key -- for tests and diagnostics. */
  readonly size: number;
  /** Destroys every idle worker and drops the wait queue. A worker currently checked out
   * to an in-flight call is that call's to finish and release; close() does not reach
   * into it. */
  close(): void;
}

interface Waiter<W> {
  readonly key: string;
  readonly resolve: (worker: W) => void;
}

export function createPool<W>(options: PoolOptions<W>): Pool<W> {
  const idle = new Map<string, W[]>();
  const queue: Waiter<W>[] = [];
  let total = 0;

  function takeIdle(key: string): W | undefined {
    return idle.get(key)?.shift();
  }

  // Serves as many queued waiters as current idle/capacity allows, FIFO. A waiter at the
  // head whose key has no idle worker and no free capacity blocks the queue behind it --
  // simple to reason about, and good enough for a pool sized in the single digits.
  function drain(): void {
    while (queue.length > 0) {
      const head = queue[0]!;
      const idleWorker = takeIdle(head.key);
      if (idleWorker !== undefined) {
        queue.shift();
        head.resolve(idleWorker);
        continue;
      }
      if (total < options.maxSize) {
        queue.shift();
        total++;
        head.resolve(options.create(head.key));
        continue;
      }
      break;
    }
  }

  function acquire(key: string): Promise<W> {
    const idleWorker = takeIdle(key);
    if (idleWorker !== undefined) return Promise.resolve(idleWorker);
    if (total < options.maxSize) {
      total++;
      return Promise.resolve(options.create(key));
    }
    return new Promise((resolve) => {
      queue.push({ key, resolve });
    });
  }

  function release(key: string, worker: W, disposition: Disposition): void {
    if (disposition === "replace") {
      options.destroy(worker);
      total--;
    } else {
      const list = idle.get(key);
      if (list === undefined) idle.set(key, [worker]);
      else list.push(worker);
    }
    drain();
  }

  function close(): void {
    for (const list of idle.values()) for (const worker of list) options.destroy(worker);
    idle.clear();
    queue.length = 0;
    total = 0;
  }

  return {
    acquire,
    release,
    close,
    get size() {
      return total;
    },
  };
}
