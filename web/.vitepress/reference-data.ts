// `virtual:reference-entries`: the documented entries, one per head, as the loader reads them
// from every package's YAML. In dev, a change to any record (entry or implementations) invalidates the
// module and reloads the page.

import { dirname, resolve } from "node:path";
import { referenceData } from "@enumeratio/reference/node";
import type { Plugin, ViteDevServer } from "vite";

const ID = "virtual:reference-entries";
const RESOLVED = `\0${ID}`;
const WATCHED = /\/packages\/.*(\/reference\/[^/]+\.yaml|\/reference\/entries\/[^/]+\.yaml)$/;

export function referenceDataPlugin(): Plugin {
  return {
    name: "enumeratio-reference-data",
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return undefined;
      return `export default ${JSON.stringify(referenceData(undefined, { fresh: true }).entries)};`;
    },
    configureServer(server: ViteDevServer) {
      // The config is bundled to a temp file, so paths come from the site root (web/), not import.meta.
      const packages = `${resolve(server.config.root, "../packages")}/`;
      // Every directory the loader read a record from.
      const { heads } = referenceData();
      server.watcher.add([...new Set(heads.map((h) => dirname(h.entryPath)))]);
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
