// The system's version: what a symbol package's `enumeratio.system` range is checked against
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2). The system is versioned as a whole, by
// the repository's own version: our packages and the compute-engine they're built with.

import root from "../../../package.json" with { type: "json" };

export const SYSTEM_VERSION: string = root.version;
