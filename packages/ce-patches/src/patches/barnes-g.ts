import { declareLibrary, type Patch } from "../patch.ts";
import { barnesGLibrary } from "../compute-engine/library/special-functions.ts";

export const barnesGPatch: Patch = {
  id: "barnes-g",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "BarnesG(z) and LogBarnesG(z), the Barnes G-function and its logarithm",
  files: [
    "src/compute-engine/numerics/barnes-g.ts",
    "src/compute-engine/numerics/barnes-g-big.ts",
    "src/compute-engine/library/special-functions.ts",
  ],
  library: barnesGLibrary,

  fixed: (ce) => ce.lookupDefinition("BarnesG") !== undefined,

  apply: (ce) => declareLibrary(ce, barnesGLibrary),
};

export {
  evaluateBarnesG,
  barnesG,
  barnesGReal,
  logBarnesG,
  logBarnesGReal,
  barnesGBig,
  barnesGBall,
  barnesGPi,
} from "../compute-engine/library/special-functions.ts";
