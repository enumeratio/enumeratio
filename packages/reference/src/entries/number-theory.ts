import type { ReferenceEntry } from "../types.ts";

export const numberTheory: readonly ReferenceEntry[] = [
  {
    name: "GCD",
    domain: "Number theory",
    signature: "GCD(a, b, …)",
    summary: "The greatest common divisor of the arguments.",
    signatures: [
      { call: "GCD(a, b, …)", description: "greatest common divisor of two or more integers." },
    ],
    details: [
      "Also called the greatest common factor: the largest positive integer dividing every argument.",
      "Paired with [[LCM]] by $\\gcd(a,b)\\cdot\\operatorname{lcm}(a,b)=ab$.",
      "compute-engine discards signs before computing, so $\\gcd(-a,b)=\\gcd(a,b)$.",
      "$\\gcd(0,n)=n$ since every integer divides 0; with no arguments at all compute-engine returns 0, GCD's identity element.",
      "compute-engine only accepts integers.",
    ],
    examples: [
      { expr: ["GCD", 12, 18], expected: 6 },
      { expr: ["GCD", 24, 36], expected: 12 },
      {
        expr: ["GCD", 20, 30, 45],
        expected: 5,
        caption: "GCD is variadic: it accepts any number of arguments",
      },
      {
        expr: ["GCD", 4],
        expected: 4,
        category: "Possible issues",
        caption: "A single argument is returned unchanged",
      },
      {
        expr: ["GCD"],
        expected: 0,
        category: "Possible issues",
        caption: "With no arguments compute-engine returns 0, the identity element",
      },
      {
        expr: ["GCD", 0, 5],
        expected: 5,
        category: "Possible issues",
        caption: "0 is absorbed: every integer divides it, so $\\gcd(0,n)=n$",
      },
      {
        expr: ["GCD", -12, 9, 57],
        expected: 3,
        category: "Possible issues",
        caption: "Signs are discarded before computing the GCD",
      },
      {
        expr: ["GCD", ["List", 2, 4], ["List", 6, 8]],
        expected: 2,
        category: "Possible issues",
        caption:
          "Lists aren't threaded element-wise; they're flattened into extra arguments, so this equals $\\gcd(2,4,6,8)$",
        divergence: {
          wolfram:
            "Wolfram's GCD is Listable and threads element-wise ({gcd(2,6), gcd(4,8)}); compute-engine flattens the lists into arguments, gcd(2,4,6,8).",
        },
      },
      {
        expr: ["Equal", ["GCD", 12, 18], ["GCD", 18, 12]],
        expected: "True",
        category: "Properties",
        caption: "Commutative: $\\gcd(a,b)=\\gcd(b,a)$",
      },
      {
        expr: ["Equal", ["Multiply", ["GCD", 12, 18], ["LCM", 12, 18]], ["Multiply", 12, 18]],
        expected: "True",
        category: "Properties",
        caption: "$\\gcd(a,b)\\cdot\\mathrm{lcm}(a,b)=ab$. See [[LCM]]",
      },
      {
        expr: ["GCD", ["Rational", 1, 3], ["Rational", 2, 5], ["Rational", 3, 7]],
        expected: ["Rational", 1, 105],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's GCD is integer-only",
      },
      {
        expr: ["GCD", ["Complex", 3, 1], ["Complex", 1, 3]],
        expected: ["Complex", 1, 1],
        category: "Scope",
        caption: "Gaussian integers: the associate in the first quadrant",
      },
    ],
    seeAlso: ["LCM", "ExtendedGCD"],
  },
  {
    name: "LCM",
    domain: "Number theory",
    signature: "LCM(a, b, …)",
    summary: "The least common multiple of the arguments.",
    signatures: [
      { call: "LCM(a, b, …)", description: "least common multiple of two or more integers." },
    ],
    details: [
      "Also called the smallest common multiple: the smallest positive integer that is a multiple of every argument.",
      "Paired with [[GCD]] by $\\gcd(a,b)\\cdot\\operatorname{lcm}(a,b)=ab$.",
      "compute-engine discards signs before computing, so $\\operatorname{lcm}(-a,b)=\\operatorname{lcm}(a,b)$.",
      "$\\operatorname{lcm}(0,n)=0$: 0 absorbs, since 0 is a multiple of everything but nothing else divides back into it.",
      "compute-engine only accepts integers.",
    ],
    examples: [
      { expr: ["LCM", 4, 6], expected: 12 },
      {
        expr: ["LCM", 4, 6, 10],
        expected: 60,
        caption: "LCM is variadic: it accepts any number of arguments",
      },
      {
        expr: ["LCM", 5],
        expected: 5,
        category: "Possible issues",
        caption: "A single argument is returned unchanged",
      },
      {
        expr: ["LCM", 0, 5],
        expected: 0,
        category: "Possible issues",
        caption: "0 absorbs: the LCM with 0 is 0",
      },
      {
        expr: ["LCM", -3, 7],
        expected: 21,
        category: "Possible issues",
        caption: "Signs are discarded before computing the LCM",
      },
      {
        expr: ["Equal", ["Multiply", ["GCD", 27, 81], ["LCM", 27, 81]], ["Multiply", 27, 81]],
        expected: "True",
        category: "Properties",
        caption: "$\\gcd(a,b)\\cdot\\mathrm{lcm}(a,b)=ab$. See [[GCD]]",
      },
      {
        expr: ["LCM", ["Rational", 1, 3], ["Rational", 2, 5], ["Rational", 3, 7]],
        expected: 2,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's LCM is integer-only",
      },
      {
        expr: ["LCM", ["Complex", 3, 1], ["Complex", -1, 3]],
        expected: ["Complex", 3, 1],
        category: "Scope",
        caption: "$-1 + 3i = i(3 + i)$: associates share their multiples",
      },
    ],
    seeAlso: ["GCD"],
  },
  {
    name: "Mod",
    domain: "Number theory",
    signature: "Mod(a, b)",
    summary: "The remainder of a on division by b.",
    signatures: [
      {
        call: "Mod(a, b)",
        description: "remainder of $a$ on division by $b$, with the sign of $b$.",
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
      "compute-engine only supports the 2-argument form.",
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
        expected: 3,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine only supports the 2-argument form",
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
    name: "Quotient",
    domain: "Number theory",
    signature: "Quotient(m, n)",
    summary:
      "The integer quotient of $m$ by $n$ — for Gaussian integers, $m/n$ rounded to the nearest lattice point.",
    signatures: [
      {
        call: "Quotient(m, n)",
        description:
          "$\\lfloor m/n \\rfloor$ for integers; $m/n$ rounded half-even in each part for Gaussian integers",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "For integers, $\\lfloor m/n \\rfloor$, so $m = n\\,\\mathrm{Quotient}(m, n) + \\mathrm{Mod}(m, n)$ with the remainder taking the sign of $n$.",
      "For Gaussian integers the quotient rounds instead, ties to even, which is what makes $\\mathbb{Z}[i]$ Euclidean: the remainder then has smaller norm than $n$.",
      "compute-engine has no Quotient; this follows Wolfram's.",
    ],
    examples: [
      { expr: ["Quotient", 17, 5], expected: 3 },
      { expr: ["Quotient", -7, 2], expected: -4, caption: "the floor, not truncation" },
      {
        expr: ["Quotient", ["Complex", 7, 5], ["Complex", 2, 1]],
        expected: ["Complex", 4, 1],
        category: "Scope",
        caption: "$(7 + 5i)/(2 + i) = 3.8 + 0.6i$, rounded",
      },
      {
        expr: ["Quotient", ["Complex", 5, 5], 2],
        expected: ["Complex", 2, 2],
        category: "Possible issues",
        caption: "$2.5 + 2.5i$ rounds to even in each part",
      },
    ],
    seeAlso: ["Mod", "GCD"],
  },
  {
    name: "PowerMod",
    domain: "Number theory",
    signature: "PowerMod(a, b, m)",
    summary: "Modular exponentiation: a^b mod m, computed without forming a^b directly.",
    signatures: [
      { call: "PowerMod(a, b, m)", description: "modular exponentiation, $a^b \\bmod m$." },
      {
        call: "PowerMod(a, 1/r, m)",
        description:
          "the least $x \\ge 0$ with $x^r \\equiv a \\pmod m$; more generally $s/r$ for $x^r \\equiv a^s$",
        library: "enumeratio-number-theory",
      },
      {
        call: "PowerMod(u/v, b, m)",
        description: "a rational base, read in $\\mathbb{Z}/m$ as $u \\cdot v^{-1}$",
        library: "enumeratio-number-theory",
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
    domain: "Number theory",
    signature: "PowerModList(a, s/r, m)",
    summary:
      "Every $x$ in $[0, m)$ with $x^r \\equiv a^s \\pmod m$ — all the values $a^{s/r}$ can take modulo $m$.",
    signatures: [
      {
        call: "PowerModList(a, s/r, m)",
        description: "every $x$ in $[0, m)$ with $x^r \\equiv a^s \\pmod m$, ascending",
        library: "enumeratio-number-theory",
      },
      {
        call: "PowerModList(a, k, m)",
        description: "an integer exponent gives the single value $\\{a^k \\bmod m\\}$",
        library: "enumeratio-number-theory",
      },
      {
        call: "PowerModList(a, -1, m)",
        description: "the modular inverse $\\{a^{-1}\\}$, or $\\{\\}$ when $\\gcd(a, m) \\ne 1$",
        library: "enumeratio-number-theory",
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
    domain: "Number theory",
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
    name: "Totient",
    domain: "Number theory",
    signature: "Totient(n)",
    summary: "Euler's totient function: the count of integers in 1..n coprime to n.",
    signatures: [
      {
        call: "Totient(n)",
        description: "count of integers in $[1,n]$ coprime to $n$, Euler's $\\varphi(n)$.",
      },
    ],
    details: [
      "Also called Euler's phi function; central to RSA key generation and elementary number theory.",
      "Multiplicative: $\\varphi(mn)=\\varphi(m)\\varphi(n)$ whenever $\\gcd(m,n)=1$.",
      "For $n=p_1^{k_1}\\cdots p_m^{k_m}$, $\\varphi(n)=n\\prod_i\\left(1-\\frac1{p_i}\\right)$.",
      "Divisor sum identity: $\\sum_{d\\mid n}\\varphi(d)=n$.",
      "compute-engine requires a positive integer.",
    ],
    examples: [
      { expr: ["Totient", 12], expected: 4 },
      { expr: ["Totient", 36], expected: 12 },
      { expr: ["Totient", 1], expected: 1 },
      {
        expr: ["Totient", 391],
        expected: 352,
        category: "Applications",
        caption: "RSA key setup: $\\varphi(17\\times23)=16\\times22=352$",
      },
      {
        expr: [
          "Add",
          ["Totient", 1],
          ["Totient", 2],
          ["Totient", 3],
          ["Totient", 4],
          ["Totient", 6],
          ["Totient", 12],
        ],
        expected: 12,
        category: "Properties",
        caption: "$\\sum_{d\\mid n}\\varphi(d)=n$, checked over the divisors of 12",
      },
      {
        expr: ["Equal", ["Totient", 12], ["Multiply", ["Totient", 4], ["Totient", 3]]],
        expected: "True",
        category: "Properties",
        caption:
          "Multiplicative: $\\varphi(mn)=\\varphi(m)\\varphi(n)$ when $\\gcd(m,n)=1$, here for $4$ and $3$",
      },
      {
        expr: ["Totient", 0],
        expected: 0,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine requires a positive integer",
      },
      {
        expr: ["Totient", ["List", 2, 4, 6]],
        expected: ["List", 1, 2, 2],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["MultiplicativeOrder", "DivisorSigma"],
  },
  {
    name: "NextPrime",
    domain: "Number theory",
    signature: "NextPrime(n, k?)",
    summary: "The next prime strictly greater than n, or the kth prime after n.",
    signatures: [
      { call: "NextPrime(n)", description: "smallest prime strictly greater than $n$." },
      {
        call: "NextPrime(n, k)",
        description: "the $k$th prime after $n$; negative $k$ walks backward.",
      },
    ],
    details: [
      "NextPrime(n) is the $(m+1)$th prime, where $m$ is the count of primes $\\le n$.",
      "NextPrime(n, k) generalizes to the $(m+k)$th prime, so a negative $k$ steps backward to a prime below $n$.",
      "n need not be prime or even an integer; compute-engine simply finds the next prime above it.",
      "compute-engine does not.",
    ],
    examples: [
      { expr: ["NextPrime", 10], expected: 11 },
      { expr: ["NextPrime", 100], expected: 101 },
      {
        expr: ["NextPrime", 10, 2],
        expected: 13,
        caption: "The second prime after 10",
      },
      {
        expr: ["NextPrime", 10, -1],
        expected: 7,
        category: "Possible issues",
        caption: "A negative $k$ walks backward, giving the prime immediately before 10",
      },
      {
        expr: ["NextPrime", ["List", 1, 5, 10, 15]],
        expected: ["List", 2, 7, 11, 17],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["NthPrime", "PrimePi"],
  },
  {
    name: "NthPrime",
    domain: "Number theory",
    signature: "NthPrime(n)",
    summary: "The nth prime number (NthPrime(1) = 2).",
    signatures: [
      { call: "NthPrime(n)", description: "the $n$th prime, with $\\mathrm{NthPrime}(1)=2$." },
    ],
    details: [
      "Inverse of [[PrimePi]]: $\\pi(p_n)=n$.",
      "Grows asymptotically like $n\\ln n$, by the prime number theorem.",
      "n must be a positive integer; compute-engine leaves non-positive n, including NthPrime(0), unevaluated.",
      "compute-engine does not.",
    ],
    examples: [
      { expr: ["NthPrime", 1], expected: 2, caption: "The first prime is 2" },
      { expr: ["NthPrime", 10], expected: 29 },
      { expr: ["NthPrime", 100], expected: 541 },
      {
        expr: ["NthPrime", 1000],
        expected: 7919,
        category: "Neat examples",
        caption: "The 1000th prime",
      },
      {
        expr: ["Equal", ["PrimePi", ["NthPrime", 100]], 100],
        expected: "True",
        category: "Properties",
        caption: "[[PrimePi]] and NthPrime are inverses: $\\pi(p_n)=n$",
      },
      {
        expr: ["NthPrime", 0],
        expected: ["NthPrime", 0],
        category: "Possible issues",
        caption: "n must be a positive integer; compute-engine leaves NthPrime(0) unevaluated",
      },
      {
        expr: ["NthPrime", ["List", 1, 3, 4, 10]],
        expected: ["List", 2, 5, 7, 29],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["FactorInteger", "PrimePi"],
  },
  {
    name: "PrimePi",
    domain: "Number theory",
    signature: "PrimePi(n)",
    summary: "The prime-counting function: how many primes are ≤ n.",
    signatures: [{ call: "PrimePi(n)", description: "count of primes $\\le n$." }],
    details: [
      "Inverse of [[NthPrime]]: $\\pi(p_n)=n$.",
      "Asymptotically $\\pi(x)\\sim x/\\ln x$, the prime number theorem.",
      "n need not be an integer or prime itself -- PrimePi(n) counts primes up to whatever real value is given.",
      "compute-engine does not.",
    ],
    examples: [
      { expr: ["PrimePi", 1], expected: 0, caption: "No primes are ≤ 1" },
      { expr: ["PrimePi", 2], expected: 1 },
      { expr: ["PrimePi", 15], expected: 6 },
      { expr: ["PrimePi", 100], expected: 25 },
      {
        expr: ["Equal", ["PrimePi", ["NthPrime", 50]], 50],
        expected: "True",
        category: "Properties",
        caption: "Same inverse relation viewed from PrimePi's side. See [[NthPrime]]",
      },
      {
        expr: ["PrimePi", ["List", 10, 100]],
        expected: ["List", 4, 25],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["NthPrime", "NextPrime"],
  },
  {
    name: "IsPrime",
    domain: "Number theory",
    signature: "IsPrime(n)",
    summary: "Tests whether n is a prime number.",
    signatures: [
      { call: "IsPrime(n)", description: "tests whether $n$ is prime." },
      {
        call: "IsPrime(n, GaussianIntegers -> True)",
        description:
          "tests whether $n$ is prime in $\\mathbb{Z}[i]$; a complex $n$ is always tested there",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "A prime has no positive divisors other than 1 and itself; 1 itself is not prime.",
      'Returns False unless n is provably prime -- there\'s no third "unknown" outcome.',
      "Threads element-wise over a list argument.",
      "compute-engine's IsPrime requires a positive integer and returns False for negatives.",
    ],
    examples: [
      { expr: ["IsPrime", 1], expected: "False", caption: "1 is not prime by definition" },
      { expr: ["IsPrime", 2], expected: "True", caption: "2 is the only even prime" },
      { expr: ["IsPrime", 13], expected: "True" },
      { expr: ["IsPrime", 4], expected: "False" },
      { expr: ["IsPrime", 97], expected: "True" },
      {
        expr: ["IsPrime", ["Add", ["Power", 2, 31], -1]],
        expected: "True",
        category: "Neat examples",
        caption: "The Mersenne prime $2^{31}-1$",
      },
      {
        expr: ["IsPrime", 1000000007],
        expected: "True",
        category: "Applications",
        caption: "A common choice of prime modulus for hashing, just above $10^9$",
      },
      {
        expr: ["IsPrime", ["List", 1, 2, 3, 4, 5, 6]],
        expected: ["List", "False", "True", "True", "False", "True", "False"],
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["IsPrime", -7],
        expected: "True",
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's IsPrime requires a positive integer and returns False",
      },
      {
        expr: ["IsPrime", ["Complex", 2, 1]],
        expected: "True",
        category: "Scope",
        caption: "a Gaussian prime: its norm 5 is prime",
      },
      {
        expr: ["IsPrime", 5, ["KeyValuePair", "GaussianIntegers", "True"]],
        expected: "False",
        category: "Scope",
        caption: "$5 = (2 + i)(2 - i)$ splits in $\\mathbb{Z}[i]$",
      },
      {
        expr: [
          "IsPrime",
          ["List", 2, 3, 5, 7, 11, 13],
          ["KeyValuePair", "GaussianIntegers", "True"],
        ],
        expected: ["List", "False", "True", "False", "True", "True", "False"],
        category: "Properties",
        caption: "an odd prime stays prime in $\\mathbb{Z}[i]$ exactly when $p \\equiv 3 \\pmod 4$",
      },
    ],
    seeAlso: ["FactorInteger", "NextPrime"],
  },
  {
    name: "FactorInteger",
    domain: "Number theory",
    signature: "FactorInteger(n)",
    summary: "The prime factorisation of n as a list of [prime, exponent] pairs.",
    signatures: [
      {
        call: "FactorInteger(n)",
        description: "prime factorization of $n$ as $[\\mathrm{prime}, \\mathrm{exponent}]$ pairs.",
      },
      {
        call: "FactorInteger(n, GaussianIntegers -> True)",
        description:
          "the factorisation in $\\mathbb{Z}[i]$: a unit first when it is not 1, then first-quadrant primes; a complex $n$ is always factored there",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "For $n=p_1^{k_1}\\cdots p_m^{k_m}$, returns the pairs $\\{p_1,k_1\\},\\ldots,\\{p_m,k_m\\}$ in increasing order of prime.",
      "Multiplying the $p^e$ factors back together recovers $n$.",
      "compute-engine represents 1 as $1^1$ and 0 as $0^1$.",
      "Negative $n$ carries an explicit $-1^1$ unit factor ahead of the prime factors.",
      "compute-engine handles ordinary integers only.",
    ],
    examples: [
      {
        expr: ["FactorInteger", 360],
        expected: ["List", ["Tuple", 2, 3], ["Tuple", 3, 2], ["Tuple", 5, 1]],
      },
      {
        expr: ["FactorInteger", 84],
        expected: ["List", ["Tuple", 2, 2], ["Tuple", 3, 1], ["Tuple", 7, 1]],
      },
      {
        expr: ["FactorInteger", 1729],
        expected: ["List", ["Tuple", 7, 1], ["Tuple", 13, 1], ["Tuple", 19, 1]],
        category: "Neat examples",
        caption: "The Hardy-Ramanujan taxicab number, $7\\times13\\times19$. See [[Divisors]]",
      },
      {
        expr: ["Equal", ["Multiply", ["Power", 2, 3], ["Power", 3, 2], 5], 360],
        expected: "True",
        category: "Properties",
        caption:
          "Multiplying the $p^e$ factors back together recovers $n$: $2^3\\cdot3^2\\cdot5=360$",
      },
      {
        expr: ["FactorInteger", 1],
        expected: ["List", ["Tuple", 1, 1]],
        category: "Possible issues",
        caption: "compute-engine returns the trivial factor $1^1$",
      },
      {
        expr: ["FactorInteger", 0],
        expected: ["List", ["Tuple", 0, 1]],
        category: "Possible issues",
        caption: "0 is represented as $0^1$",
      },
      {
        expr: ["FactorInteger", -60],
        expected: ["List", ["Tuple", -1, 1], ["Tuple", 2, 2], ["Tuple", 3, 1], ["Tuple", 5, 1]],
        category: "Possible issues",
        caption: "Negative numbers carry an explicit $-1$ unit factor",
      },
      {
        expr: ["FactorInteger", ["List", 12, 18]],
        expected: [
          "List",
          ["List", ["Tuple", 2, 2], ["Tuple", 3, 1]],
          ["List", ["Tuple", 2, 1], ["Tuple", 3, 2]],
        ],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
      {
        expr: ["FactorInteger", 5, ["KeyValuePair", "GaussianIntegers", "True"]],
        expected: [
          "List",
          ["Tuple", ["Complex", 0, -1], 1],
          ["Tuple", ["Complex", 1, 2], 1],
          ["Tuple", ["Complex", 2, 1], 1],
        ],
        category: "Scope",
        caption: "$5 = -i(1 + 2i)(2 + i)$",
      },
      {
        expr: ["FactorInteger", ["Complex", 3, 4]],
        expected: ["List", ["Tuple", ["Complex", 2, 1], 2]],
        category: "Scope",
        caption: "$3 + 4i = (2 + i)^2$",
      },
      {
        expr: [
          "FactorInteger",
          ["Complex", { num: "100000000000000000039" }, { num: "100000000000000000129" }],
        ],
        expected: [
          "List",
          ["Tuple", ["Complex", 0, -1], 1],
          ["Tuple", ["Complex", 1, 1], 1],
          ["Tuple", ["Complex", 99, 34], 1],
          ["Tuple", ["Complex", 1538, 213], 1],
          ["Tuple", ["Complex", 277789996706096, 549000467740335], 1],
        ],
        category: "Scope",
        caption: "a 21-digit Gaussian integer, through its norm",
      },
    ],
    seeAlso: ["NthPrime", "Divisors", "PrimeNu", "PrimeOmega"],
  },
  {
    name: "PrimeNu",
    domain: "Number theory",
    signature: "PrimeNu(n)",
    summary: "The number of distinct prime factors of n.",
    signatures: [{ call: "PrimeNu(n)", description: "number of distinct prime factors of $n$." }],
    details: [
      "Counts distinct primes only -- $\\nu(2^5)=1$, not 5.",
      "Equal to the length of [[FactorInteger]]$(n)$.",
      "$\\nu(1)=0$: 1 has no prime factors.",
      "Always $\\nu(n)\\le\\Omega(n)$, with equality exactly when $n$ is squarefree. See [[PrimeOmega]].",
    ],
    examples: [
      { expr: ["PrimeNu", 24], expected: 2 },
      { expr: ["PrimeNu", 360], expected: 3 },
      {
        expr: ["PrimeNu", 32],
        expected: 1,
        category: "Possible issues",
        caption: "$32=2^5$ has just one distinct prime factor despite the high power",
      },
      {
        expr: ["PrimeNu", 1],
        expected: 0,
        category: "Possible issues",
        caption: "1 has no prime factors",
      },
      {
        expr: ["Equal", ["PrimeNu", 50], ["Length", ["FactorInteger", 50]]],
        expected: "True",
        category: "Properties",
        caption: "PrimeNu(n) is the length of [[FactorInteger]](n)",
      },
      {
        expr: ["PrimeNu", ["List", 4, 28, 180]],
        expected: ["List", 1, 2, 3],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["PrimeOmega", "FactorInteger"],
  },
  {
    name: "PrimeOmega",
    domain: "Number theory",
    signature: "PrimeOmega(n)",
    summary: "The number of prime factors of n, counted with multiplicity.",
    signatures: [
      {
        call: "PrimeOmega(n)",
        description: "number of prime factors of $n$, counted with multiplicity.",
      },
    ],
    details: [
      "Counts every prime factor with multiplicity -- $\\Omega(2^5)=5$, unlike [[PrimeNu]]'s 1.",
      "Completely additive: $\\Omega(mn)=\\Omega(m)+\\Omega(n)$ for all $m,n$, not just coprime ones.",
      "$\\Omega(1)=0$: 1 has no prime factors.",
      "$\\Omega(n)=\\nu(n)$ exactly when $n$ is squarefree; otherwise $\\Omega(n)>\\nu(n)$.",
    ],
    examples: [
      { expr: ["PrimeOmega", 30], expected: 3 },
      { expr: ["PrimeOmega", 360], expected: 6 },
      {
        expr: ["PrimeOmega", 1],
        expected: 0,
        category: "Possible issues",
        caption: "1 has no prime factors",
      },
      {
        expr: [
          "Equal",
          ["PrimeOmega", ["Multiply", 24, 40]],
          ["Add", ["PrimeOmega", 24], ["PrimeOmega", 40]],
        ],
        expected: "True",
        category: "Properties",
        caption: "Completely additive: $\\Omega(mn)=\\Omega(m)+\\Omega(n)$ for all $m,n$",
      },
      {
        expr: ["GreaterEqual", ["PrimeOmega", 8], ["PrimeNu", 8]],
        expected: "True",
        category: "Properties",
        caption:
          "$\\Omega(n)\\ge\\nu(n)$ always; here $8=2^3$ gives $\\Omega=3$ but $\\nu=1$. See [[PrimeNu]]",
      },
      {
        expr: ["PrimeOmega", ["List", 4, 12, 24]],
        expected: ["List", 2, 3, 4],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["PrimeNu", "FactorInteger"],
  },
  {
    name: "Divisors",
    domain: "Number theory",
    signature: "Divisors(n)",
    summary: "All positive divisors of n, in increasing order.",
    signatures: [
      { call: "Divisors(n)", description: "all positive divisors of $n$, increasing." },
      {
        call: "Divisors(n, GaussianIntegers -> True)",
        description: "the first-quadrant divisors in $\\mathbb{Z}[i]$, by real part then imaginary",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "Includes both 1 and $n$ itself; a prime's only divisors are those two.",
      "The count of divisors, $d(n)$, equals $\\sigma_0(n)$. See [[DivisorSigma]].",
      "Highly composite numbers (like 720) pack unusually many divisors relative to their size.",
      "compute-engine only returns ordinary positive divisors.",
      "compute-engine does not.",
    ],
    examples: [
      {
        expr: ["Divisors", 1729],
        expected: ["List", 1, 7, 13, 19, 91, 133, 247, 1729],
      },
      { expr: ["Divisors", 20], expected: ["List", 1, 2, 4, 5, 10, 20] },
      {
        expr: ["Divisors", 1],
        expected: ["List", 1],
        category: "Possible issues",
        caption: "1 has exactly one divisor: itself",
      },
      {
        expr: ["Divisors", 13],
        expected: ["List", 1, 13],
        caption: "A prime's only divisors are 1 and itself",
      },
      {
        expr: ["Divisors", 720],
        expected: [
          "List",
          1,
          2,
          3,
          4,
          5,
          6,
          8,
          9,
          10,
          12,
          15,
          16,
          18,
          20,
          24,
          30,
          36,
          40,
          45,
          48,
          60,
          72,
          80,
          90,
          120,
          144,
          180,
          240,
          360,
          720,
        ],
        category: "Neat examples",
        caption: "720 is highly composite: 30 divisors, more than any smaller number",
      },
      {
        expr: ["Equal", ["Length", ["Divisors", 20]], ["DivisorSigma", 0, 20]],
        expected: "True",
        category: "Properties",
        caption: "The divisor count $d(n)$ equals $\\sigma_0(n)$. See [[DivisorSigma]]",
      },
      {
        expr: ["Divisors", ["List", 4, 6]],
        expected: ["List", ["List", 1, 2, 4], ["List", 1, 2, 3, 6]],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
      {
        expr: ["Divisors", ["Complex", 3, 4]],
        expected: ["List", 1, ["Complex", 2, 1], ["Complex", 3, 4]],
        category: "Scope",
      },
      {
        expr: ["Divisors", 13, ["KeyValuePair", "GaussianIntegers", "True"]],
        expected: ["List", 1, ["Complex", 2, 3], ["Complex", 3, 2], 13],
        category: "Scope",
        caption: "$13 = (2 + 3i)(3 - 2i)$ splits, so it gains two divisors",
      },
    ],
    seeAlso: ["FactorInteger", "DivisorSigma"],
  },
  {
    name: "DivisorSigma",
    domain: "Number theory",
    signature: "DivisorSigma(k, n)",
    summary: "The sum of the kth powers of the divisors of n.",
    signatures: [
      {
        call: "DivisorSigma(k, n)",
        description: "sum of the $k$th powers of the divisors of $n$.",
      },
    ],
    details: [
      "$k=0$ gives the divisor count $d(n)$; $k=1$ gives the ordinary sum of divisors.",
      "Multiplicative: $\\sigma_k(mn)=\\sigma_k(m)\\sigma_k(n)$ whenever $\\gcd(m,n)=1$.",
      "A perfect number $n$ satisfies $\\sigma_1(n)=2n$, as with 6 and 28.",
      "compute-engine requires a non-negative integer exponent.",
    ],
    examples: [
      {
        expr: ["DivisorSigma", 0, 20],
        expected: 6,
        caption: "k = 0 gives the number of divisors",
      },
      {
        expr: ["DivisorSigma", 1, 20],
        expected: 42,
        caption: "k = 1 gives the sum of divisors",
      },
      { expr: ["DivisorSigma", 2, 20], expected: 546 },
      {
        expr: ["DivisorSigma", 1, 6],
        expected: 12,
        category: "Applications",
        caption: "6 is a perfect number: $\\sigma_1(6)=2\\times6$",
      },
      {
        expr: ["DivisorSigma", 1, 28],
        expected: 56,
        category: "Applications",
        caption: "28 is the next perfect number: $\\sigma_1(28)=2\\times28$",
      },
      {
        expr: [
          "Equal",
          ["Multiply", ["DivisorSigma", 1, 9], ["DivisorSigma", 1, 8]],
          ["DivisorSigma", 1, 72],
        ],
        expected: "True",
        category: "Properties",
        caption:
          "Multiplicative: $\\sigma_1(mn)=\\sigma_1(m)\\sigma_1(n)$ when $\\gcd(m,n)=1$, here for $9$ and $8$",
      },
      {
        expr: ["DivisorSigma", 1, 1],
        expected: 1,
        category: "Possible issues",
        caption: "The trivial base case",
      },
      {
        expr: ["DivisorSigma", -1, 6],
        expected: 2,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine requires a non-negative integer exponent",
      },
    ],
    seeAlso: ["Divisors"],
  },
  {
    name: "MoebiusMu",
    domain: "Number theory",
    signature: "MoebiusMu(n)",
    summary:
      "The Möbius function: 0 if n has a squared prime factor, else (-1)^(number of prime factors).",
    signatures: [{ call: "MoebiusMu(n)", description: "the Möbius function $\\mu(n)$." }],
    details: [
      "$\\mu(n)=0$ if $n$ has a squared prime factor; otherwise $\\mu(n)=(-1)^{\\omega(n)}$ for $\\omega(n)$ distinct prime factors.",
      "$\\mu(1)=1$ by convention, the empty product.",
      "Underlies Möbius inversion: $\\sum_{d\\mid n}\\mu(d)=0$ for every $n>1$.",
      "$n$ is squarefree exactly when $\\mu(n)\\neq0$. See [[IsSquareFree]].",
      "$\\mu$ is only defined on positive integers; compute-engine leaves $n\\le0$ unevaluated.",
    ],
    examples: [
      { expr: ["MoebiusMu", 1], expected: 1 },
      { expr: ["MoebiusMu", 11], expected: -1 },
      {
        expr: ["MoebiusMu", 12],
        expected: 0,
        caption: "12 = 2² · 3 is not squarefree",
      },
      {
        expr: ["MoebiusMu", 10],
        expected: 1,
        caption: "10 = 2·5, a product of an even number of distinct primes",
      },
      {
        expr: [
          "Add",
          ["MoebiusMu", 1],
          ["MoebiusMu", 2],
          ["MoebiusMu", 3],
          ["MoebiusMu", 4],
          ["MoebiusMu", 6],
          ["MoebiusMu", 12],
        ],
        expected: 0,
        category: "Properties",
        caption: "$\\sum_{d\\mid n}\\mu(d)=0$ for $n>1$, the identity behind Möbius inversion",
      },
      {
        expr: ["MoebiusMu", 0],
        expected: ["MoebiusMu", 0],
        category: "Possible issues",
        caption:
          "$\\mu$ is only defined for positive integers; compute-engine leaves $n=0$ unevaluated",
        divergence: { wolfram: "μ(0) is left unevaluated here; Wolfram defines it as 0." },
      },
      {
        expr: ["MoebiusMu", ["List", 1, 2, 3, 4]],
        expected: ["List", 1, -1, -1, 0],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["FactorInteger", "IsSquareFree"],
  },
  {
    name: "IsSquareFree",
    domain: "Number theory",
    signature: "IsSquareFree(n)",
    summary: "Tests whether n has no repeated prime factors.",
    signatures: [
      { call: "IsSquareFree(n)", description: "tests whether $n$ has no repeated prime factor." },
    ],
    details: [
      "An integer is squarefree if it is divisible by no perfect square other than 1.",
      "Every prime is squarefree; 1 is vacuously squarefree.",
      "Equivalent to $\\mu(n)\\neq0$. See [[MoebiusMu]].",
      "Returns False unless $n$ is provably squarefree.",
    ],
    examples: [
      { expr: ["IsSquareFree", 10], expected: "True" },
      { expr: ["IsSquareFree", 4], expected: "False" },
      { expr: ["IsSquareFree", 12], expected: "False" },
      {
        expr: ["IsSquareFree", 17],
        expected: "True",
        caption: "Every prime is squarefree",
      },
      {
        expr: ["IsSquareFree", 1],
        expected: "True",
        category: "Possible issues",
        caption: "1 is vacuously squarefree: it has no repeated prime factors",
      },
      {
        expr: ["Equal", ["IsSquareFree", 10], ["Not", ["Equal", ["MoebiusMu", 10], 0]]],
        expected: "True",
        category: "Properties",
        caption: "$n$ is squarefree exactly when $\\mu(n)\\neq0$. See [[MoebiusMu]]",
      },
      {
        expr: ["IsSquareFree", ["List", 10, 4, 12]],
        expected: ["List", "True", "False", "False"],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["MoebiusMu", "FactorInteger"],
  },
  {
    name: "JacobiSymbol",
    domain: "Number theory",
    signature: "JacobiSymbol(n, m)",
    summary: "The Jacobi symbol (n/m), generalising the Legendre symbol to composite m.",
    signatures: [
      {
        call: "JacobiSymbol(n, m)",
        description: "the Jacobi symbol $\\left(\\frac{n}{m}\\right)$.",
      },
    ],
    details: [
      "Generalizes the Legendre symbol from prime $m$ to any odd $m$, by multiplying the Legendre symbols of $m$'s prime factors.",
      "0 whenever $n$ and $m$ share a factor.",
      "Completely multiplicative in the top argument: $\\left(\\frac{a}{m}\\right)\\left(\\frac{b}{m}\\right)=\\left(\\frac{ab}{m}\\right)$.",
      "By convention $\\left(\\frac{n}{1}\\right)=1$ for every $n$.",
      "Unlike the Legendre symbol, $\\left(\\frac{n}{m}\\right)=1$ doesn't imply $n$ is a quadratic residue mod $m$ when $m$ is composite.",
    ],
    examples: [
      {
        expr: ["JacobiSymbol", 10, 5],
        expected: 0,
        caption: "0 whenever n and m share a factor",
      },
      {
        expr: ["JacobiSymbol", 3, 5],
        expected: -1,
        caption: "3 is not a quadratic residue mod 5 (the residues are 1 and 4)",
      },
      { expr: ["JacobiSymbol", 1001, 9907], expected: -1 },
      {
        expr: ["JacobiSymbol", 0, 1],
        expected: 1,
        category: "Possible issues",
        caption: "By convention the symbol is 1 whenever $m=1$",
      },
      {
        expr: [
          "Equal",
          ["Multiply", ["JacobiSymbol", 3, 7], ["JacobiSymbol", 5, 7]],
          ["JacobiSymbol", ["Multiply", 3, 5], 7],
        ],
        expected: "True",
        category: "Properties",
        caption: "Completely multiplicative in the top argument: $(a/m)(b/m)=(ab/m)$",
      },
      {
        expr: ["JacobiSymbol", ["List", 2, 3, 5, 7, 11], 3],
        expected: ["List", -1, 0, -1, 1, -1],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["PowerMod", "LegendreSymbol", "KroneckerSymbol"],
  },
  {
    name: "LegendreSymbol",
    domain: "Number theory",
    signature: "LegendreSymbol(n, p)",
    summary: "The Legendre symbol (n/p): whether n is a quadratic residue mod the odd prime p.",
    signatures: [
      {
        call: "LegendreSymbol(n, p)",
        description: "the Legendre symbol $\\left(\\frac{n}{p}\\right)$.",
      },
    ],
    details: [
      "1 if $n$ is a nonzero quadratic residue mod $p$, $-1$ if it is a nonresidue, 0 if $p\\mid n$.",
      "Defined only for an odd prime $p$; compute-engine leaves the call symbolic for any other $p$.",
      "The prime case of [[JacobiSymbol]] and [[KroneckerSymbol]] — all three agree wherever the domains overlap.",
    ],
    examples: [
      {
        expr: ["LegendreSymbol", 2, 7],
        expected: 1,
        caption: "2 is a quadratic residue mod 7: 3² ≡ 2 (mod 7)",
      },
      {
        expr: ["LegendreSymbol", 3, 7],
        expected: -1,
        caption: "3 is not a quadratic residue mod 7",
      },
      { expr: ["LegendreSymbol", 14, 7], expected: 0, caption: "0 when p divides n" },
    ],
    seeAlso: ["JacobiSymbol", "KroneckerSymbol"],
  },
  {
    name: "KroneckerSymbol",
    domain: "Number theory",
    signature: "KroneckerSymbol(a, n)",
    summary: "The Kronecker symbol (a/n): the Jacobi symbol extended to every integer n.",
    signatures: [
      {
        call: "KroneckerSymbol(a, n)",
        description: "the Kronecker symbol $\\left(\\frac{a}{n}\\right)$.",
        library: "enumeratio-modular",
      },
    ],
    details: [
      "Agrees with [[JacobiSymbol]] wherever $n$ is odd and positive, and with [[LegendreSymbol]] where $n$ is also prime — this is the head above both.",
      "$\\left(\\frac{a}{0}\\right)=1$ if $a=\\pm1$, else 0; $\\left(\\frac{a}{-1}\\right)=1$ if $a\\ge0$, $-1$ if $a<0$.",
      "$\\left(\\frac{a}{2}\\right)=0$ for even $a$; $1$ if $a\\equiv\\pm1\\pmod 8$; $-1$ if $a\\equiv\\pm3\\pmod 8$ — this is the piece Jacobi's odd-$n$ restriction leaves out.",
      "Completely multiplicative in $n$: $\\left(\\frac{a}{n_1n_2}\\right)=\\left(\\frac{a}{n_1}\\right)\\left(\\frac{a}{n_2}\\right)$.",
      "Bignum-safe: both arguments may exceed the double-precision range.",
    ],
    examples: [
      { expr: ["KroneckerSymbol", 17, 6], expected: -1 },
      { expr: ["KroneckerSymbol", 10, 13], expected: 1 },
      { expr: ["KroneckerSymbol", 5, 0], expected: 0, caption: "0 whenever |a| ≠ 1 and n = 0" },
      {
        expr: ["KroneckerSymbol", -3, -1],
        expected: -1,
        caption: "(a/-1) is the sign of a — here a < 0",
      },
      {
        expr: ["KroneckerSymbol", 3, 2],
        expected: -1,
        caption: "(a/2): odd a, and 3 mod 8 = 3, one of the two residues giving -1",
      },
      {
        expr: [
          "Equal",
          ["KroneckerSymbol", 7, ["Multiply", 3, 5]],
          ["Multiply", ["KroneckerSymbol", 7, 3], ["KroneckerSymbol", 7, 5]],
        ],
        expected: "True",
        category: "Properties",
        caption: "Completely multiplicative in n",
      },
      {
        expr: ["KroneckerSymbol", ["List", 2, 3, 5, 7, 11], 6],
        expected: ["List", 0, 0, 1, 1, 1],
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine does not thread over a list — Wolfram's KroneckerSymbol is Listable in a",
      },
    ],
    seeAlso: ["JacobiSymbol", "LegendreSymbol"],
  },
  {
    name: "ChineseRemainder",
    domain: "Number theory",
    signature: "ChineseRemainder([r1, r2, …], [m1, m2, …])",
    summary: "The smallest non-negative integer congruent to each ri modulo the corresponding mi.",
    signatures: [
      {
        call: "ChineseRemainder([r1, r2, …], [m1, m2, …])",
        description: "smallest non-negative $x$ with $x\\equiv r_i\\pmod{m_i}$ for every $i$.",
      },
    ],
    details: [
      "When the moduli are pairwise coprime, the result is unique modulo $m_1m_2\\cdots m_n$ by the Chinese remainder theorem.",
      "A solution exists for non-coprime moduli only when the remainders agree on every shared factor; otherwise the system is inconsistent.",
      "compute-engine leaves inconsistent systems unevaluated rather than raising an error.",
      "compute-engine only supports the 2-argument form.",
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
        expr: ["ChineseRemainder", ["List", 1, 2], ["List", 6, 10]],
        expected: ["ChineseRemainder", ["List", 1, 2], ["List", 6, 10]],
        category: "Possible issues",
        caption:
          "No solution exists when the remainders are inconsistent at $\\gcd(6,10)=2$; compute-engine leaves it unevaluated",
      },
      {
        expr: ["ChineseRemainder", ["List", 1, 2], ["List", 3, 5], 100],
        expected: 112,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine only supports the 2-argument form",
      },
    ],
    seeAlso: ["Mod"],
  },
  {
    name: "ExtendedGCD",
    domain: "Number theory",
    signature: "ExtendedGCD(a, b)",
    summary:
      "The GCD of a and b together with Bézout coefficients x, y such that a·x + b·y = GCD(a, b).",
    signatures: [
      {
        call: "ExtendedGCD(a, b)",
        description:
          "$\\gcd(a,b)$ together with Bézout coefficients $x,y$ satisfying $ax+by=\\gcd(a,b)$.",
      },
    ],
    details: [
      "Implements the extended Euclidean algorithm, the standard way to compute modular inverses. See [[PowerMod]].",
      "The coefficients $x,y$ are not unique; the algorithm returns one particular solution pair.",
      "When $a=0$, the coefficients reduce to $x=0,\\,y=1$.",
      "compute-engine only accepts two.",
    ],
    examples: [
      {
        expr: ["ExtendedGCD", 2, 3],
        expected: ["Tuple", 1, -1, 1],
        divergence: {
          wolfram: "Same values: ours is the flat Tuple (g, a, b), Wolfram's is {g, {a, b}}.",
        },
      },
      {
        expr: ["ExtendedGCD", 12, 18],
        expected: ["Tuple", 6, -1, 1],
        divergence: {
          wolfram: "Same values: ours is the flat Tuple (g, a, b), Wolfram's is {g, {a, b}}.",
        },
      },
      {
        expr: ["ExtendedGCD", 3, 11],
        expected: ["Tuple", 1, 4, -1],
        category: "Applications",
        caption: "The modular inverse of 3 mod 11 is 4, since $3\\times4\\equiv1\\pmod{11}$",
        divergence: {
          wolfram: "Same values: ours is the flat Tuple (g, a, b), Wolfram's is {g, {a, b}}.",
        },
      },
      {
        expr: ["ExtendedGCD", 0, 5],
        expected: ["Tuple", 5, 0, 1],
        category: "Possible issues",
        caption: "Bézout coefficients when $a=0$: $0\\times0+5\\times1=5$",
        divergence: {
          wolfram: "Same values: ours is the flat Tuple (g, a, b), Wolfram's is {g, {a, b}}.",
        },
      },
      {
        expr: ["Add", ["Multiply", 2, -1], ["Multiply", 3, 1]],
        expected: 1,
        category: "Properties",
        caption: "Confirms the coefficients above satisfy $2x+3y=\\gcd(2,3)$ with $x=-1,\\,y=1$",
      },
      {
        expr: ["ExtendedGCD", 6, 15, 30],
        expected: ["Tuple", 3, 1, -1, 1],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine only accepts two arguments",
      },
      {
        expr: ["ExtendedGCD", ["Complex", 7, 2], ["Complex", 3, -5]],
        expected: ["Tuple", 1, ["Complex", -1, -2], ["Complex", -2, 2]],
        category: "Scope",
        caption: "Gaussian integers, by Euclid with the rounded quotient",
        divergence: {
          wolfram:
            "Bézout coefficients are not unique; in about one case in a thousand Wolfram returns another valid pair.",
        },
      },
    ],
    seeAlso: ["GCD"],
  },
  {
    name: "MultiplicativeOrder",
    domain: "Number theory",
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
        library: "enumeratio-number-theory",
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
    domain: "Number theory",
    signature: "PrimitiveRootList(n)",
    summary:
      "Every primitive root of $n$ — every generator of $(\\mathbb{Z}/n)^\\times$ — ascending.",
    signatures: [
      {
        call: "PrimitiveRootList(n)",
        description: "the generators of the unit group mod $n$, or $\\{\\}$ when it is not cyclic",
        library: "enumeratio-number-theory",
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
        expected: ["Length", ["PrimitiveRootList", 1000003]],
        caption: "past 100 000 roots the list is not built",
        category: "Possible issues",
      },
    ],
    seeAlso: ["PrimitiveRoot", "MultiplicativeOrder", "PowerModList"],
  },
  {
    name: "RationalReconstruction",
    domain: "Number theory",
    signature: "RationalReconstruction(a, m)",
    summary:
      "The small fraction $n/d$ whose image in $\\mathbb{Z}/m$ is $a$ — the inverse of reading $n/d$ as $n \\cdot d^{-1} \\bmod m$.",
    signatures: [
      {
        call: "RationalReconstruction(a, m)",
        description:
          "the $n/d$ with $n \\equiv a d \\pmod m$ and $|n|, d \\le \\sqrt{(m-1)/2}$, when there is one",
        library: "enumeratio-number-theory",
      },
      {
        call: "RationalReconstruction(a, m, N, D)",
        description: "with explicit bounds $|n| \\le N$, $0 < d \\le D$",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "Every residue is the image of infinitely many fractions, but at most one with $2ND < m$ — so under the default balanced bounds the answer, when it exists, is unique.",
      "Wang's algorithm: the extended Euclidean algorithm on $(m, a)$, stopped at the first remainder $\\le N$; the remainder and its cofactor are $n$ and $d$.",
      "Not a Wolfram built-in; the name follows SageMath's `rational_reconstruction` (Maple: `iratrecon`).",
      "Unevaluated when no fraction within the bounds maps to $a$. Threads over lists.",
    ],
    examples: [
      {
        expr: ["RationalReconstruction", 6, 11],
        expected: ["Rational", 1, 2],
        caption: "$2 \\cdot 6 = 12 \\equiv 1 \\pmod{11}$",
      },
      {
        expr: ["RationalReconstruction", ["PowerMod", ["Rational", 22, 7], 1, 1000003], 1000003],
        expected: ["Rational", 22, 7],
        caption: "a round trip through $\\mathbb{Z}/1000003$",
      },
      {
        expr: ["RationalReconstruction", 5, 11, 5, 1],
        expected: 5,
        caption: "explicit bounds: denominators of 1 only",
        category: "Scope",
      },
      {
        expr: ["RationalReconstruction", ["List", 6, 9, 10], 11],
        expected: ["List", ["Rational", 1, 2], -2, -1],
        category: "Scope",
      },
      {
        expr: [
          "RationalReconstruction",
          ["PowerMod", ["Rational", 55835135, 15519504], 1, ["Subtract", ["Power", 2, 61], 1]],
          ["Subtract", ["Power", 2, 61], 1],
        ],
        expected: ["Rational", 55835135, 15519504],
        caption: "the harmonic number $H_{20}$, back from its image mod $2^{61} - 1$",
        category: "Scope",
      },
      {
        expr: [
          "RationalReconstruction",
          ["PowerMod", ["Rational", 55835135, 15519504], 1, 1000000007],
          1000000007,
        ],
        expected: ["RationalReconstruction", 301316272, 1000000007],
        caption:
          "one word-size prime is not enough for $H_{20}$: $2ND < m$ needs $m$ past $1.7 \\cdot 10^{15}$",
        category: "Applications",
      },
      {
        expr: [
          "RationalReconstruction",
          [
            "ChineseRemainder",
            [
              "List",
              ["PowerMod", ["Rational", 55835135, 15519504], 1, 1000000007],
              ["PowerMod", ["Rational", 55835135, 15519504], 1, 1000000009],
            ],
            ["List", 1000000007, 1000000009],
          ],
          ["Multiply", 1000000007, 1000000009],
        ],
        expected: ["Rational", 55835135, 15519504],
        caption:
          "multi-modular arithmetic: glue two images with [[ChineseRemainder]], and the product modulus is large enough",
        category: "Applications",
      },
      {
        expr: ["RationalReconstruction", 3, 11],
        expected: ["RationalReconstruction", 3, 11],
        caption: "mod 11 the bounds are $|n|, d \\le 2$, and no such fraction is $\\equiv 3$",
        category: "Possible issues",
      },
    ],
    seeAlso: ["PowerModList", "ChineseRemainder", "Rationalize", "ContinuedFraction"],
  },
  {
    name: "IntegerDigits",
    domain: "Number theory",
    signature: "IntegerDigits(n, base?)",
    summary: "The digits of n in the given base (default 10), most significant first.",
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
    ],
    details: [
      "Digits come out most significant first, matching ordinary positional notation.",
      "The sign of n is discarded, so negative integers give the same digits as their absolute value.",
      "IntegerDigits(0) is $\\{0\\}$ -- there's always at least one digit.",
      "The 3-argument form keeps only the len least-significant digits, truncating or zero-padding as needed.",
      "Inverted by [[FromDigits]].",
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
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["DigitCount", "FromDigits", "IntegerString"],
  },
  {
    name: "FromDigits",
    domain: "Number theory",
    signature: "FromDigits([d1, d2, …], base?)",
    summary: "The integer formed by a list of digits in the given base (default 10).",
    signatures: [
      {
        call: "FromDigits([d1, d2, …])",
        description: "integer formed from a digit list in base 10.",
      },
      {
        call: "FromDigits([d1, d2, …], base)",
        description: "integer formed from a digit list in the given base.",
      },
    ],
    details: [
      "Effectively the inverse of [[IntegerDigits]]: $\\mathrm{FromDigits}(\\mathrm{IntegerDigits}(n))=n$ for $n\\ge0$.",
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
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's FromDigits only takes a list of digits",
      },
    ],
    seeAlso: ["IntegerDigits"],
  },
  {
    name: "IntegerString",
    domain: "Number theory",
    signature: "IntegerString(n, base?)",
    summary: "The string representation of n in the given base (default 10).",
    signatures: [
      { call: "IntegerString(n)", description: "string form of $n$ in base 10." },
      {
        call: "IntegerString(n, base)",
        description: "string form of $n$ in the given base, up to base 36.",
      },
    ],
    details: [
      "Bases above 10 use letters a-z for digit values beyond 9, up to base 36.",
      "compute-engine keeps a leading minus sign for negative n",
      "compute-engine only supports the 2-argument form.",
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
        aspirational: true,
        category: "Scope",
        caption: "compute-engine only supports the 2-argument form",
      },
    ],
    seeAlso: ["IntegerDigits"],
  },
  {
    name: "DigitCount",
    domain: "Number theory",
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
        aspirational: true,
        category: "Scope",
        caption: "compute-engine does not",
      },
    ],
    seeAlso: ["IntegerDigits", "DigitSum"],
  },
  {
    name: "DigitSum",
    domain: "Number theory",
    signature: "DigitSum(n, base?)",
    summary: "The sum of the digits of n in the given base (default 10).",
    signatures: [
      { call: "DigitSum(n)", description: "sum of the digits of $n$, base 10." },
      { call: "DigitSum(n, base)", description: "sum of the digits of $n$ in the given base." },
    ],
    details: [
      "Equivalent to summing [[IntegerDigits]](n, base).",
      "In base 2, the digit sum is the number of set bits (population count).",
      "$n\\equiv\\mathrm{DigitSum}(n)\\pmod9$ in base 10 -- the basis of the classic divisibility-by-9 check and digital root.",
      "The sign of n is discarded before summing.",
      "compute-engine only supports the 2-argument form.",
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
        expected: 18,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine only supports the 2-argument form",
      },
    ],
    seeAlso: ["DigitCount"],
  },
  {
    name: "IntegerExponent",
    domain: "Number theory",
    signature: "IntegerExponent(n, b?)",
    summary: "The largest $k$ with $b^k \\mid n$ — the $b$-adic valuation of $n$ as an integer.",
    signatures: [
      {
        call: "IntegerExponent(n, b)",
        description: "the multiplicity of $b$ in $n$",
        library: "enumeratio-number-theory",
      },
      {
        call: "IntegerExponent(n)",
        description: "base 10",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "Integers only: a rational's $p$-adic valuation is [[AdicValuation]]'s, over [[AdicNumeral]].",
      "$n = 0$ has every power of $b$ as a divisor, so `IntegerExponent(0, b)` is `PositiveInfinity`.",
      "$b$ need not be prime — `IntegerExponent(n, 6)` is the largest $k$ with $6^k \\mid n$, not the 2-adic or 3-adic valuation.",
    ],
    examples: [
      { expr: ["IntegerExponent", 2000, 5], expected: 3, caption: "$2000 = 5^3 \\cdot 16$" },
      { expr: ["IntegerExponent", 2000], expected: 3, caption: "base 10 by default" },
      {
        expr: ["IntegerExponent", 0, 5],
        expected: "PositiveInfinity",
        category: "Possible issues",
      },
    ],
    seeAlso: ["AdicValuation", "FactorInteger"],
  },
  {
    name: "HermiteDecomposition",
    domain: "Number theory",
    signature: "HermiteDecomposition(m)",
    summary:
      "$\\{u, h\\}$ with $u$ unimodular and $u \\cdot m = h$ upper triangular in Hermite normal form.",
    signatures: [
      {
        call: "HermiteDecomposition(m)",
        description: "a unimodular $u$ and $h = u \\cdot m$ in Hermite normal form",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "$h$ is upper triangular with positive pivots, and every entry above a pivot is reduced into $[0, \\text{pivot})$ — the row-reduced convention that makes $h$ unique for a given $m$.",
      "$u \\in GL_n(\\mathbb{Z})$: $\\det u = \\pm 1$, so $u$ is invertible over $\\mathbb{Z}$, not merely over $\\mathbb{Q}$.",
      "Used by [[ProfiniteDecomposition]] to put a matrix over $\\hat{\\mathbb{Q}}$ into strong-approximation form (Hertogh's Algorithm 8.4).",
    ],
    examples: [
      {
        expr: ["HermiteDecomposition", ["List", ["List", 0, -3], ["List", 2, 0]]],
        expected: [
          "List",
          ["List", ["List", 0, 1], ["List", -1, 0]],
          ["List", ["List", 2, 0], ["List", 0, 3]],
        ],
      },
    ],
    seeAlso: ["ProfiniteDecomposition", "ExtendedGCD"],
  },
];
