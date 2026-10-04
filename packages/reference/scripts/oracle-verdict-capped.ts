// verdictOf under a time cap. It numerically evaluates our value in-process, and CE can spin
// there for good (`N(PolyLog(2500000, 4))` never returns), so the call runs on a thread that
// is killed when it overruns. Calls must not overlap.

import { Worker } from "node:worker_threads";
import type { Verdict } from "@enumeratio/oracle";
import type { verdictOf } from "./oracle-verdict.ts";

/** Seconds one comparison may take, including a fresh thread's engine start-up. */
const VERDICT_SECONDS = 20;

export function cappedVerdicts() {
  let worker: Worker | undefined;
  return {
    /** The verdict, or `"timeout"` when the comparison overran. */
    verdict(...args: Parameters<typeof verdictOf>): Promise<Verdict | "timeout"> {
      const thread = (worker ??= new Worker(new URL("./oracle-verdict-worker.ts", import.meta.url)));
      return new Promise((resolve) => {
        const settle = (value: Verdict | "timeout") => {
          clearTimeout(timer);
          thread.off("message", settle);
          thread.off("error", fail);
          resolve(value);
        };
        const fail = () => {
          worker = undefined;
          settle("timeout");
        };
        const timer = setTimeout(() => {
          worker = undefined;
          void thread.terminate();
          settle("timeout");
        }, VERDICT_SECONDS * 1000);
        thread.on("message", settle);
        thread.on("error", fail);
        thread.postMessage(args);
      });
    },
    close() {
      void worker?.terminate();
    },
  };
}
