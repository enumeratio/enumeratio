import { declareLibrary, type Patch } from "../patch.ts";
import { logGammaLibrary } from "../compute-engine/library/special-functions.ts";

export const logGammaPatch: Patch = {
  id: "log-gamma",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "LogGamma(z), the analytic continuation of ln Γ(z)",
  files: ["src/compute-engine/numerics/log-gamma.ts", "src/compute-engine/library/special-functions.ts"],
  library: logGammaLibrary,

  fixed: (ce) => ce.lookupDefinition("LogGamma") !== undefined,

  apply: (ce) => declareLibrary(ce, logGammaLibrary),
};

export { evaluateLogGamma, logGamma, logGammaReal, logGammaBig } from "../compute-engine/library/special-functions.ts";
