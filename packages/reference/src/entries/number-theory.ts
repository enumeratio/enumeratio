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
      "Extends to rationals: $\\gcd(p_1/q_1, \\dots) = \\gcd(p_1, \\dots)/\\operatorname{lcm}(q_1, \\dots)$.",
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
        category: "Scope",
        caption: "Over the rationals: the gcd of the numerators over the lcm of the denominators",
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
      "Extends to rationals: $\\operatorname{lcm}(p_1/q_1, \\dots) = \\operatorname{lcm}(p_1, \\dots)/\\gcd(q_1, \\dots)$.",
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
        expected: 6,
        category: "Scope",
        caption:
          "Over the rationals: the lcm of the numerators over the gcd of the denominators — the smallest positive rational that is an integer multiple of each",
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
      "$\\varphi(0) = 0$, as in Wolfram; a list argument is threaded over element-wise.",
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
        category: "Scope",
        caption: "$\\varphi(0) = 0$, as in Wolfram",
      },
      {
        expr: ["Totient", ["List", 2, 4, 6]],
        expected: ["List", 1, 2, 2],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
      "Threads element-wise over a list, as Wolfram's Listable heads do.",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
      "Threads element-wise over a list, as Wolfram's Listable heads do.",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
      "Threads element-wise over a list, as Wolfram's Listable heads do.",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
        expected: "False",
        category: "Possible issues",
        caption: "Primes are positive here: a negative integer is never prime",
        divergence: {
          wolfram: "Wolfram's PrimeQ counts the associates of primes, so PrimeQ[-7] is True.",
        },
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
      "Threads element-wise over a list, as Wolfram's Listable heads do.",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
      "A negative order sums reciprocal powers: $\\sigma_{-k}(n) = \\sigma_k(n)/n^k$.",
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
        category: "Scope",
        caption:
          "A negative order sums reciprocal powers: $\\sigma_{-1}(6) = 1 + \\frac12 + \\frac13 + \\frac16 = 2$",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
    ],
    seeAlso: ["JacobiSymbol", "LegendreSymbol"],
  },
  {
    name: "ExtendedGCD",
    domain: "Number theory",
    signature: "ExtendedGCD(a, b, \u2026)",
    summary:
      "The GCD of a and b together with Bézout coefficients x, y such that a·x + b·y = GCD(a, b).",
    signatures: [
      {
        call: "ExtendedGCD(a, b)",
        description:
          "$\\gcd(a,b)$ together with Bézout coefficients $x,y$ satisfying $ax+by=\\gcd(a,b)$.",
      },
      {
        call: "ExtendedGCD(a1, a2, \u2026, ak)",
        description: "$(g, c_1, \\dots, c_k)$ with $\\sum c_i a_i = g$, folded pairwise.",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "Implements the extended Euclidean algorithm, the standard way to compute modular inverses. See [[PowerMod]].",
      "The coefficients $x,y$ are not unique; the algorithm returns one particular solution pair.",
      "When $a=0$, the coefficients reduce to $x=0,\\,y=1$.",
      "More than two integers fold pairwise, so the coefficients satisfy $\\sum c_i a_i = g$.",
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
        expected: ["Tuple", 3, -2, 1, 0],
        category: "Scope",
        caption:
          "More than two integers fold pairwise: $6 \\cdot (-2) + 15 \\cdot 1 + 30 \\cdot 0 = 3$",
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
