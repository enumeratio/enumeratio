import type { ReferenceEntry } from "../types.ts";

// Reference entries for @enumeratio/residues: arithmetic in ℤ/m. `Mod`, `PowerMod`,
// `ModularInverse`, `ChineseRemainder` and `MultiplicativeOrder` are compute-engine's own
// heads; the library widens some and adds the rest.

const DOMAIN = "Modular arithmetic";

export const residues: readonly ReferenceEntry[] = [
  {
    name: "Mod",
    domain: DOMAIN,
    signature: "Mod(a, b, d?)",
    summary: "The remainder of a on division by b.",
    signatures: [
      {
        call: "Mod(a, b)",
        description: "remainder of $a$ on division by $b$, with the sign of $b$.",
      },
      {
        call: "Mod(a, b, d)",
        description: "the $x \\equiv a \\pmod b$ with $d \\le x < d + b$.",
        library: "enumeratio-number-theory",
      },
      {
        call: "Mod(z, m)",
        description:
          "for Gaussian integers, $z - m\\,\\mathrm{Quotient}(z, m)$: the remainder in the box around 0",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "Equivalent to $a-b\\,\\mathrm{Quotient}(a,b)$, i.e. $a-b\\lfloor a/b\\rfloor$.",
      "When $b>0$ the result lies in $[0,b)$; the sign of the result always matches the sign of $b$.",
      "Periodic: $a\\bmod n=(a+kn)\\bmod n$ for any integer $k$.",
      "compute-engine returns NaN for a zero modulus rather than leaving the call unevaluated.",
      "A third argument $d$ offsets the range to $[d, d+b)$, as Wolfram's Mod[a, b, d] does.",
    ],
    examples: [
      { expr: ["Mod", 17, 5], expected: 2 },
      { expr: ["Mod", 100, 7], expected: 2 },
      {
        expr: ["Mod", -7, 3],
        expected: 2,
        caption: "The result takes the sign of the modulus",
      },
      {
        expr: ["Mod", ["List", 1, 2, 3, 4, 5], 3],
        expected: ["List", 1, 2, 0, 1, 2],
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Mod", 5, 0],
        expected: "NaN",
        category: "Possible issues",
        caption: "Division by a 0 modulus yields NaN rather than an error",
      },
      {
        expr: ["Equal", ["Mod", 17, 5], ["Mod", ["Add", 17, ["Multiply", 3, 5]], 5]],
        expected: "True",
        category: "Properties",
        caption: "Periodicity: $a \\bmod n = (a+kn) \\bmod n$ for any integer $k$",
      },
      {
        expr: ["Mod", 17, 5, 1],
        expected: 2,
        category: "Scope",
        caption:
          "A third argument offsets the range: the result lies in $[d, d + n)$, here $[1, 6)$",
      },
      {
        expr: ["Mod", 5, 3, 1],
        expected: 2,
        category: "Scope",
        caption: "With offset 1 the residues run $1, 2, 3$ rather than $0, 1, 2$",
      },
      {
        expr: ["Mod", ["Rational", 5, 2], 2],
        expected: ["Rational", 1, 2],
        category: "Scope",
        caption: "Rationals are reduced exactly",
      },
      {
        expr: ["Mod", 3.14, 2],
        expected: 1.14,
        category: "Scope",
      },
      {
        expr: ["Mod", ["Sqrt", 28], 3],
        expected: ["Add", -3, ["Multiply", 2, ["Sqrt", 7]]],
        aspirational: true,
        category: "Scope",
        caption:
          "An exact irrational should reduce exactly to $2\\sqrt7 - 3$; compute-engine answers with a float",
      },
      {
        expr: ["Mod", "Pi", 2],
        expected: ["Add", -2, "Pi"],
        aspirational: true,
        category: "Scope",
        caption: "A symbolic constant should reduce exactly to $\\pi - 2$; left unevaluated",
      },
      {
        expr: ["Mod", ["Power", 10, 10000], 10007],
        expected: 6333,
        category: "Scope",
        caption: "a 10 001-digit dividend",
      },
      {
        expr: ["Mod", 10, ["List", 3, 4, 7]],
        expected: ["List", 1, 2, 3],
        category: "Scope",
        caption: "Threads over a list of moduli",
      },
      {
        expr: ["Mod", ["Complex", 5, 3], 2],
        expected: ["Complex", 1, -1],
        category: "Scope",
        caption: "a Gaussian integer: $(5 + 3i) - 2(2 + 2i)$",
      },
      {
        expr: ["Mod", ["Complex", 5, 3], ["Complex", 1, 1]],
        expected: 0,
        category: "Scope",
        caption: "$1 + i$ divides $5 + 3i = (1 + i)(4 - i)$",
      },
      {
        expr: ["Mod", -5, -3],
        expected: -2,
        category: "Properties",
        caption: "A negative modulus gives a result in $(n, 0]$",
      },
      {
        expr: ["Mod", ["Complex", 7, 5], 3],
        expected: ["Complex", 1, -1],
        category: "Scope",
        caption: "Gaussian integers: the quotient rounds, so each part lands in $(-m/2, m/2]$",
      },
      {
        expr: ["Mod", ["Complex", 7, 5], ["Complex", 2, 1]],
        expected: ["Complex", 0, -1],
        category: "Scope",
        caption: "a Gaussian modulus: $7 + 5i = (2 + i)(4 + i) - i$",
      },
      {
        expr: [
          "Mod",
          ["Complex", { num: "100000000000000000001" }, { num: "9007199254740993" }],
          ["Complex", 2, 1],
        ],
        expected: 0,
        category: "Scope",
        caption: "exact in both parts past $2^{53}$",
      },
      {
        expr: [
          "Equal",
          ["Mod", ["Complex", 7, 5], ["Complex", 2, 1]],
          [
            "Subtract",
            ["Complex", 7, 5],
            ["Multiply", ["Complex", 2, 1], ["Quotient", ["Complex", 7, 5], ["Complex", 2, 1]]],
          ],
        ],
        expected: "True",
        category: "Properties",
        caption: "the remainder of [[Quotient]]",
      },
      {
        expr: ["List", ["Mod", ["Complex", 1, 2], 2], ["Mod", ["Complex", 3, 2], 2]],
        expected: ["List", 1, -1],
        category: "Possible issues",
        caption: "rounding ties to even means $1$ and $-1$ both appear as remainders mod 2",
      },
    ],
    seeAlso: ["PowerMod"],
  },
  {
    name: "PowerMod",
    domain: DOMAIN,
    signature: "PowerMod(a, b, m)",
    summary: "Modular exponentiation: a^b mod m, computed without forming a^b directly.",
    signatures: [
      { call: "PowerMod(a, b, m)", description: "modular exponentiation, $a^b \\bmod m$." },
      {
        call: "PowerMod(a, 1/r, m)",
        description:
          "the least $x \\ge 0$ with $x^r \\equiv a \\pmod m$; more generally $s/r$ for $x^r \\equiv a^s$",
        library: "enumeratio-residues",
      },
      {
        call: "PowerMod(u/v, b, m)",
        description: "a rational base, read in $\\mathbb{Z}/m$ as $u \\cdot v^{-1}$",
        library: "enumeratio-residues",
      },
    ],
    details: [
      "Computed by repeated squaring, without ever forming $a^b$ directly -- efficient even for huge $b$.",
      "A negative $b$ gives the modular inverse of $a$ raised to $|b|$, when it exists.",
      "The inverse is undefined whenever $\\gcd(a,m)\\neq1$; compute-engine leaves such calls unevaluated.",
      "Equal to $\\mathrm{Mod}(a^b, m)$ for positive $b$, just far more efficient. See [[Mod]].",
      "A rational exponent $s/r$ gives the least $x$ with $x^r \\equiv a^s$ — the first element of [[PowerModList]] — and stays unevaluated when there is none.",
      "Threads over lists in any argument.",
      "Gaussian integers are reduced as [[Mod]] reduces them; a rational-integer modulus must be positive, and a result that comes out real is reported in $[0, m)$.",
    ],
    examples: [
      { expr: ["PowerMod", 2, 10, 3], expected: 1 },
      { expr: ["PowerMod", 3, 50, 11], expected: 1 },
      { expr: ["PowerMod", 3, 2, 7], expected: 2 },
      {
        expr: ["PowerMod", 3, -2, 7],
        expected: 4,
        category: "Scope",
        caption: "$3^{-1} \\equiv 5$, and $5^2 = 25 \\equiv 4$",
      },
      {
        expr: ["PowerMod", 3, ["Rational", 1, 2], 2],
        expected: 1,
        category: "Scope",
        caption: "a square root of $3 \\equiv 1 \\pmod 2$",
      },
      {
        expr: ["PowerMod", ["List", 2, 3, 4], 2, 5],
        expected: ["List", 4, 4, 1],
        category: "Scope",
        caption: "threads over a list of bases",
      },
      {
        expr: ["PowerMod", 2, -1, 7],
        expected: 4,
        caption: "A negative exponent gives the modular inverse",
      },
      {
        expr: ["PowerMod", 7, 13, 33],
        expected: 13,
        category: "Applications",
        caption: "One step of RSA-style modular exponentiation: $7^{13} \\bmod 33$",
      },
      {
        expr: ["Equal", ["PowerMod", 2, 10, 3], ["Mod", ["Power", 2, 10], 3]],
        expected: "True",
        category: "Properties",
        caption: "By definition $a^b \\bmod m$, computed without ever forming $a^b$ directly",
      },
      {
        expr: ["PowerMod", 2, -1, 4],
        expected: ["PowerMod", 2, -1, 4],
        category: "Possible issues",
        caption:
          "No inverse exists when $\\gcd(a,m)\\neq1$ (here $\\gcd(2,4)=2$), so the call is left unevaluated",
      },
      {
        expr: ["PowerMod", 4, ["Rational", 1, 2], 7],
        expected: 2,
        category: "Scope",
        caption: "a rational exponent is a modular root: the least of $2, 5$",
      },
      {
        expr: ["PowerMod", 2, ["List", 10, 11, 12, 13, 14], 5],
        expected: ["List", 4, 3, 1, 2, 4],
        category: "Scope",
        caption: "threads over lists; the period is the order of 2 mod 5",
      },
      {
        expr: ["PowerMod", ["Add", ["Power", 10, 300], 1], 7, 5],
        expected: 1,
        category: "Scope",
        caption: "a 301-digit base",
      },
      {
        expr: ["PowerMod", 3, ["Rational", 1, 2], ["Add", ["Power", 10, 30], 57]],
        expected: { num: "492767688934650018614948489645" },
        category: "Scope",
        caption: "a square root of 3 modulo the prime $10^{30} + 57$",
      },
      {
        expr: ["PowerMod", ["Rational", 2, 3], 1, 7],
        expected: 3,
        category: "Scope",
        caption: "a rational base: $2 \\cdot 3^{-1} = 2 \\cdot 5 \\equiv 3 \\pmod 7$",
        divergence: {
          wolfram: "Wolfram's PowerMod takes integers (and Gaussian integers) only.",
        },
      },
      {
        expr: ["PowerMod", ["Complex", 2, 1], 2, 3],
        expected: ["Complex", 0, 1],
        category: "Scope",
        caption: "Gaussian integers: $(2+i)^2 = 3 + 4i \\equiv i \\pmod 3$",
      },
      {
        expr: ["PowerMod", ["Complex", 1, 2], ["Power", 10, 30], ["Complex", 7, 2]],
        expected: ["Complex", 1, 2],
        category: "Scope",
        caption: "a Gaussian modulus, and an exponent of $10^{30}$",
      },
      {
        expr: ["PowerMod", ["Complex", 11, -7], -4, ["Complex", 7, 4]],
        expected: ["Complex", -2, -1],
        category: "Scope",
        caption: "$11 - 7i$ is a unit mod $7 + 4i$, so it has negative powers",
        divergence: {
          wolfram:
            "Wolfram asks for a unit modulo the norm 65 here, not modulo $7 + 4i$, and leaves this unevaluated.",
        },
      },
      {
        expr: ["PowerMod", 7, ["Totient", 19], 19],
        expected: 1,
        category: "Properties",
        caption: "Euler's theorem: $a^{\\varphi(m)} \\equiv 1$ for $a$ coprime to $m$",
      },
      {
        expr: ["PowerMod", 2, 340, 341],
        expected: 1,
        category: "Applications",
        caption: "$341 = 11 \\cdot 31$ passes Fermat's test to base 2 — the least pseudoprime",
      },
      {
        expr: [
          "Equal",
          ["PowerMod", ["PowerMod", 5, 6, 23], 15, 23],
          ["PowerMod", ["PowerMod", 5, 15, 23], 6, 23],
        ],
        expected: "True",
        category: "Applications",
        caption: "Diffie–Hellman: both parties reach the shared key $5^{6 \\cdot 15} \\bmod 23$",
      },
      {
        expr: ["PowerMod", 2, ["Rational", 1, 2], 5],
        expected: ["PowerMod", 2, ["Rational", 1, 2], 5],
        category: "Possible issues",
        caption: "2 is not a square mod 5, so there is no root",
      },
    ],
    seeAlso: ["Mod", "PowerModList", "ModularInverse"],
  },
  {
    name: "PowerModList",
    domain: DOMAIN,
    signature: "PowerModList(a, s/r, m)",
    summary:
      "Every $x$ in $[0, m)$ with $x^r \\equiv a^s \\pmod m$ — all the values $a^{s/r}$ can take modulo $m$.",
    signatures: [
      {
        call: "PowerModList(a, s/r, m)",
        description: "every $x$ in $[0, m)$ with $x^r \\equiv a^s \\pmod m$, ascending",
        library: "enumeratio-residues",
      },
      {
        call: "PowerModList(a, k, m)",
        description: "an integer exponent gives the single value $\\{a^k \\bmod m\\}$",
        library: "enumeratio-residues",
      },
      {
        call: "PowerModList(a, -1, m)",
        description: "the modular inverse $\\{a^{-1}\\}$, or $\\{\\}$ when $\\gcd(a, m) \\ne 1$",
        library: "enumeratio-residues",
      },
    ],
    details: [
      "The problem splits over the prime powers of $m$ by the Chinese remainder theorem: a root mod $m$ is one root per channel $p^e$, every combination, so the count is the product of the channel counts.",
      "Mod a prime $p$ the units are cyclic of order $p - 1$, so $x^r \\equiv b$ has exactly $\\gcd(r, p-1)$ roots or none. One root is built Sylow subgroup by Sylow subgroup — only the primes dividing $r$ need a discrete log — so $p - 1$ is never factored and a 30-digit prime costs a millisecond.",
      "Roots are Hensel-lifted up each prime power: a root with $r x^{r-1} \\not\\equiv 0 \\pmod p$ lifts uniquely; a singular one (the 2-adic channel of a square root, or $p \\mid x$) lifts to all $p$ of its lifts or to none.",
      "The modulus has to be factored, by trial division and Pollard's rho under a step budget. A product of two large primes is out of reach, and the call stays unevaluated — which is the whole security of the Rabin cryptosystem.",
      "At most 100 000 roots are listed; past that the call stays unevaluated rather than build the list.",
      "Beyond Wolfram, a rational $a = u/v$ with $\\gcd(v, m) = 1$ is read in $\\mathbb{Z}/m$ as $u \\cdot v^{-1}$, the image of $\\mathbb{Z}_{(m)}$; a denominator sharing a factor with $m$ has no image, and the list is empty. See [[RationalReconstruction]] for the way back.",
      "Threads over lists in any argument.",
      "Over the Gaussian integers — beyond Wolfram, whose PowerModList takes integers only — $m$ factors into Gaussian prime powers: a split prime maps onto $\\mathbb{Z}/p^e$ by $i \\mapsto \\sqrt{-1}$, an inert $p$ has residue field $\\mathbb{F}_{p^2}$ and lifts by Hensel, and $1 + i$ lifts by testing both residues.",
    ],
    examples: [
      {
        expr: ["PowerModList", 3, ["Rational", 1, 2], 11],
        expected: ["List", 5, 6],
        caption: "the square roots of 3 modulo 11: $5^2 = 25$ and $6^2 = 36$ are both $\\equiv 3$",
      },
      {
        expr: ["PowerModList", 1, ["Rational", 1, 3], 7],
        expected: ["List", 1, 2, 4],
        caption: "the cube roots of unity modulo 7, since $3 \\mid 6$",
      },
      {
        expr: ["PowerModList", 2, ["Rational", 1, 3], 7],
        expected: ["List"],
        category: "Possible issues",
        caption: "the cubes mod 7 are only $0, 1, 6$, so 2 has no cube root",
      },
      {
        expr: ["PowerModList", 2, 10, 1000],
        expected: ["List", 24],
        caption: "an integer exponent is an ordinary power: $2^{10} = 1024$",
      },
      {
        expr: ["PowerModList", 2, ["Rational", 3, 2], 17],
        expected: ["List", 5, 12],
        caption: "a general exponent $s/r$: every $x$ with $x^2 \\equiv 2^3$",
        category: "Scope",
      },
      {
        expr: ["PowerModList", 2, ["Rational", 2, 3], 31],
        expected: ["List", 16, 18, 28],
        caption: "the three cube roots of $2^2 = 4$, since $3 \\mid 30$",
        category: "Scope",
      },
      {
        expr: ["PowerModList", 3, -1, 7],
        expected: ["List", 5],
        caption: "exponent $-1$ is the modular inverse: $3 \\cdot 5 = 15 \\equiv 1$",
        category: "Scope",
      },
      {
        expr: ["PowerModList", -1, ["Rational", 1, 2], 625],
        expected: ["List", 182, 443],
        caption: "a prime power: the root $2$ of $x^2 \\equiv -1 \\pmod 5$, Hensel-lifted to $5^4$",
        category: "Scope",
      },
      {
        expr: ["PowerModList", ["Rational", 2, 3], ["Rational", 1, 2], 23],
        expected: ["List", 4, 19],
        caption: "a rational base reads as $2 \\cdot 3^{-1}$ in $\\mathbb{Z}/23$",
        category: "Scope",
        divergence: {
          wolfram:
            "Wolfram's PowerModList takes integers only and leaves a rational base unevaluated.",
        },
      },
      {
        expr: ["PowerModList", ["List", 1, 2, 3, 4], ["Rational", 1, 2], 5],
        expected: ["List", ["List", 1, 4], ["List"], ["List"], ["List", 2, 3]],
        caption: "threads over lists: the squares mod 5 are exactly 1 and 4",
        category: "Scope",
        divergence: {
          wolfram:
            "We thread element-wise over a List base; Wolfram's PowerModList doesn't accept a List in the base position and leaves the call unevaluated.",
        },
      },
      {
        expr: ["PowerModList", -1, ["Rational", 1, 2], ["Add", ["Power", 10, 30], 57]],
        expected: [
          "List",
          { num: "164543371520667882579352850009" },
          { num: "835456628479332117420647150048" },
        ],
        caption:
          "$\\sqrt{-1}$ modulo the 31-digit prime $10^{30} + 57$ — no scan, no factoring of $p - 1$",
        category: "Scope",
      },
      {
        expr: ["PowerModList", 2, ["Rational", 1, 3], ["Subtract", ["Power", 2, 89], 1]],
        expected: [
          "List",
          1073741824,
          { num: "205880356524696485265270985" },
          { num: "413089663117993651110549302" },
        ],
        caption:
          "the cube roots of 2 modulo the Mersenne prime $2^{89} - 1$; the first is $2^{30}$, since $2^{90} = 2 \\cdot 2^{89} \\equiv 2$",
        category: "Scope",
      },
      {
        expr: ["PowerModList", -1, ["Rational", 1, 2], ["Power", 5, 40]],
        expected: [
          "List",
          { num: "2224618918409236552857702057" },
          { num: "6870328099320045826292688568" },
        ],
        caption: "forty Hensel steps up from $\\sqrt{-1} \\equiv 2 \\pmod 5$",
        category: "Scope",
      },
      {
        expr: [
          "Length",
          [
            "PowerModList",
            1,
            ["Rational", 1, 2],
            ["Multiply", 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53],
          ],
        ],
        expected: 32768,
        caption:
          "the square roots of 1 modulo the product of the first 16 primes: one per $\\pm$ sign over the 15 odd channels, $2^{15}$",
        category: "Scope",
      },
      {
        expr: [
          "Length",
          ["PowerModList", 1, ["Rational", 1, 1000], ["Subtract", ["Power", 2, 61], 1]],
        ],
        expected: 50,
        caption:
          "the 1000th roots of unity mod $2^{61} - 1$: $\\gcd(1000, 2^{61} - 2) = 50$ of them",
        category: "Scope",
      },
      {
        expr: [
          "Equal",
          ["Length", ["PowerModList", 1, ["Rational", 1, 12], 1009]],
          ["GCD", 12, 1008],
        ],
        expected: "True",
        caption: "mod a prime there are exactly $\\gcd(r, p - 1)$ $r$-th roots of unity",
        category: "Properties",
      },
      {
        expr: [
          "Equal",
          ["Length", ["PowerModList", 1, ["Rational", 1, 2], 1155]],
          ["Power", 2, ["PrimeNu", 1155]],
        ],
        expected: "True",
        caption:
          "for odd $m$ the square roots of 1 are the $2^{\\omega(m)}$ sign vectors over the CRT channels: $1155 = 3 \\cdot 5 \\cdot 7 \\cdot 11$",
        category: "Properties",
      },
      {
        expr: [
          "Equal",
          ["PowerMod", 4, ["Rational", 1, 2], 7],
          ["First", ["PowerModList", 4, ["Rational", 1, 2], 7]],
        ],
        expected: "True",
        caption: "[[PowerMod]] with a rational exponent is the least element of the list",
        category: "Properties",
      },
      {
        expr: ["PowerModList", 1, ["Rational", 1, 2], 15],
        expected: ["List", 1, 4, 11, 14],
        caption:
          "the split units of $\\mathbb{Z}/15$: $j_1 \\mapsto 4$ is a ring homomorphism $\\mathbb{R}[j]/(j^2 - 1) \\to \\mathbb{Z}/15$",
        category: "Applications",
      },
      {
        expr: ["Mod", ["Multiply", ["Add", 1, 4], ["Subtract", 1, 4]], 15],
        expected: 0,
        caption: "so the identity $(1+j)(1-j) = 0$ transports by $j \\mapsto 4$",
        category: "Applications",
      },
      {
        expr: ["PowerModList", -1, ["Rational", 1, 2], 65],
        expected: ["List", 8, 18, 47, 57],
        caption:
          "imaginary units of $\\mathbb{Z}/65$ exist because $5$ and $13$ are both $\\equiv 1 \\pmod 4$",
        category: "Applications",
      },
      {
        expr: [
          "PowerModList",
          ["PowerMod", 123456789, 2, ["Multiply", 1000003, 1000033]],
          ["Rational", 1, 2],
          ["Multiply", 1000003, 1000033],
        ],
        expected: ["List", 123456789, 30305547335, 969730452764, 999912543310],
        caption:
          "Rabin decryption: knowing the factors of $n$, the four square roots of the ciphertext include the message",
        category: "Applications",
      },
      {
        expr: ["PowerModList", -1, ["Rational", 1, 2], 15],
        expected: ["List"],
        caption: "no square root of $-1$: $3 \\equiv 3 \\pmod 4$ blocks its channel",
        category: "Possible issues",
      },
      {
        expr: ["PowerModList", 2, -1, 4],
        expected: ["List"],
        caption: "no inverse when $\\gcd(a, m) \\ne 1$, so the list is empty",
        category: "Possible issues",
        divergence: {
          wolfram:
            "We spell 'no inverse exists' as the empty list; Wolfram's PowerModList instead leaves the call unevaluated rather than returning {}.",
        },
      },
      {
        expr: ["PowerModList", 1, ["Rational", 1, 2], 8],
        expected: ["List", 1, 3, 5, 7],
        caption:
          "the 2-adic channel breaks the $2^{\\omega(m)}$ law: $\\mathbb{Z}/2^a$ has four square roots of 1 for $a \\ge 3$",
        category: "Possible issues",
      },
      {
        expr: [
          "PowerModList",
          4,
          ["Rational", 1, 2],
          ["Multiply", ["Add", ["Power", 10, 20], 39], ["Add", ["Power", 10, 20], 129]],
        ],
        expected: [
          "PowerModList",
          4,
          ["Rational", 1, 2],
          { num: "10000000000000000016800000000000000005031" },
        ],
        caption:
          "a product of two 21-digit primes cannot be factored in budget, so even $\\sqrt 4$ stays unevaluated — finding the other two roots is as hard as factoring",
        category: "Possible issues",
        divergence: {
          wolfram:
            "We decline once factoring the modulus exceeds our budget and leave the call symbolic; Wolfram's kernel factors this 41-digit product of two 21-digit primes within its own budget and returns all four square roots.",
        },
      },
      {
        expr: ["PowerModList", 0, ["Rational", 1, 2], ["Power", 3, 40]],
        expected: ["PowerModList", 0, ["Rational", 1, 2], { num: "12157665459056928801" }],
        caption: "$x^2 \\equiv 0 \\pmod{3^{40}}$ has $3^{20}$ roots — too many to list",
        category: "Possible issues",
      },
      {
        expr: ["PowerModList", 1, ["Rational", 1, 2], ["List", 8, 15, 21, 24]],
        expected: [
          "List",
          ["List", 1, 3, 5, 7],
          ["List", 1, 4, 11, 14],
          ["List", 1, 8, 13, 20],
          ["List", 1, 5, 7, 11, 13, 17, 19, 23],
        ],
        caption:
          "the moduli with four or more square roots of 1 come in patterns: mod 24 every unit is one, since $(\\mathbb{Z}/24)^\\times \\cong C_2^3$",
        category: "Neat examples",
        divergence: {
          wolfram:
            "We thread a rational exponent over a List of moduli; Wolfram's PowerModList doesn't accept a List modulus and leaves the call unevaluated.",
        },
      },
      {
        expr: ["PowerModList", ["Complex", 0, 1], ["Rational", 1, 2], 7],
        expected: ["List", ["Complex", -2, -2], ["Complex", 2, 2]],
        category: "Scope",
        caption:
          "a square root of $i$ in $\\mathbb{Z}[i]/(7)$, the field of 49 elements: $(2 + 2i)^2 = 8i \\equiv i$",
        divergence: { wolfram: "Wolfram's PowerModList takes integers only." },
      },
      {
        expr: [
          "PowerModList",
          ["Complex", 3, 4],
          ["Rational", 1, 2],
          ["Add", ["Power", 10, 20], 39],
        ],
        expected: ["List", ["Complex", -2, -1], ["Complex", 2, 1]],
        category: "Scope",
        caption:
          "$10^{20} + 39$ is inert, so its residue field is $\\mathbb{F}_{p^2}$ with $p$ of 21 digits",
        divergence: { wolfram: "Wolfram's PowerModList takes integers only." },
      },
    ],
    seeAlso: [
      "PowerMod",
      "ModularInverse",
      "MultiplicativeOrder",
      "PrimitiveRootList",
      "RationalReconstruction",
    ],
  },
  {
    name: "ModularInverse",
    domain: DOMAIN,
    signature: "ModularInverse(a, m)",
    summary: "The $x$ with $a x \\equiv 1 \\pmod m$, when $a$ is a unit mod $m$.",
    signatures: [
      { call: "ModularInverse(a, m)", description: "the inverse of $a$ modulo $m$, in $[0, m)$" },
      {
        call: "ModularInverse(z, m)",
        description: "over the Gaussian integers",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "Exists exactly when $\\gcd(a, m)$ is a unit; the call is otherwise left unevaluated.",
      "Read off the Bézout coefficient of [[ExtendedGCD]].",
      "For Gaussian integers, Wolfram reduces the inverse into $[0, m)$ part by part for a positive rational-integer $m$, and as [[Mod]] does otherwise.",
    ],
    examples: [
      { expr: ["ModularInverse", 3, 7], expected: 5, caption: "$3 \\cdot 5 = 15 \\equiv 1$" },
      { expr: ["ModularInverse", 2, 11], expected: 6 },
      {
        expr: ["ModularInverse", -3, 7],
        expected: 2,
        category: "Scope",
        caption: "a negative argument: $-3 \\cdot 2 = -6 \\equiv 1$",
      },
      {
        expr: ["ModularInverse", 3, ["Add", ["Power", 10, 20], 1]],
        expected: { num: "33333333333333333334" },
        category: "Scope",
        caption: "a 21-digit modulus",
      },
      {
        expr: ["ModularInverse", ["List", 2, 3, 4], 11],
        expected: ["List", 6, 4, 3],
        aspirational: true,
        category: "Scope",
        caption: "Listable: should thread over a list; not yet",
      },
      {
        expr: ["Equal", ["ModularInverse", 3, 7], ["PowerMod", 3, -1, 7]],
        expected: "True",
        category: "Properties",
        caption: "the same as [[PowerMod]] with exponent $-1$",
      },
      {
        expr: [
          "Mod",
          ["Multiply", 12345, ["ModularInverse", 12345, ["Subtract", ["Power", 2, 61], 1]]],
          ["Subtract", ["Power", 2, 61], 1],
        ],
        expected: 1,
        category: "Properties",
        caption: "$a \\cdot a^{-1} \\equiv 1$, modulo the Mersenne prime $2^{61} - 1$",
      },
      {
        expr: ["ModularInverse", ["Complex", 2, 1], 7],
        expected: ["Complex", 6, 4],
        category: "Scope",
        caption: "$(2 + i)(6 + 4i) = 8 + 14i \\equiv 1 \\pmod 7$",
      },
      {
        expr: ["ModularInverse", ["Complex", 11, -7], ["Complex", 7, 4]],
        expected: ["Complex", -1, 2],
        category: "Scope",
      },
      {
        expr: ["ModularInverse", 2, 4],
        expected: ["ModularInverse", 2, 4],
        category: "Possible issues",
        caption: "$\\gcd(2, 4) = 2$: no inverse",
      },
    ],
    seeAlso: ["PowerMod", "ExtendedGCD", "PowerModList"],
  },
  {
    name: "ChineseRemainder",
    domain: DOMAIN,
    signature: "ChineseRemainder([r1, r2, …], [m1, m2, …])",
    summary: "The smallest non-negative integer congruent to each ri modulo the corresponding mi.",
    signatures: [
      {
        call: "ChineseRemainder([r1, r2, …], [m1, m2, …])",
        description: "smallest non-negative $x$ with $x\\equiv r_i\\pmod{m_i}$ for every $i$.",
      },
      {
        call: "ChineseRemainder([r1, r2, …], [m1, m2, …], d)",
        description: "the smallest such $x$ with $x \\ge d$.",
        library: "enumeratio-residues",
      },
      {
        call: "ChineseRemainder(IntegerMod(r1, m1), IntegerMod(r2, m2), …)",
        description: "the [[IntegerMod]] class mod $\\operatorname{lcm}(m_i)$ that reduces to each",
        library: "enumeratio-residues",
      },
    ],
    details: [
      "When the moduli are pairwise coprime, the result is unique modulo $m_1m_2\\cdots m_n$ by the Chinese remainder theorem.",
      "A solution exists for non-coprime moduli only when the remainders agree on every shared factor; otherwise the system is inconsistent.",
      "An inconsistent system is left unevaluated, with a `ChineseRemainder::nsol` message naming the two congruences that clash.",
      "A third argument $d$ asks for the smallest solution $x \\ge d$ instead, as Wolfram's does.",
    ],
    examples: [
      {
        expr: ["ChineseRemainder", ["List", 3, 4], ["List", 4, 5]],
        expected: 19,
      },
      {
        expr: ["ChineseRemainder", ["List", 2, 3, 5], ["List", 3, 5, 7]],
        expected: 68,
      },
      {
        expr: ["ChineseRemainder", ["List", 1, 2, 3, 4, 5], ["List", 7, 11, 13, 17, 19]],
        expected: 180391,
        category: "Scope",
        caption:
          "five congruences, unique modulo $7 \\cdot 11 \\cdot 13 \\cdot 17 \\cdot 19 = 323323$",
      },
      {
        expr: ["ChineseRemainder", ["List", 1, 3], ["List", 4, 6]],
        expected: 9,
        category: "Scope",
        caption:
          "moduli sharing a factor, with remainders that agree on it: unique mod $\\operatorname{lcm} = 12$",
      },
      {
        expr: ["ChineseRemainder", ["Mod", 123456, ["List", 7, 11, 13]], ["List", 7, 11, 13]],
        expected: 333,
        category: "Applications",
        caption: "recover $123456 \\bmod 1001$ from its residues mod 7, 11 and 13. See [[Mod]]",
      },
      {
        expr: ["ChineseRemainder", ["List", 1, 2, 3], ["List", 3, 5, 7], 200],
        expected: 262,
        category: "Scope",
        caption: "the least solution $\\ge 200$: $52 + 2 \\cdot 105$",
      },
      {
        expr: [
          "And",
          ["Equal", ["Mod", ["ChineseRemainder", ["List", 3, 4], ["List", 4, 5]], 4], 3],
          ["Equal", ["Mod", ["ChineseRemainder", ["List", 3, 4], ["List", 4, 5]], 5], 4],
        ],
        expected: "True",
        category: "Properties",
        caption: "Verifies the solution satisfies both congruences via [[Mod]]",
      },
      {
        expr: [
          "ChineseRemainder",
          ["IntegerMod", 2, 3],
          ["IntegerMod", 3, 5],
          ["IntegerMod", 2, 7],
        ],
        expected: ["IntegerMod", 23, 105],
        category: "Scope",
        caption:
          "over classes, the answer is a class — and reading `ResidueNumerals([3, 5, 7])` digits back with [[FromDigits]] is the same computation",
      },
      {
        expr: ["ChineseRemainder", ["List", 1, 2], ["List", 6, 10]],
        expected: ["ChineseRemainder", ["List", 1, 2], ["List", 6, 10]],
        category: "Possible issues",
        caption:
          "No solution exists when the remainders are inconsistent at $\\gcd(6,10)=2$, so the call stays unevaluated and says why",
      },
      {
        expr: ["ChineseRemainder", ["List", 1, 2], ["List", 3, 5], 100],
        expected: 112,
        category: "Scope",
        caption:
          "A third argument asks for the smallest solution $x \\ge d$: here $x \\equiv 7 \\pmod{15}$, so 112",
      },
    ],
    seeAlso: ["Mod", "IntegerMod", "FromDigits"],
  },
  {
    name: "MultiplicativeOrder",
    domain: DOMAIN,
    signature: "MultiplicativeOrder(a, n)",
    summary: "The smallest positive k such that a^k ≡ 1 (mod n).",
    signatures: [
      {
        call: "MultiplicativeOrder(a, n)",
        description: "smallest positive $k$ with $a^k\\equiv1\\pmod n$.",
      },
      {
        call: "MultiplicativeOrder(a, n, {r1, r2, …})",
        description:
          "smallest positive $k$ with $a^k \\equiv r_i \\pmod n$ for some $i$ — a discrete logarithm",
        library: "enumeratio-residues",
      },
    ],
    details: [
      "Also called the modulo order; defined only when $\\gcd(a,n)=1$, since otherwise no power of $a$ can reach 1 mod $n$.",
      "Always divides $\\varphi(n)$, by Lagrange's theorem applied to the group of units mod $n$. See [[Totient]].",
      "Unevaluated when no order exists.",
      "Computed from Carmichael's $\\lambda(n)$ by stripping primes off it, so $n$ and each $p - 1$ must be factored.",
      "The three-argument form is a discrete logarithm, by Pohlig–Hellman over the order of $a$ and baby-step giant-step within each prime: the cost is $\\sqrt q$ for the largest prime $q$ dividing that order — instant for a smooth order, hopeless for a safe prime.",
    ],
    examples: [
      { expr: ["MultiplicativeOrder", 5, 8], expected: 2 },
      { expr: ["MultiplicativeOrder", 3, 7], expected: 6 },
      { expr: ["MultiplicativeOrder", 5, 7], expected: 6 },
      {
        expr: ["MultiplicativeOrder", -5, 7],
        expected: 3,
        category: "Scope",
        caption: "a negative base: $-5 \\equiv 2 \\pmod 7$",
      },
      {
        expr: ["MultiplicativeOrder", 5, 7, ["List", 3, 11]],
        expected: 2,
        category: "Scope",
        caption: "the first power of 5 to reach 3 or $11 \\equiv 4$: $5^2 = 25 \\equiv 4$",
      },
      {
        expr: ["MultiplicativeOrder", ["Power", 10, 10000], 7919],
        expected: 3959,
        category: "Scope",
        caption: "a 10 001-digit base modulo the prime 7919",
      },
      {
        expr: ["MultiplicativeOrder", 1, 7],
        expected: 1,
        category: "Properties",
        caption: "1 is the only element of order 1",
      },
      {
        expr: ["MultiplicativeOrder", 2, 7],
        expected: 3,
        caption: "$2^3=8\\equiv1\\pmod7$, and no smaller power works",
      },
      {
        expr: ["Equal", ["Mod", ["Totient", 7], ["MultiplicativeOrder", 3, 7]], 0],
        expected: "True",
        category: "Properties",
        caption: "The multiplicative order always divides $\\varphi(n)$. See [[Totient]]",
      },
      {
        expr: ["MultiplicativeOrder", 10, 22],
        expected: ["MultiplicativeOrder", 10, 22],
        category: "Possible issues",
        caption:
          "No order exists when $\\gcd(a,n)\\neq1$; here $\\gcd(10,22)=2$, so compute-engine leaves it unevaluated",
      },
      {
        expr: ["MultiplicativeOrder", 3, 7, ["List", -1, 1]],
        expected: 3,
        category: "Scope",
        caption: "the first power of 3 to reach $\\pm 1$: $3^3 = 27 \\equiv -1$",
      },
      {
        expr: ["MultiplicativeOrder", 5, 7, ["List", 2, 3, 4]],
        expected: 2,
        category: "Scope",
        caption: "$5^2 = 25 \\equiv 4$",
      },
      {
        expr: ["MultiplicativeOrder", 3, ["Subtract", ["Power", 2, 61], 1], ["List", 2]],
        expected: { num: "159602976958324900" },
        category: "Scope",
        caption: "a discrete log mod the Mersenne prime $2^{61} - 1$, whose $p - 1$ is smooth",
      },
      {
        expr: ["MultiplicativeOrder", 3, ["Subtract", ["Power", 2, 127], 1]],
        expected: { num: "56713727820156410577229101238628035242" },
        category: "Scope",
        caption: "3 has order $(p-1)/3$ modulo $2^{127} - 1$",
      },
      {
        expr: [
          "PowerMod",
          3,
          ["MultiplicativeOrder", 3, ["Subtract", ["Power", 2, 61], 1], ["List", 2]],
          ["Subtract", ["Power", 2, 61], 1],
        ],
        expected: 2,
        category: "Properties",
        caption: "the discrete log inverts [[PowerMod]]",
      },
      {
        expr: ["MultiplicativeOrder", 2, 7, ["List", 3]],
        expected: ["MultiplicativeOrder", 2, 7, ["List", 3]],
        category: "Possible issues",
        caption: "3 is not a power of 2 mod 7 — the powers are $\\{1, 2, 4\\}$",
      },
    ],
    seeAlso: ["PowerMod"],
  },
  {
    name: "PrimitiveRootList",
    domain: DOMAIN,
    signature: "PrimitiveRootList(n)",
    summary:
      "Every primitive root of $n$ — every generator of $(\\mathbb{Z}/n)^\\times$ — ascending.",
    signatures: [
      {
        call: "PrimitiveRootList(n)",
        description: "the generators of the unit group mod $n$, or $\\{\\}$ when it is not cyclic",
        library: "enumeratio-residues",
      },
    ],
    details: [
      "$(\\mathbb{Z}/n)^\\times$ is cyclic exactly for $n = 1, 2, 4, p^k, 2p^k$ with $p$ an odd prime; otherwise there are no primitive roots and the list is empty.",
      "When there is one generator $g$ there are $\\varphi(\\varphi(n))$: the powers $g^k$ with $\\gcd(k, \\varphi(n)) = 1$.",
      "A candidate $g$ is a generator iff $g^{\\varphi(n)/q} \\not\\equiv 1$ for every prime $q \\mid \\varphi(n)$, so $\\varphi(n)$ has to be factored.",
      "At most 100 000 roots are listed; past that the call stays unevaluated. [[PrimitiveRoot]] gives the least one at any size.",
    ],
    examples: [
      { expr: ["PrimitiveRootList", 7], expected: ["List", 3, 5] },
      {
        expr: ["PrimitiveRootList", 10],
        expected: ["List", 3, 7],
        category: "Scope",
        caption: "$10 = 2 \\cdot 5$ is of the form $2p$",
      },
      {
        expr: ["PrimitiveRootList", 25],
        expected: ["List", 2, 3, 8, 12, 13, 17, 22, 23],
        category: "Scope",
        caption: "an odd prime power: $\\varphi(\\varphi(25)) = 8$ generators",
      },
      {
        expr: ["PrimitiveRootList", 4],
        expected: ["List", 3],
        category: "Scope",
        caption: "$n = 4$ is one of the small cyclic cases",
      },
      {
        expr: ["PrimitiveRootList", ["List", 9, 11]],
        expected: ["List", ["List", 2, 5], ["List", 2, 6, 7, 8]],
        category: "Scope",
        caption: "threads over a list",
      },
      {
        expr: ["PrimitiveRootList", 12],
        expected: ["List"],
        category: "Possible issues",
        caption: "$(\\mathbb{Z}/12)^\\times \\cong C_2 \\times C_2$ is not cyclic either",
      },
      {
        expr: ["PrimitiveRootList", 18],
        expected: ["List", 5, 11],
        caption: "$18 = 2 \\cdot 3^2$ is of the form $2p^k$",
        category: "Scope",
      },
      {
        expr: ["Length", ["PrimitiveRootList", 1009]],
        expected: 288,
        category: "Scope",
      },
      {
        expr: ["Equal", ["Length", ["PrimitiveRootList", 1009]], ["Totient", ["Totient", 1009]]],
        expected: "True",
        caption: "there are $\\varphi(\\varphi(n))$ of them",
        category: "Properties",
      },
      {
        expr: ["Equal", ["First", ["PrimitiveRootList", 1009]], ["PrimitiveRoot", 1009]],
        expected: "True",
        caption: "the first is [[PrimitiveRoot]]",
        category: "Properties",
      },
      {
        expr: ["PrimitiveRootList", 8],
        expected: ["List"],
        caption: "$(\\mathbb{Z}/8)^\\times \\cong C_2 \\times C_2$ is not cyclic",
        category: "Possible issues",
      },
      {
        expr: ["Length", ["PrimitiveRootList", 1000003]],
        expected: 333332,
        caption:
          "past 100 000 roots the list is not built, but its length is still $\\varphi(\\varphi(n))$",
        category: "Possible issues",
      },
    ],
    seeAlso: ["PrimitiveRoot", "MultiplicativeOrder", "PowerModList"],
  },
  {
    name: "IntegerMod",
    domain: DOMAIN,
    signature: "IntegerMod(a, m)",
    summary:
      "$a \\bmod m$ as a VALUE — an element of $\\mathbb{Z}/m$ that arithmetic stays inside, after Sage's `Mod(a, m)`.",
    signatures: [
      {
        call: "IntegerMod(a, m)",
        description: "the residue class of $a$, normalised into $[0, m)$",
        library: "enumeratio-residues",
      },
      {
        call: "IntegerMod(u/v, m)",
        description: "a rational reads as $u \\cdot v^{-1}$, when $v$ is a unit mod $m$",
        library: "enumeratio-residues",
      },
    ],
    details: [
      "[[Mod]] answers an integer; `IntegerMod` IS the class, so `+`, `·`, `/` and powers of it are computed in $\\mathbb{Z}/m$ — a negative power inverts, and dividing by a non-unit leaves the call standing",
      "A bare integer or rational next to an `IntegerMod` is read in the same ring",
      "Two classes with different moduli meet in $\\mathbb{Z}/\\gcd(m, n)$, the largest ring both reduce to — Sage's coercion",
      "[[ChineseRemainder]] of classes is the class mod $\\operatorname{lcm}$ that reduces to each, and [[MultiplicativeOrder]] of a unit is its order",
      "The elements of [[IntegerModRing]](m)",
      "Written $a \\pmod{m}$, and typed that way too; `a \\bmod m` is still [[Mod]], and `a \\equiv b \\pmod{m}` is still a congruence. TraditionalForm writes the coset, $a + m\\mathbb{Z}$",
      "A call that declines — dividing by a non-unit — stays unevaluated with an `IntegerMod::ninv` message, after Wolfram's `PowerMod::ninv`",
    ],
    examples: [
      { expr: ["IntegerMod", 10, 7], expected: ["IntegerMod", 3, 7] },
      {
        expr: ["IntegerMod", ["Rational", 1, 3], 7],
        expected: ["IntegerMod", 5, 7],
        caption: "$1/3$ is the inverse of 3: $3 \\cdot 5 = 15 \\equiv 1$",
      },
      {
        expr: ["Power", ["IntegerMod", 3, 7], 6],
        expected: ["IntegerMod", 1, 7],
        caption: "Fermat: $3^6 \\equiv 1 \\pmod 7$",
      },
      {
        expr: ["Divide", 1, ["IntegerMod", 3, 7]],
        expected: ["IntegerMod", 5, 7],
        category: "Scope",
      },
      {
        expr: ["Add", ["IntegerMod", 2, 4], ["IntegerMod", 1, 6]],
        expected: ["IntegerMod", 1, 2],
        caption: "different moduli meet in $\\mathbb{Z}/\\gcd(4, 6)$",
        category: "Scope",
      },
      {
        expr: ["ChineseRemainder", ["IntegerMod", 2, 3], ["IntegerMod", 3, 5]],
        expected: ["IntegerMod", 8, 15],
        category: "Applications",
      },
      {
        expr: ["MultiplicativeOrder", ["IntegerMod", 2, 7]],
        expected: 3,
        category: "Applications",
      },
      {
        expr: ["Divide", 1, ["IntegerMod", 2, 4]],
        expected: ["Divide", 1, ["IntegerMod", 2, 4]],
        caption: "2 is not a unit mod 4, and the message says so",
        category: "Possible issues",
      },
      {
        expr: ["ChineseRemainder", ["IntegerMod", 1, 4], ["IntegerMod", 2, 6]],
        expected: ["ChineseRemainder", ["IntegerMod", 1, 4], ["IntegerMod", 2, 6]],
        caption: "odd mod 4 and even mod 6 at once: no such class",
        category: "Possible issues",
      },
    ],
    seeAlso: ["IntegerModRing", "Mod", "ChineseRemainder", "AdicNumeral"],
  },
  {
    name: "IntegerModRing",
    domain: DOMAIN,
    signature: "IntegerModRing(m)",
    summary:
      "The ring $\\mathbb{Z}/m$, as the finite collection of its $m$ [[IntegerMod]] classes.",
    signatures: [
      {
        call: "IntegerModRing(m)",
        description: "$\\mathbb{Z}/m$ — Sage's `Zmod(m)`",
        library: "enumeratio-residues",
      },
    ],
    details: [
      "A collection: it counts, enumerates and answers membership, so `Count`, `ListFrom` and `Element` work on it directly",
      "Membership is by modulus — `IntegerMod(3, 7)` is not in `IntegerModRing(5)`",
      "compute-engine's `QuotientRing(Integers, m)` — what $\\mathbb{Z}/m\\mathbb{Z}$ parses to — specialises to it, and it is written back that way",
    ],
    examples: [
      {
        expr: ["ListFrom", ["IntegerModRing", 3]],
        expected: ["List", ["IntegerMod", 0, 3], ["IntegerMod", 1, 3], ["IntegerMod", 2, 3]],
      },
      { expr: ["Count", ["IntegerModRing", 12]], expected: 12 },
      {
        expr: ["QuotientRing", "Integers", 12],
        expected: ["IntegerModRing", 12],
        caption: "$\\mathbb{Z}/12\\mathbb{Z}$",
        category: "Scope",
      },
      {
        expr: ["Element", ["IntegerMod", 3, 5], ["IntegerModRing", 5]],
        expected: "True",
        category: "Properties",
      },
    ],
    seeAlso: ["IntegerMod"],
  },
];
