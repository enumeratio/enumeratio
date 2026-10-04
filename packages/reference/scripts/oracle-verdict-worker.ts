// The thread behind `cappedVerdicts`: one verdictOf call per message.

import { parentPort } from "node:worker_threads";
import { verdictOf } from "./oracle-verdict.ts";

type Args = Parameters<typeof verdictOf>;

parentPort?.on("message", (args: Args) => {
  parentPort?.postMessage(verdictOf(...args));
});
