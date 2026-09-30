import { type Patch } from "../patch.ts";
import { dirichletLibrary } from "../compute-engine/library/number-theory.ts";

export const dirichlet: Patch = {
  id: "dirichlet",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "DirichletEta, DirichletBeta, DirichletCharacter and DirichletL",
  files: [
    "src/compute-engine/numerics/dirichlet.ts",
    "src/compute-engine/numerics/dirichlet-l.ts",
    "src/compute-engine/library/number-theory.ts",
  ],
  library: dirichletLibrary,

  fixed: (ce) =>
    ce.lookupDefinition("DirichletEta") !== undefined &&
    ce.lookupDefinition("DirichletBeta") !== undefined &&
    ce.lookupDefinition("DirichletL") !== undefined,

  apply: (ce) => {
    for (const [name, definition] of Object.entries(dirichletLibrary)) {
      // Catalan is @enumeratio/analytic's too (its own special-functions.ts, for heads that
      // stayed there); guarded so whichever declarant runs first wins, harmlessly.
      if (name === "Catalan" && ce.lookupDefinition("Catalan") !== undefined) continue;
      ce.declare(name, definition as never);
    }
  },
};

export {
  dirichletEta,
  dirichletEtaReal,
  dirichletBeta,
  dirichletBetaReal,
  character,
  characterExponent,
  dirichletL,
  dirichletLReal,
  eulerPhi,
} from "../compute-engine/library/number-theory.ts";
