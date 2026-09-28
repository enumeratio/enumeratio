import type { Patch } from "../patch.ts";
import { roundPlacesLibrary } from "../compute-engine/library/arithmetic.ts";

export const roundPlaces: Patch = {
  id: "round-places",
  lands: "Round(x, n) stays an exact multiple of 10⁻ⁿ (regressed after 0.136)",
  files: ["src/compute-engine/library/arithmetic.ts"],
  library: roundPlacesLibrary,
  heads: ["Round"],

  fixed: (ce) => JSON.stringify(ce.box(["Round", 3.14159, 2]).evaluate().json) === '["Rational",157,50]',

  apply: (ce) => void roundPlacesLibrary(ce),
};
