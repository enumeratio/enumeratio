export { type Algebra, algebraOf, basisBlades, NAMED_ALGEBRAS } from "./algebra.ts";
export { declareHypercomplex } from "./declare.ts";
export { HYPERCOMPLEX_NOTATION } from "./notation.ts";
export { HYPERCOMPLEX_CARRIERS } from "./carrier-data.ts";
export { distinctPrimeCount, factorize, imaginaryUnitsMod, splitUnitCountMod, splitUnitsMod } from "./modular.ts";
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
