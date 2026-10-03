// Where `referenceData` reads the records from: the repo's `packages/`, or, in a build from
// installed packages (SITE_FROM_PACKAGES=1), `node_modules/@enumeratio` beside web/, which holds
// each package's `reference/` directly. `undefined` is the loader's own default.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const recordsRoot: string | undefined =
  process.env.SITE_FROM_PACKAGES === "1" ? resolve(here, "../../../node_modules/@enumeratio") : undefined;
