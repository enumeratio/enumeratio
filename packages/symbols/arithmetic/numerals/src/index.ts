export { declareNumerals, NUMERAL_ALIASES, SYSTEM_HEADS, systemOf } from "./declare.ts";
export { NUMERALS_NOTATION } from "./notation.ts";
export { NUMERALS_CARRIERS } from "./carrier-data.ts";
export * as adic from "./adic.ts";
export { ADIC, adicOf, declareAdic } from "./adic-declare.ts";
export {
  adicNumerals,
  balancedRadix,
  bijectiveRadix,
  combinatorialSystem,
  factoradic,
  mixedRadix,
  negativeRadix,
  type DigitBound,
  type NumeralSystem,
  primorialRadix,
  radix,
  residueSystem,
  type Shape,
  zeckendorf,
} from "./systems.ts";
