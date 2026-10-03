import { fileURLToPath } from "node:url";

/** The package's own directory. This file's place is the anchor: it sits one level below the
 * root as `src/root.ts` and bundles to `dist/`, so `../` is the root either way. */
export const ROOT = fileURLToPath(new URL("../", import.meta.url));
