export { type Algebra, algebraOf, basisBlades, NAMED_ALGEBRAS } from "./algebra.ts";
export { declareHypercomplex } from "./declare.ts";
export {
  BRUTE_FORCE_LIMIT,
  distinctPrimeCount,
  factorize,
  imaginaryUnitsMod,
  powerMod,
  powerModList,
  splitUnitCountMod,
  splitUnitsMod,
} from "./modular.ts";
export {
  addMultivectors,
  conjugateMultivector,
  containsGenerator,
  invertMultivector,
  multiplyBlades,
  multiplyMultivectors,
  normMultivector,
  powerMultivector,
  toExpression,
  toMultivector,
  type Multivector,
} from "./multivector.ts";
export { FAMILIES, type Family, type Generator, generatorOf, generatorSymbol } from "./units.ts";
