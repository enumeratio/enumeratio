// Re-runs a data loader when the sources it reads change. A loader's own `watch` globs are not
// used: VitePress 1.6 expands them with an embedded tinyglobby that, for a pattern outside the
// site root (`../../../packages/…`), crawls far above it -- minutes in a checkout with sibling
// worktrees, and enough file-system events to abort `vp run`'s tracer. Dev only.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const loaders = resolve(root, "web/.vitepress/data");

/** Loader file -> the sources whose change re-runs it, and the directories to watch for them. */
const rules: { loader: string; sources: RegExp; watch: string[] }[] = [
  {
    loader: "components.data.ts",
    sources: /\/packages\/components\/src\/notatio-[^/]*\.ts$/,
    watch: ["packages/components/src"],
  },
  {
    loader: "cli.data.ts",
    sources: /\/packages\/cli\/src\/(command|completion|engine)\.ts$/,
    watch: ["packages/cli/src"],
  },
  {
    loader: "repo-docs.data.ts",
    sources: /\/(packages|tools|upstream)\/(?:.*\/)?(package\.json|README\.md|docs\/.*\.md)$/,
    // Only what the site already watches: crawling every package for READMEs costs more than it saves.
    watch: [],
  },
];

export function loaderWatchPlugin(): Plugin {
  return {
    name: "enumeratio-loader-watch",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(rules.flatMap((r) => r.watch.map((dir) => resolve(root, dir))));
    },
    handleHotUpdate({ file, modules, server }) {
      const rerun = rules
        .filter((r) => r.sources.test(file))
        .flatMap((r) => [...(server.moduleGraph.getModulesByFile(resolve(loaders, r.loader)) ?? [])]);
      return rerun.length ? [...modules, ...rerun] : undefined;
    },
  };
}
