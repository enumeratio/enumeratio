// Runs families for plausible.ts, one message at a time, inside a heap-capped worker — so a
// family whose declaration understates its cost costs a restart, not the run.

import { parentPort } from "node:worker_threads";
import { allEntries } from "../src/families/index.ts";
import { type RunOptions, runFamily } from "./run-family.ts";

const port = parentPort;
if (port === null) throw new Error("plausible-worker runs inside a worker");

port.on("message", ({ head, options }: { head: string; options: RunOptions }) => {
  const family = allEntries.find((f) => f.head === head);
  if (family === undefined) throw new Error(`no family ${head}`);
  const report = runFamily(family, options, (address) => port.postMessage({ progress: address }));
  port.postMessage({ report });
});
