// The reference for the Node side of the site -- the config's markdown plugins and the
// dynamic routes -- which run outside Vite and so read the loader directly.

import { referenceData } from "@enumeratio/reference/node";
import { assemble } from "./reference-assemble.ts";

export const { documented, entries } = assemble(referenceData().entries);
