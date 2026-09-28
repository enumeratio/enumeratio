import { declareLibrary, type Patch } from "../patch.ts";
import { hurwitzZetaLibrary, zetaLibrary } from "../compute-engine/library/special-functions.ts";

// compute-engine 0.139 shipped the API half of this -- HurwitzZeta exists, and Zeta
// evaluates at a concretely complex s -- but only in double precision: `N(x, 40)` on
// either still answers a plain double, not an arbitrary-precision bignum, unlike the
// engine's own single-argument Zeta (which already had a bignum path pre-#340). This
// patch's `library` still applies for THAT reason: DirichletBeta/DirichletL (in
// library/number-theory.ts) and the certified-precision tests in @enumeratio/analytic
// both need HurwitzZeta/Zeta correct to more than a double's digits. `fixed` below
// probes the precision, not just the API's existence, so it stays honest as compute-
// engine's own bignum coverage grows.

export const zetaHurwitz: Patch = {
  id: "zeta-hurwitz",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  pr: "https://github.com/cortex-js/compute-engine/pull/350",
  lands: "HurwitzZeta(s, a) and Zeta(s, a) correct beyond a double's digits under N(x, d)",
  files: [
    "src/compute-engine/numerics/hurwitz-zeta.ts",
    "src/compute-engine/numerics/hurwitz-zeta-big.ts",
    "src/compute-engine/library/special-functions.ts",
  ],
  library: (ce) => ({ ...hurwitzZetaLibrary, ...zetaLibrary(ce) }),
  heads: ["HurwitzZeta", "Zeta"],

  fixed: (ce) => {
    // Zeta(s) at a concretely complex s is what native compute-engine declines today
    // (falls back to NaN/unevaluated); HurwitzZeta doesn't exist at all.
    if (ce.lookupDefinition("HurwitzZeta") === undefined) return false;
    const r = ce.box(["Zeta", ce.complex(0.5, 14.13)]).N();
    if (!Number.isFinite(r.re) || !Number.isFinite(r.im)) return false;
    // The API landed; only "fixed" once it also answers past a double's precision.
    ce.precision = 40;
    const digits = ce.box(["HurwitzZeta", 3, ["Rational", 1, 2]]).N().json;
    return typeof digits === "object" && digits !== null && "num" in digits;
  },

  apply: (ce) => {
    declareLibrary(ce, hurwitzZetaLibrary);
    declareLibrary(ce, zetaLibrary(ce));
  },
};

export {
  evaluateHurwitz,
  evaluateZeta,
  hurwitzZeta,
  hurwitzZetaReal,
  setZetaKernel,
  zetaGeneralized,
  zetaGeneralizedReal,
  type ZetaKernel,
} from "../compute-engine/library/special-functions.ts";
