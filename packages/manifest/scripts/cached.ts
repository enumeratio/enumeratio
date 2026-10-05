#!/usr/bin/env node
// Run a build command in the current package unless nothing it reads has changed since it last
// succeeded (stamp.ts): the package's own files (not its tests or docs) and the dists of the
// workspace packages it depends on.
//
//   node ../manifest/scripts/cached.ts <name> <output> -- vp pack
//
// `output` (relative to the package) must still exist for the command to be skipped.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { cached } from "./stamp.ts";

const [name, output, separator, ...command] = process.argv.slice(2);
if (name === undefined || output === undefined || separator !== "--" || command.length === 0)
  throw new Error("usage: cached.ts <name> <output> -- <command…>");

const dir = process.cwd();
const ran = await cached(
  name,
  { dir, skip: (path) => /\/(tests|docs)(\/|$)/.test(path) },
  [resolve(dir, output)],
  () => {
    const { status } = spawnSync(command[0]!, command.slice(1), { stdio: "inherit" });
    if (status !== 0) process.exit(status ?? 1);
  },
);
if (!ran) console.log(`${name}: up to date`);
