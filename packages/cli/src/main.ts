#!/usr/bin/env node
// tsx dev entry: run the bin logic. The built bin (bin/notatio.mjs) calls the
// same `main` via ./index.ts.
import { main } from "./cli-main.ts";

main();
