// `virtual:reference-entries`: the assembled reference, one entry per head, as the loader reads
// them from every package's records. In dev, a change to any record (entry or implementations) invalidates the
// module and reloads the page.

import { resolve } from "node:path";
import type { ReferenceEntry } from "@enumeratio/reference";
import { referenceData } from "@enumeratio/reference/node";
import { assemble } from "./data/reference-assemble.ts";
import type { Plugin, ViteDevServer } from "vite";

const ID = "virtual:reference-entries";
const RESOLVED = `\0${ID}`;
// A head folder's files: index.md, examples.tsv and the generated examples.values.<system>.tsv.
const WATCHED = /\/packages\/.*\/(reference|entries)\/[^/]+\/(index\.md|examples(\.values\.[^/.]+)?\.tsv)$/;

/** An entry without what only its own page shows: examples, body and details. */
const slim = ({ examples: _examples, body: _body, details: _details, ...entry }: ReferenceEntry): ReferenceEntry => ({
  ...entry,
  examples: [],
});

export function referenceDataPlugin(dev: boolean): Plugin {
  return {
    name: "enumeratio-reference-data",
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return undefined;
      // Dev rereads from disk every time so a record change (below) actually shows up. A build
      // has nothing to invalidate, so let referenceData's own memo answer every call after the
      // first -- resolving dynamic routes, and each of the client/SSR bundles, all read the same
      // parse of the YAML.
      const { entries } = assemble(referenceData(undefined, { fresh: dev }).entries);
      // A build ships each symbol page its own entry (its route's params) and every page only
      // what cross-page lookups read; dev keeps whole entries here, reread on every edit.
      return `export default ${JSON.stringify(dev ? entries : entries.map(slim))};`;
    },
    configureServer(server: ViteDevServer) {
      // The config is bundled to a temp file, so paths come from the site root (web/), not import.meta.
      const packages = `${resolve(server.config.root, "../packages")}/`;
      // Every directory the loader read a record from.
      const { heads } = referenceData();
      server.watcher.add([...new Set(heads.map((h) => h.dir))]);
      const refresh = (file: string): void => {
        if (!WATCHED.test(file)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.config.logger.info(`reference data changed: ${file.slice(packages.length)}`, {
          timestamp: true,
        });
        server.ws.send({ type: "full-reload" });
      };
      for (const event of ["change", "add", "unlink"] as const) server.watcher.on(event, refresh);
    },
  };
}
