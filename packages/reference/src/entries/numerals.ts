import type { ReferenceEntry } from "../types.ts";

// Reference entries for @enumeratio/numerals, and compute-engine's other digit heads.
// `IntegerDigits` and `FromDigits` are compute-engine's OWN heads — what this library adds
// is systems in the base slot, so one entry documents both the native forms and the
// widening rather than introducing parallel heads.

const DOMAIN = "Numeral systems";
const L = (...xs: number[]) => ["List", ...xs];

export const numerals: readonly ReferenceEntry[] = [
  {
    name: "IntegerDigits",
    domain: DOMAIN,
    signature: "IntegerDigits(n, base?, width?)",
    summary:
      "The digits of $n$, most significant first — base 10 by default. The base slot takes a whole numeral SYSTEM, not only an integer — factorial, Zeckendorf, Ostrowski, balanced, negative, bijective, mixed-radix, primorial, combinatorial or residue.",
    signatures: [
      {
        call: "IntegerDigits(n)",
        description: "digits of $n$ in base 10, most significant first.",
      },
      { call: "IntegerDigits(n, base)", description: "digits of $n$ in the given base." },
      {
        call: "IntegerDigits(n, base, len)",
        description: "the $len$ least-significant digits, zero-padded if needed.",
      },
      {
        call: "IntegerDigits(n, system)",
        description: "digits in any of the systems below",
        library: "enumeratio-numerals",
      },
      {
        call: "IntegerDigits(n, system, width)",
        description: "left-padded with zeros to `width` digits",
        library: "enumeratio-numerals",
      },
    ],
    details: [
      "Digits come out most significant first, matching ordinary positional notation.",
      "In a fixed base the sign of n is discarded, so negative integers give the same digits as their absolute value.",
      "IntegerDigits(0) is $\\{0\\}$ -- there's always at least one digit.",
      "The 3-argument form keeps only the len least-significant digits, truncating or zero-padding as needed.",
      "Systems: `PositionalNumerals(b)`, `MixedRadixNumerals([…])`, `FactorialNumerals`, `PrimorialNumerals`, `BalancedNumerals(b)`, `NegativeNumerals(b)`, `BijectiveNumerals(k)`, `ZeckendorfNumerals`, `OstrowskiNumerals([…])`, `CombinatorialNumerals(k)`, `ResidueNumerals([…])`, `AdicNumerals(b, prec?)` — also written `Radix`, `MixedRadix`, `Factoradic`, `PrimorialRadix`, `BalancedRadix`, `NegativeRadix`, `BijectiveRadix`, `Zeckendorf`, `Ostrowski`, `CombinatorialSystem`, `ResidueSystem`",
      "`PositionalNumerals(b)` is ordinary base-$b$ notation, $b\\ge2$ — the same digits an integer base already gives, wrapped as a system value so it can stand wherever the others do (`NumeralSystemShape`, a constant-radix `MixedRadixNumerals` comparison)",
      "`OstrowskiNumerals([a₁, …])` is the numeral system a CONTINUED FRACTION defines: place values are the convergents' denominators, and a digit at its ceiling forbids a non-zero digit below it. All quotients 1 is $\\varphi$, and that case IS Zeckendorf",
      "`BalancedNumerals` and `NegativeNumerals` represent NEGATIVE integers with no sign at all; fixed radix drops the sign instead",
      "The factoradic digits of $n$ are the Lehmer code of the $n$-th permutation, so padding to the permutation's size makes the two line up",
      "An integer with no numeral in a system — anything past $\\prod m_i$ in a residue system, say — leaves the call standing rather than answering",
      "Bijective bases have no zero DIGIT, but zero itself is the empty numeral: that is what makes the correspondence with strings a bijection",
      "Inverted by [[FromDigits]] with the same system",
    ],
    examples: [
      { expr: ["IntegerDigits", 1234], expected: ["List", 1, 2, 3, 4] },
      {
        expr: ["IntegerDigits", 2147, 2],
        expected: ["List", 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1],
      },
      {
        expr: ["IntegerDigits", 0],
        expected: ["List", 0],
        category: "Possible issues",
        caption: "Unlike [[IntegerString]] there's always at least one digit, even for 0",
      },
      {
        expr: ["IntegerDigits", -3134],
        expected: ["List", 3, 1, 3, 4],
        category: "Possible issues",
        caption: "The sign is discarded",
      },
      {
        expr: ["IntegerDigits", 6345354, 10, 4],
        expected: ["List", 5, 3, 5, 4],
        category: "Applications",
        caption: "The 3-argument form keeps only the 4 least-significant digits",
      },
      {
        expr: ["IntegerDigits", ["List", 6, 7, 2], 2],
        expected: ["List", ["List", 1, 1, 0], ["List", 1, 1, 1], ["List", 1, 0]],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["IntegerDigits", 2147, ["PositionalNumerals", 2]],
        expected: ["List", 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1],
        caption: "ordinary base 2, as a system value — same digits as the native 2-argument form",
        category: "Scope",
      },
      {
        expr: ["IntegerDigits", 93784, ["MixedRadixNumerals", L(24, 60, 60)]],
        expected: L(1, 2, 3, 4),
        caption: "93 784 seconds as days, hours, minutes, seconds",
      },
      {
        expr: ["IntegerDigits", 5, "FactorialNumerals", 4],
        expected: L(0, 2, 1, 0),
        caption: "the Lehmer code of the 6th permutation of four things",
        category: "Applications",
      },
      {
        expr: ["IntegerDigits", 100, "ZeckendorfNumerals"],
        expected: L(1, 0, 0, 0, 0, 1, 0, 1, 0, 0),
        caption: "$100 = 89 + 8 + 3$, with no two adjacent ones",
      },
      {
        expr: ["IntegerDigits", 20, ["OstrowskiNumerals", L(1, 1, 1, 1, 1, 1, 1, 1)]],
        expected: L(0, 1, 0, 1, 0, 1, 0, 0),
        caption: "the same $20 = 13 + 5 + 2$, over a continued fraction's convergents",
        category: "Scope",
      },
      {
        expr: ["IntegerDigits", -5, ["BalancedNumerals", 3]],
        expected: L(-1, 1, 1),
        caption: "a negative integer, with no sign",
        category: "Scope",
      },
      {
        expr: ["IntegerDigits", 703, ["BijectiveNumerals", 26]],
        expected: L(1, 1, 1),
        caption: "spreadsheet column AAA",
        category: "Scope",
      },
      {
        expr: ["IntegerDigits", 23, ["ResidueNumerals", L(3, 5, 7)]],
        expected: L(2, 3, 2),
        caption: "independent residues — no place values",
        category: "Scope",
      },
      {
        expr: ["IntegerDigits", -3, ["AdicNumerals", 10, 6]],
        expected: L(9, 9, 9, 9, 9, 7),
        caption:
          "the 10-adic truncation: a negative is spelled by its digits, and the width is part of the numeral",
        category: "Scope",
      },
      {
        expr: ["IntegerDigits", 255, 16],
        expected: L(15, 15),
        caption: "an integer base is still the native handler",
        category: "Properties",
      },
      {
        expr: ["IntegerDigits", -3, "FactorialNumerals"],
        expected: ["IntegerDigits", -3, "FactorialNumerals"],
        caption:
          "no numeral for a negative in a system that spells only $n \\ge 0$; the message says which integers it does spell",
        category: "Possible issues",
      },
    ],
    seeAlso: ["FromDigits", "NumeralSystemShape", "DigitCount", "IntegerString"],
  },
  {
    name: "FromDigits",
    domain: DOMAIN,
    signature: "FromDigits(digits, base?)",
    summary:
      "The integer a digit string denotes, in any numeral system. The inverse of [[IntegerDigits]] — and the round trip is the whole specification of a system.",
    signatures: [
      {
        call: "FromDigits([d1, d2, …])",
        description: "integer formed from a digit list in base 10.",
      },
      {
        call: "FromDigits(string, base?)",
        description: "integer formed from a digit string, 0-9 then a-z.",
        library: "enumeratio-numerals",
      },
      {
        call: "FromDigits([d1, d2, …], base)",
        description: "integer formed from a digit list in the given base.",
      },
      {
        call: "FromDigits(digits, system)",
        description: "read the digits in that system",
        library: "enumeratio-numerals",
      },
    ],
    details: [
      "A digit string that denotes NO integer leaves the call standing: two adjacent Zeckendorf ones, an out-of-range mixed-radix digit, residues that no integer satisfies",
      "In a residue system with moduli that are not pairwise coprime the map is not a bijection, and an inconsistent string has no value",
      "Zeckendorf is the clearest case of a system whose digits are constrained by a forbidden PATTERN rather than a per-place bound",
      "Reading a `ResidueNumerals` numeral IS the Chinese remainder theorem: the digits are the [[IntegerMod]] classes of $n$, and [[ChineseRemainder]] of those classes gives it back",
      "In a fixed base, the inverse of [[IntegerDigits]]: $\\mathrm{FromDigits}(\\mathrm{IntegerDigits}(n))=n$ for $n\\ge0$.",
      "Digits need not be restricted to $0..\\mathrm{base}-1$ -- a digit $\\ge$ base simply carries into higher place values.",
      "An empty digit list has no natural value; compute-engine leaves it unevaluated rather than returning 0.",
      "compute-engine's FromDigits takes a list of digits, not a digit string.",
    ],
    examples: [
      { expr: ["FromDigits", ["List", 5, 1, 2, 8]], expected: 5128 },
      {
        expr: ["FromDigits", ["List", 1, 0, 1, 1, 0, 1, 1], 2],
        expected: 91,
      },
      {
        expr: ["Equal", ["FromDigits", ["IntegerDigits", 58127]], 58127],
        expected: "True",
        category: "Properties",
        caption: "FromDigits inverts [[IntegerDigits]]",
      },
      {
        expr: ["FromDigits", ["List", 7, 11, 0, 0, 0, 122]],
        expected: 810122,
        category: "Neat examples",
        caption:
          "Digits ≥ the base carry into higher place values: $7\\times10^5+11\\times10^4+122=810122$",
      },
      {
        expr: ["FromDigits", ["List"]],
        expected: ["FromDigits", ["List"]],
        category: "Possible issues",
        caption: "An empty digit list is left unevaluated rather than treated as 0",
        divergence: {
          wolfram: "An empty digit list is left unevaluated here; Wolfram reads it as 0.",
        },
      },
      {
        expr: ["FromDigits", "'1923'"],
        expected: 1923,
        category: "Scope",
        caption: "The digits can be given as a string, 0-9 then a-z",
      },
      {
        expr: ["FromDigits", L(1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1), ["PositionalNumerals", 2]],
        expected: 2147,
        caption: "ordinary base 2 as a system value",
        category: "Scope",
      },
      {
        expr: ["FromDigits", L(1, 2, 3, 4), ["MixedRadixNumerals", L(24, 60, 60)]],
        expected: 93784,
        caption: "1d 2h 3m 4s back to seconds",
      },
      {
        expr: ["FromDigits", L(0, 2, 1, 0), "FactorialNumerals"],
        expected: 5,
        caption: "a Lehmer code back to its rank",
        category: "Applications",
      },
      {
        expr: ["FromDigits", L(2, 3, 2), ["ResidueNumerals", L(3, 5, 7)]],
        expected: 23,
        caption: "CRT reconstruction",
      },
      {
        expr: ["FromDigits", L(1, 1), "ZeckendorfNumerals"],
        expected: ["FromDigits", L(1, 1), "ZeckendorfNumerals"],
        caption: "two adjacent ones is not a numeral, so it denotes nothing",
        category: "Possible issues",
      },
    ],
    seeAlso: ["IntegerDigits", "NumeralSystemShape", "ChineseRemainder"],
  },
  {
    name: "IntegerString",
    domain: DOMAIN,
    signature: "IntegerString(n, base?, length?)",
    summary: "The string representation of n in the given base (default 10).",
    signatures: [
      { call: "IntegerString(n)", description: "string form of $n$ in base 10." },
      {
        call: "IntegerString(n, base)",
        description: "string form of $n$ in the given base, up to base 36.",
      },
      {
        call: "IntegerString(n, base, length)",
        description:
          "padded with leading zeros to exactly `length` digits, or cut to the last `length`.",
        library: "enumeratio-numerals",
      },
    ],
    details: [
      "Bases above 10 use letters a-z for digit values beyond 9, up to base 36.",
      "compute-engine keeps a leading minus sign for negative n",
      "A third argument pads with leading zeros to that length, or keeps only the last that many digits; with it, a negative n is left unevaluated (Wolfram drops the sign, compute-engine keeps it).",
      "compute-engine's second argument is always a numeric base.",
    ],
    examples: [
      { expr: ["IntegerString", 42], expected: "'42'" },
      { expr: ["IntegerString", 17651, 2], expected: "'100010011110011'" },
      {
        expr: ["IntegerString", 255, 16],
        expected: "'ff'",
        caption: "Bases above 10 use letters a-z",
      },
      {
        expr: ["IntegerString", 0],
        expected: "'0'",
        category: "Possible issues",
      },
      {
        expr: ["IntegerString", -42],
        expected: "'-42'",
        category: "Possible issues",
        caption: "compute-engine keeps the sign",
        divergence: { wolfram: "compute-engine keeps the sign; Wolfram's IntegerString drops it." },
      },
      {
        expr: ["IntegerString", 5, 2, 8],
        expected: "'00000101'",
        category: "Scope",
        caption:
          "A third argument pads with leading zeros to that length (or keeps only the last that many digits)",
      },
    ],
    seeAlso: ["IntegerDigits"],
  },
  {
    name: "DigitCount",
    domain: DOMAIN,
    signature: "DigitCount(n, base?)",
    summary: "Counts of each digit (1 through 9, then 0) occurring in n, base 10 by default.",
    signatures: [
      { call: "DigitCount(n)", description: "counts of each digit 1-9 then 0, base 10." },
      {
        call: "DigitCount(n, base)",
        description: "counts of each digit in the given base, highest digit value first.",
      },
      { call: "DigitCount(n, base, digit)", description: "count of just one digit value." },
    ],
    details: [
      "Equivalent to tallying [[IntegerDigits]](n, base) bucket by bucket.",
      "The default base-10 form orders counts 1 through 9, then 0 last.",
      "The 3-argument form isolates the count of a single digit value.",
      'Trailing zeros count individually -- 122000 has three trailing 0 digits, not a single "trailing zeros" tally.',
    ],
    examples: [
      {
        expr: ["DigitCount", 2147],
        expected: ["List", 1, 1, 0, 1, 0, 0, 1, 0, 0, 0],
      },
      {
        expr: ["DigitCount", 2147, 2],
        expected: ["List", 5, 7],
        caption: "In base 2, counts of digit 1 then digit 0",
      },
      {
        expr: ["DigitCount", 2147, 10, 1],
        expected: 1,
        category: "Applications",
        caption: "The 3-argument form isolates a single digit's count",
      },
      {
        expr: ["DigitCount", 122000, 10, 0],
        expected: 3,
        category: "Possible issues",
        caption: "Three trailing zeros, not four: $122000$ has digits $1,2,2,0,0,0$",
      },
      {
        expr: ["DigitCount", ["List", 23, 45]],
        expected: [
          "List",
          ["List", 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
          ["List", 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
        ],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
    ],
    seeAlso: ["IntegerDigits", "DigitSum"],
  },
  {
    name: "DigitSum",
    domain: DOMAIN,
    signature: "DigitSum(n, base?, length?)",
    summary: "The sum of the digits of n in the given base (default 10).",
    signatures: [
      { call: "DigitSum(n)", description: "sum of the digits of $n$, base 10." },
      { call: "DigitSum(n, base)", description: "sum of the digits of $n$ in the given base." },
      {
        call: "DigitSum(n, base, length)",
        description: "the digit sum of the last `length` digits, zero-padded.",
        library: "enumeratio-numerals",
      },
    ],
    details: [
      "Equivalent to summing [[IntegerDigits]](n, base).",
      "In base 2, the digit sum is the number of set bits (population count).",
      "$n\\equiv\\mathrm{DigitSum}(n)\\pmod9$ in base 10 -- the basis of the classic divisibility-by-9 check and digital root.",
      "The sign of n is discarded before summing.",
      "A third argument keeps the last that many digits, zero-padded, as [[IntegerDigits]] does.",
    ],
    examples: [
      { expr: ["DigitSum", 58127], expected: 23 },
      {
        expr: ["DigitSum", 58127, 2],
        expected: 9,
        caption: "In base 2 this is the number of set bits",
      },
      {
        expr: ["DigitSum", 0],
        expected: 0,
        category: "Possible issues",
      },
      {
        expr: ["Equal", ["Mod", ["DigitSum", 58127], 9], ["Mod", 58127, 9]],
        expected: "True",
        category: "Properties",
        caption:
          "Digit sum ≡ n (mod 9): the basis of the classic divisibility-by-9 check and the digital root",
      },
      {
        expr: ["DigitSum", 6345354, 10, 4],
        expected: 17,
        category: "Scope",
        caption:
          "A length keeps the last that many digits, as [[IntegerDigits]] does: $5 + 3 + 5 + 4$",
      },
    ],
    seeAlso: ["DigitCount"],
  },
  {
    name: "NumeralSystemShape",
    domain: DOMAIN,
    signature: "NumeralSystemShape(system)",
    summary:
      "What a system's numerals look like, as a Dictionary: whether it is a bijection, which integers it spells, and with which digits.",
    signatures: [
      {
        call: "NumeralSystemShape(system)",
        description:
          "`Bijective`, `Integers`, and when they apply `Digits` (one set, or one per place), `Width` and `Rule`",
        library: "enumeratio-numerals",
      },
    ],
    details: [
      "`Digits` is one set when every place shares it, and a list — most significant first — when places differ, as in a mixed radix or a residue system",
      "`Rule` names a constraint no per-place bound captures: Zeckendorf's no two adjacent ones, Ostrowski's ceiling rule",
      "A residue system whose moduli share a factor still spells every integer below $\\prod m_i$, but not uniquely: `Bijective` is False",
    ],
    examples: [
      {
        expr: ["NumeralSystemShape", ["ResidueNumerals", L(4, 6)]],
        expected: [
          "Dictionary",
          ["KeyValuePair", { str: "Bijective" }, "False"],
          ["KeyValuePair", { str: "Integers" }, ["Range", 0, 23]],
          ["KeyValuePair", { str: "Digits" }, ["List", ["Range", 0, 3], ["Range", 0, 5]]],
          ["KeyValuePair", { str: "Width" }, 2],
        ],
        caption: "4 and 6 share a factor, so this is not a bijection",
      },
      {
        expr: ["NumeralSystemShape", "ZeckendorfNumerals"],
        expected: [
          "Dictionary",
          ["KeyValuePair", { str: "Bijective" }, "True"],
          ["KeyValuePair", { str: "Integers" }, "NonNegativeIntegers"],
          ["KeyValuePair", { str: "Digits" }, ["Range", 0, 1]],
          ["KeyValuePair", { str: "Rule" }, "'no two adjacent ones'"],
        ],
        category: "Scope",
      },
      {
        expr: ["NumeralSystemShape", ["PositionalNumerals", 2]],
        expected: [
          "Dictionary",
          ["KeyValuePair", { str: "Bijective" }, "True"],
          ["KeyValuePair", { str: "Integers" }, "NonNegativeIntegers"],
          ["KeyValuePair", { str: "Digits" }, ["Range", 0, 1]],
        ],
        caption: "ordinary base 2, in the same shape every other system reports",
        category: "Scope",
      },
      {
        expr: ["NumeralSystemShape", ["BalancedNumerals", 3]],
        expected: [
          "Dictionary",
          ["KeyValuePair", { str: "Bijective" }, "True"],
          ["KeyValuePair", { str: "Integers" }, "Integers"],
          ["KeyValuePair", { str: "Digits" }, ["Range", -1, 1]],
        ],
        caption: "every integer, negatives included, with no sign",
        category: "Scope",
      },
    ],
    seeAlso: ["IntegerDigits", "FromDigits"],
  },
  {
    name: "AdicNumeral",
    domain: DOMAIN,
    signature: "AdicNumeral(b, x, prec?)",
    summary:
      "A $b$-adic number: the rational $x$ read in $\\mathbb{Z}_b$ (or $\\mathbb{Q}_p$ for prime $b$), exact when built from a rational, $+ O(b^{prec})$ when capped. The ring operations work on it.",
    signatures: [
      {
        call: "AdicNumeral(b, x)",
        description: "exact: $x$ any rational whose denominator $b$ can invert",
        library: "enumeratio-numerals",
      },
      {
        call: "AdicNumeral(b, x, prec)",
        description: "$x$ known modulo $b^{prec}$, normalised to its representative",
        library: "enumeratio-numerals",
      },
    ],
    details: [
      "Two values share the head. An EXACT adic is a rational, and its expansion can be produced to any depth (it is eventually periodic). A CAPPED adic is known only modulo $b^{prec}$ — what a Hensel lift produces, and what any arithmetic with a capped operand yields; the precision of a sum is the weaker operand's, of a product $\\min(v_1 + p_2, v_2 + p_1)$",
      "Prime $b$ gives the field $\\mathbb{Q}_p$: any non-zero divisor works and the result may have negative valuation (digits past the point). Composite $b$ gives the ring $\\mathbb{Z}_b$ — no field, zero divisors, and division only by units (coprime to $b$)",
      "A rational the base cannot expand — $1/2$ in $\\mathbb{Z}_{10}$ — leaves the call standing",
      "A rational operand beside an adic one is read in the same base, so `AdicNumeral(10, 1/3) * 3` is `AdicNumeral(10, 1)`. Adics of different bases never combine",
      "Not a compute-engine number type: the value is a function expression, and `Add`, `Multiply`, `Negate`, `Divide`, `Power` are wrapped to recognise it (`Subtract` reaches them by canonicalisation)",
      "Default precision for anything unbounded — Hensel lifting, `AdicSqrt` — is 20 digits",
    ],
    examples: [
      {
        expr: ["Multiply", ["AdicNumeral", 10, ["Rational", 1, 3]], 3],
        expected: ["AdicNumeral", 10, 1],
        caption: "$…6667 × 3 = 1$: $1/3$ is a 10-adic integer",
      },
      {
        expr: ["Add", ["AdicNumeral", 10, -1], 1],
        expected: ["AdicNumeral", 10, 0],
        caption: "$…999 + 1 = 0$, carrying forever",
      },
      {
        expr: ["AdicNumeral", 10, ["Rational", 1, 3], 8],
        expected: ["AdicNumeral", 10, 66666667, 8],
        caption: "capped: the representative modulo $10^8$",
        category: "Scope",
      },
      {
        expr: ["Divide", ["AdicNumeral", 5, 3], 5],
        expected: ["AdicNumeral", 5, ["Rational", 3, 5]],
        caption: "prime base: $\\mathbb{Q}_5$ is a field, so the point moves",
        category: "Scope",
      },
      {
        expr: ["Divide", ["AdicNumeral", 10, 3], 2],
        expected: ["Multiply", ["Rational", 1, 2], ["AdicNumeral", 10, 3]],
        caption: "composite base: 2 is not a unit of $\\mathbb{Z}_{10}$, so this declines",
        category: "Possible issues",
      },
    ],
    seeAlso: ["AdicExpansion", "AdicValuation", "AdicSqrt", "HenselLift", "IntegerDigits"],
  },
  {
    name: "AdicExpansion",
    domain: DOMAIN,
    signature: "AdicExpansion(x, count?)",
    summary:
      "The digits of a $b$-adic number, written with the infinite end on the left: $\\ldots 6667$ for $1/3$ in $\\mathbb{Z}_{10}$, $0.12$ for $7/25$ in $\\mathbb{Q}_5$, $+ O(b^n)$ when capped.",
    signatures: [
      {
        call: "AdicExpansion(x, count?)",
        description: "the first `count` digits (default 20) as a string",
        library: "enumeratio-numerals",
      },
      {
        call: "AdicDigits(x, count?)",
        description:
          "the same digits as a list, LEAST significant first — the only order that lists something with no left end",
        library: "enumeratio-numerals",
      },
    ],
    details: [
      "The ellipsis marks the infinite left end and is dropped only when nothing hides there: an exact non-negative integer (times $b^v$)",
      "Digits past the point are the negative-valuation places, prime bases only",
      "Digits $\\ge 10$ are bracketed, so base 16 reads `…[15][15][15]`",
    ],
    examples: [
      {
        expr: ["AdicExpansion", ["AdicNumeral", 10, ["Rational", 1, 3]], 8],
        expected: "'…66666667'",
      },
      {
        expr: ["AdicExpansion", ["AdicNumeral", 2, ["Rational", 1, 3]], 8],
        expected: "'…10101011'",
        caption: "the same $1/3$, 2-adically",
      },
      {
        expr: ["AdicExpansion", ["AdicNumeral", 5, ["Rational", 7, 25]], 8],
        expected: "'0.12'",
        caption: "$7/25 = 2·5^{-2} + 1·5^{-1}$",
        category: "Scope",
      },
      {
        expr: ["AdicDigits", ["AdicNumeral", 10, ["Rational", 1, 3]], 6],
        expected: L(7, 6, 6, 6, 6, 6),
        caption: "as a list, least significant first",
      },
    ],
    seeAlso: ["AdicNumeral", "IntegerDigits"],
  },
  {
    name: "AdicValuation",
    domain: DOMAIN,
    signature: "AdicValuation(x)",
    summary:
      "The $b$-adic valuation $v_b(x)$ — the power of $b$ dividing $x$ — with its companions: the norm $|x|_b = b^{-v}$ and the unit part $u$ in $x = b^v · u$.",
    signatures: [
      {
        call: "AdicValuation(x)",
        description: "$v_b(x)$; `PositiveInfinity` for zero",
        library: "enumeratio-numerals",
      },
      {
        call: "AdicNorm(x)",
        description: "$b^{-v_b(x)}$: small when highly divisible by $b$",
        library: "enumeratio-numerals",
      },
      {
        call: "AdicUnitPart(x)",
        description: "$x / b^{v_b(x)}$, a unit of $\\mathbb{Z}_b$",
        library: "enumeratio-numerals",
      },
    ],
    details: [
      "For composite $b$ this is the largest $k$ with $b^k | x$, which is not a valuation in the strict sense (it is not additive: $v_{10}(2) + v_{10}(5) = 0 ≠ v_{10}(10)$) — but it is what the expansion's leading zeros count",
      "A capped zero is $O(b^{prec})$, so its valuation is reported as the precision: all that is known",
      "Wolfram's `IntegerExponent[n, p]` is the valuation on integers",
    ],
    examples: [
      { expr: ["AdicValuation", ["AdicNumeral", 5, 75]], expected: 2 },
      { expr: ["AdicNorm", ["AdicNumeral", 5, 75]], expected: ["Rational", 1, 25] },
      { expr: ["AdicUnitPart", ["AdicNumeral", 5, 75]], expected: ["AdicNumeral", 5, 3] },
      {
        expr: ["AdicValuation", ["AdicNumeral", 5, ["Rational", 3, 25]]],
        expected: -2,
        caption: "negative in $\\mathbb{Q}_5$",
        category: "Scope",
      },
    ],
    seeAlso: ["AdicNumeral", "AdicExpansion"],
  },
  {
    name: "HenselLift",
    domain: DOMAIN,
    signature: "HenselLift(f, seed, b, prec?)",
    summary:
      "The $b$-adic root of a polynomial that reduces to `seed` mod $b$, by Newton's iteration — Hensel's lemma made to run. `AdicSqrt` is the special case $f = x^2 − a$.",
    signatures: [
      {
        call: "HenselLift(f, seed, b, prec?)",
        description: "needs $f(seed) ≡ 0$ and $f'(seed)$ a unit mod $b$; $f$ in one free variable",
        library: "enumeratio-numerals",
      },
      {
        call: "AdicSqrt(x, prec?)",
        description: "a square root in $\\mathbb{Z}_p$, prime $p$; declines when there is none",
        library: "enumeratio-numerals",
      },
    ],
    details: [
      "Each Newton step doubles the number of correct digits, so 20 digits take five steps",
      "The result is capped at `prec` (default 20): a root found this way is known modulo $b^{prec}$ and nothing more, which is where capped values come from",
      "A root with $f'(seed) ≡ 0$ is not simple and does not lift this way — $x^3 − x$ from 1 in $\\mathbb{Z}_2$ declines",
      "Composite $b$ works when $f'(seed)$ is coprime to $b$, and that is how the non-rational elements of $\\mathbb{Z}_{10}$ appear: $x^2 − x$ from 5 lifts to the idempotent $…890625$",
      "Square roots: an odd prime needs $x$ to be a quadratic residue mod $p$; $p = 2$ needs $x ≡ 1 \\pmod 8$ and starts the iteration one level up, since $f'(a) = 2a$ is not a unit",
    ],
    examples: [
      {
        expr: ["HenselLift", ["Subtract", ["Power", "x", 2], 2], 3, 7, 6],
        expected: ["AdicNumeral", 7, 38181, 6],
        caption: "$\\sqrt{2}$ in $\\mathbb{Z}_7$, from $3^2 ≡ 2 \\pmod 7$",
      },
      {
        expr: ["Power", ["AdicSqrt", ["AdicNumeral", 7, 2], 6], 2],
        expected: ["AdicNumeral", 7, 2, 6],
        caption: "and squaring it gives 2 back, to the same precision",
      },
      {
        expr: ["AdicExpansion", ["HenselLift", ["Subtract", ["Power", "x", 2], "x"], 5, 10, 8]],
        expected: "'…12890625 + O(10^8)'",
        caption: "a 10-adic idempotent: $e^2 = e$, and $e ≠ 0, 1$",
        category: "Applications",
      },
      {
        expr: ["AdicSqrt", ["AdicNumeral", 7, 3]],
        expected: ["AdicSqrt", ["AdicNumeral", 7, 3]],
        caption: "3 is not a square mod 7, so it has no 7-adic square root",
        category: "Possible issues",
      },
    ],
    seeAlso: ["AdicNumeral", "AdicExpansion"],
  },
];
