import { DEFINITIONS } from "@enumeratio/analytic/definitions";
import type { ReferenceEntry } from "../types.ts";

// The special functions `@enumeratio/analytic` adds beyond the zeta family: the Barnes
// G-function and its logarithm, the log-gamma continuation, the Clausen functions, the
// Dirichlet eta and beta functions, the Stieltjes constants, and the Dirichlet characters
// with their L-functions. Every `expected` was
// produced by evaluating `expr` with compute-engine 0.128.0 plus `declareAnalytic`; the
// reference tests re-evaluate and pin it. Numeric values are validated against mpmath and
// a Wolfram kernel in `packages/analytic/tests/special-functions.golden.json`.
//
// As with the zeta entries: plain evaluation reduces only where an exact closed form
// exists; everything else stays symbolic until N() or a floating-point argument.

const LIBRARY = "@enumeratio/analytic";

export const analyticSpecial: readonly ReferenceEntry[] = [
  {
    name: "BarnesG",
    domain: "Special functions",
    signature: "BarnesG(z)",
    summary:
      "The Barnes G-function $G(z)$, the double-gamma function satisfying $G(z+1) = \\Gamma(z)\\,G(z)$ with $G(1) = 1$ — so $G(n) = \\prod_{k=0}^{n-2} k!$, the superfactorial, at positive integers. Provided by `@enumeratio/analytic`.",
    signatures: [
      { call: "BarnesG(z)", description: "the Barnes G-function $G(z)$.", library: LIBRARY },
    ],
    details: [
      "Functional equation $G(z+1) = \\Gamma(z)\\,G(z)$, the analogue of $\\Gamma(z+1) = z\\,\\Gamma(z)$ one level up; see [[Gamma]].",
      "At positive integers $G(n) = 0!\\,1!\\,2!\\cdots(n-2)!$ — the superfactorial: $G(1) = G(2) = G(3) = 1$, $G(4) = 2$, $G(5) = 12$, $G(6) = 288$, $G(7) = 34560$. Exact and arbitrarily large.",
      "Zeros at the nonpositive integers $0, -1, -2, \\dots$ (where $\\Gamma$ has poles); entire, with no poles of its own.",
      "Numeric evaluation exponentiates [[LogBarnesG]]: the asymptotic series for $\\ln G(z+1)$ for large $\\operatorname{Re}(z)$, reached through the functional equation in logarithms. Complex $z$ supported; aligned with Wolfram's $\\mathrm{BarnesG}[z]$.",
      "The value itself overflows a double past $|z| \\approx 60$ (G(60) $\\approx 4.6\\times10^{1971}$); use [[LogBarnesG]] there, or stay exact at integers.",
    ],
    examples: [
      { expr: ["BarnesG", 5], expected: 12, caption: "$G(5) = 0!\\,1!\\,2!\\,3! = 12$" },
      { expr: ["BarnesG", 7], expected: 34560, caption: "$G(7) = 34560$" },
      {
        expr: ["BarnesG", ["List", 1, 2, 3, 4, 5, 6]],
        expected: ["List", 1, 1, 1, 2, 12, 288],
        caption: "The superfactorials, threaded over a list",
      },
      {
        expr: ["BarnesG", 0],
        expected: 0,
        category: "Properties",
        caption: "$G$ vanishes at the nonpositive integers",
      },
      {
        expr: ["BarnesG", -3],
        expected: 0,
        category: "Properties",
        caption: "…all of them",
      },
      {
        expr: ["BarnesG", 2.5],
        expected: 0.9475739010840627,
        caption: "A floating-point argument evaluates numerically",
      },
      {
        expr: ["BarnesG", ["Rational", 5, 2]],
        expected: ["BarnesG", ["Rational", 5, 2]],
        category: "Possible issues",
        caption:
          "An exact non-integer argument stays symbolic under plain evaluation (use N(); Wolfram's closed form in Glaisher's constant is not reproduced)",
        divergence: {
          wolfram:
            "An exact non-integer argument stays symbolic here; Wolfram continues to a closed form in Glaisher's constant.",
        },
      },
      {
        expr: ["BarnesG", 10],
        expected: 5056584744960000,
        caption: "$G(10) = \\prod_{k=0}^{8} k!$, exact",
      },
      { expr: ["BarnesG", 3], expected: 1, caption: "$G(3) = 0!\\,1! = 1$" },
      {
        expr: ["BarnesG", 0.5],
        expected: 0.6032442812095893,
        caption: "$G(\\tfrac12)$ to machine precision",
      },
      {
        expr: ["BarnesG", ["Complex", 1.3, 1]],
        expected: ["Complex", 1.4446139350503153, -0.2985488252115687],
        category: "Scope",
        caption: "Complex arguments",
      },
      {
        expr: ["BarnesG", -2.5],
        expected: 0.07617297965688405,
        category: "Scope",
        caption: "Negative non-integer arguments, between the zeros",
      },
      {
        expr: [
          "BarnesG",
          ["List", ["List", ["Rational", 1, 2], 1], ["List", 1, ["Rational", 1, 2]]],
        ],
        expected: [
          "List",
          ["List", ["BarnesG", ["Rational", 1, 2]], 1],
          ["List", 1, ["BarnesG", ["Rational", 1, 2]]],
        ],
        category: "Scope",
        caption: "Threads elementwise over an array",
        divergence: {
          wolfram:
            "Wolfram also threads, but writes $G(\\tfrac12)$ as its closed form $2^{1/24} e^{1/8} \\pi^{-1/4} A^{-3/2}$ in Glaisher's constant.",
        },
      },
      {
        expr: ["BarnesG", "PositiveInfinity"],
        expected: "PositiveInfinity",
        category: "Scope",
        caption: "$G(\\infty) = \\infty$ — the limit at infinity is not taken yet",
        aspirational: true,
      },
      {
        expr: ["BarnesG", ["Interval", 1.17, 1.18]],
        expected: ["Interval", 1.0522163286861943, 1.054193606435691],
        category: "Scope",
        caption:
          "Interval arithmetic: $G$ is increasing on $[1.17, 1.18]$, so the image is the interval of the endpoint values; not yet",
        aspirational: true,
      },
      {
        expr: ["BarnesG", ["Around", 2.1, 0.01]],
        expected: ["Around", 0.9847727243540465, 0.001449505695943639],
        category: "Scope",
        caption:
          "Uncertainty propagation: $G(2.1 \\pm 0.01) = 0.98477 \\pm 0.00145$, to first order in $G'$; not yet",
        aspirational: true,
      },
      {
        expr: ["Divide", ["Power", ["Gamma", 6], 5], ["BarnesG", 6]],
        expected: 86400000,
        category: "Properties",
        caption: "The hyperfactorial $H(n) = \\Gamma(n+1)^n / G(n+1)$: here $120^5/288 = H(5)$",
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.BarnesG,
        note: "G = exp(ln G) over the Weierstrass series of [[LogBarnesG]]; see there for what it costs to evaluate.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/barnes-g.ts",
        note: "exp of the LogBarnesG kernel; exact superfactorials at the integers come from the head.",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "BarnesG[z] and mpmath.barnesg(z), same normalisation.",
      },
    ],
    seeAlso: ["LogBarnesG", "Gamma", "LogGamma", "Factorial"],
  },
  {
    name: "LogBarnesG",
    domain: "Special functions",
    signature: "LogBarnesG(z)",
    summary:
      "The logarithm of the Barnes G-function, $\\ln G(z)$, as an analytic continuation — the form that stays finite where $G$ itself overflows. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "LogBarnesG(z)",
        description: "the log-Barnes function $\\ln G(z)$, analytically continued.",
        library: LIBRARY,
      },
    ],
    details: [
      "$\\ln G(z+1) \\sim \\left(\\tfrac{z^2}{2} - \\tfrac{1}{12}\\right)\\ln z - \\tfrac{3z^2}{4} + \\tfrac{z}{2}\\ln 2\\pi + \\zeta'(-1) + \\sum_{k\\ge1} \\dfrac{B_{2k+2}}{4k(k+1)\\,z^{2k}}$ as $\\operatorname{Re}(z) \\to \\infty$, with $\\zeta'(-1) = \\tfrac{1}{12} - \\ln A$ ($A$ Glaisher's constant). This is the numeric kernel, reached through $\\ln G(z) = \\ln G(z+n) - \\sum_{k<n} \\ln\\Gamma(z+k)$.",
      "It is the continuation, not $\\ln$ of the value: on the negative real axis its imaginary part is a multiple of $\\pi$ fixed by continuity from above, so $\\mathrm{LogBarnesG}(-2.5) = -2.5747\\ldots + 6\\pi i$ while $\\ln G(-2.5)$ taken literally would be real. This matches Wolfram's $\\mathrm{LogBarnesG}$.",
      "At positive integers it reduces through the exact superfactorial: $\\ln G(4) = \\ln 2$, $\\ln G(3) = 0$.",
      "$-\\infty$ at the nonpositive integers, where $G$ vanishes.",
    ],
    examples: [
      { expr: ["LogBarnesG", 4], expected: ["Ln", 2], caption: "$\\ln G(4) = \\ln 2$" },
      { expr: ["LogBarnesG", 3], expected: 0, caption: "$\\ln G(3) = \\ln 1 = 0$" },
      {
        expr: ["LogBarnesG", 0],
        expected: "NegativeInfinity",
        category: "Properties",
        caption: "$G(0) = 0$, so its logarithm is $-\\infty$",
      },
      {
        expr: ["LogBarnesG", 10.5],
        expected: 42.2788836367952,
        caption: "Numeric for a floating-point argument",
      },
      {
        expr: ["LogBarnesG", 0.5],
        expected: -0.5054330544894583,
        caption: "$\\ln G(\\tfrac12)$",
      },
      {
        expr: ["LogBarnesG", 0.7],
        expected: -0.21458989707508636,
        caption: "$\\ln G(0.7)$ — negative, since $G < 1$ on $(0, 1)$",
      },
      {
        expr: ["LogBarnesG", ["Complex", 1.7, 1]],
        expected: ["Complex", 0.12137866262889929, -0.31356176133685665],
        category: "Scope",
        caption: "Complex arguments",
      },
      {
        expr: ["LogBarnesG", ["List", ["List", 4, -1], ["List", 0, 3]]],
        expected: [
          "List",
          ["List", ["Ln", 2], "NegativeInfinity"],
          ["List", "NegativeInfinity", 0],
        ],
        category: "Scope",
        caption: "Threads elementwise over an array: $-\\infty$ at the zeros of $G$",
      },
      {
        expr: ["LogBarnesG", 10],
        expected: [
          "Add",
          ["Multiply", 2, ["Ln", 14]],
          ["Multiply", 3, ["Ln", 10]],
          ["Multiply", 9, ["Ln", 3]],
          ["Multiply", 18, ["Ln", 2]],
          ["Ln", 5],
        ],
        category: "Properties",
        caption:
          "Exact at the integers: $\\ln G(10) = \\ln 5056584744960000$, split into logarithms of its factors",
        divergence: { wolfram: "Wolfram keeps a single logarithm, Log[5056584744960000]." },
      },
      {
        expr: ["LogBarnesG", -2.5],
        expected: ["Complex", -2.5747484768528466, 18.84955592153876],
        category: "Possible issues",
        caption:
          "The continuation, not $\\ln$ of the value: $G(-2.5) > 0$, yet the imaginary part is $6\\pi$",
      },
      {
        expr: ["N", ["LogBarnesG", ["Power", 10, 1000]]],
        expected: { num: "1.15054254649702284200899572734e2003" },
        category: "Scope",
        caption:
          "Huge arguments, straight from the asymptotic series: $\\ln G(10^{1000}) \\approx 1.1505\\times10^{2003}$; stays unevaluated (and arguments near $10^{20}$ exceed the time cap)",
        aspirational: true,
      },
      {
        expr: ["LogBarnesG", ["Interval", 0.111, 0.112]],
        expected: ["Interval", -2.106284277112393, -2.096646198881469],
        category: "Scope",
        caption: "Interval arithmetic over an increasing stretch; not yet",
        aspirational: true,
      },
      {
        expr: ["LogBarnesG", ["Around", 1.2, 0.01]],
        expected: ["Around", 0.05620885559910568, 0.0016113055388623507],
        category: "Scope",
        caption: "Uncertainty propagation through $\\ln G$; not yet",
        aspirational: true,
      },
      {
        expr: ["LogBarnesG", "PositiveInfinity"],
        expected: "PositiveInfinity",
        category: "Scope",
        caption: "$\\ln G(\\infty) = \\infty$; the limit is not taken yet",
        aspirational: true,
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.LogBarnesG,
        note: "The Weierstrass product in logarithms. Its terms are O(w\u00b3/k\u00b2), so it converges \u2014 slowly: a few hundred terms for a dozen digits, against the kernel's asymptotic series.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/barnes-g.ts",
      },
    ],
    seeAlso: ["BarnesG", "LogGamma", "Gamma"],
  },
  {
    name: "LogGamma",
    domain: "Special functions",
    signature: "LogGamma(z)",
    summary:
      "The log-gamma function $\\ln\\Gamma(z)$ as an analytic continuation (branch cut on $(-\\infty, 0]$), which differs from $\\ln(\\Gamma(z))$ by multiples of $2\\pi i$ off the positive axis. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "LogGamma(z)",
        description: "the log-gamma function $\\ln\\Gamma(z)$, analytically continued.",
        library: LIBRARY,
      },
    ],
    details: [
      "For real $z > 0$ it is simply $\\ln\\Gamma(z)$: $\\ln\\Gamma(n) = \\ln (n-1)!$, $\\ln\\Gamma(\\tfrac12) = \\tfrac12\\ln\\pi$ -- where it agrees with compute-engine's own [[GammaLn]].",
      "Elsewhere it is the continuation across the upper and lower half-planes, continuous off $(-\\infty, 0]$ — the convention Wolfram's $\\mathrm{LogGamma}$ and mpmath's `loggamma` share. $\\ln(\\Gamma(z))$ with a principal logarithm jumps by $2\\pi i$ wherever $\\Gamma$ crosses the negative axis; this does not. [[GammaLn]] is that principal version, so the two genuinely differ: at $z = -5/2$, GammaLn is $-0.0562$ while LogGamma is $-0.0562 - 3\\pi i$.",
      "$+\\infty$ at the poles of $\\Gamma$, the nonpositive integers.",
      "Numerically, Stirling's series for large $\\operatorname{Re}(z)$ with the recurrence $\\ln\\Gamma(z) = \\ln\\Gamma(z+n) - \\sum_{k<n}\\ln(z+k)$ — in principal logarithms, which for $\\operatorname{Im}(z) \\ne 0$ is exactly the continuation. compute-engine has a complex [[Gamma]] but no LogGamma of its own.",
    ],
    examples: [
      {
        expr: ["LogGamma", 3],
        expected: ["Ln", 2],
        caption: "$\\ln\\Gamma(3) = \\ln 2! = \\ln 2$",
      },
      { expr: ["LogGamma", 1], expected: 0, caption: "$\\ln\\Gamma(1) = 0$" },
      {
        expr: ["LogGamma", ["Rational", 1, 2]],
        expected: ["Multiply", ["Rational", 1, 2], ["Ln", "Pi"]],
        category: "Properties",
        caption:
          "$\\ln\\Gamma(\\tfrac12) = \\tfrac12 \\ln\\pi$, from $\\Gamma(\\tfrac12) = \\sqrt\\pi$",
      },
      {
        expr: ["LogGamma", 0],
        expected: "PositiveInfinity",
        category: "Properties",
        caption: "A pole of $\\Gamma$",
      },
      {
        expr: ["LogGamma", 2.5],
        expected: { num: "0.284682870472919159632" },
        caption:
          "$\\ln\\Gamma(2.5) = \\ln 1.3293\\ldots$ — to the engine's working precision, not a double: right of the imaginary axis this goes through compute-engine's own [[GammaLn]]",
      },
      {
        expr: ["LogGamma", ["Complex", -2.5, 1.5]],
        expected: ["Complex", -3.7175134511917847, -7.713065525834191],
        category: "Possible issues",
        caption:
          "Off the positive axis this is the continuation: $\\ln(\\Gamma(-2.5+1.5i))$ with a principal log has imaginary part $-1.4299$, a full $2\\pi$ away",
      },
      {
        expr: ["LogGamma", 5],
        expected: ["Add", ["Multiply", 3, ["Ln", 2]], ["Ln", 3]],
        caption: "$\\ln\\Gamma(5) = \\ln 4! = \\ln 24$, split into prime logarithms",
        divergence: { wolfram: "Wolfram keeps a single logarithm, Log[24]." },
      },
      {
        expr: ["LogGamma", 2.2],
        expected: { num: "0.096947466790638776492" },
        category: "Scope",
        caption: "To the engine's working precision",
      },
      {
        expr: ["LogGamma", ["Complex", 2.5, 3]],
        expected: ["Complex", -1.4709546103488336, 2.822615638260796],
        category: "Scope",
        caption: "Complex arguments",
      },
      {
        expr: [
          "LogGamma",
          ["List", ["List", ["Rational", 1, 2], -1], ["List", 0, ["Rational", 1, 2]]],
        ],
        expected: [
          "List",
          ["List", ["Multiply", ["Rational", 1, 2], ["Ln", "Pi"]], "PositiveInfinity"],
          ["List", "PositiveInfinity", ["Multiply", ["Rational", 1, 2], ["Ln", "Pi"]]],
        ],
        category: "Scope",
        caption: "Threads elementwise over an array",
      },
      {
        expr: ["LogGamma", -1.5],
        expected: ["Complex", 0.8600470153764732, -6.283185307179586],
        category: "Properties",
        caption:
          "On the negative axis: $\\Gamma(-\\tfrac32) = \\tfrac43\\sqrt\\pi > 0$, but the continuation carries $-2\\pi i$",
      },
      {
        expr: ["LogGamma", ["Rational", 3, 2]],
        expected: ["Ln", ["Multiply", ["Rational", 1, 2], ["Sqrt", "Pi"]]],
        category: "Properties",
        caption:
          "Half-integers past $\\tfrac12$: $\\ln\\Gamma(\\tfrac32) = \\ln\\tfrac{\\sqrt\\pi}{2}$; stays symbolic",
        aspirational: true,
      },
      {
        expr: ["LogGamma", ["Rational", -3, 2]],
        expected: [
          "Subtract",
          ["Ln", ["Multiply", ["Rational", 4, 3], ["Sqrt", "Pi"]]],
          ["Multiply", 2, "ImaginaryUnit", "Pi"],
        ],
        category: "Scope",
        caption:
          "Exact negative half-integers: $\\ln\\Gamma(-\\tfrac32) = \\ln\\tfrac{4\\sqrt\\pi}{3} - 2\\pi i$; stays symbolic",
        aspirational: true,
      },
      {
        expr: ["LogGamma", "PositiveInfinity"],
        expected: "PositiveInfinity",
        category: "Scope",
        caption: "$\\ln\\Gamma(\\infty) = \\infty$; the limit is not taken yet",
        aspirational: true,
      },
      {
        expr: ["N", ["LogGamma", ["Power", 10, 300]]],
        expected: { num: "6.89775527898213705205397436405e302" },
        category: "Scope",
        caption:
          "Huge arguments: $\\ln\\Gamma(10^{300}) \\approx 6.898\\times10^{302}$ — N() overflows to $\\infty$ through $\\Gamma$ instead of using Stirling's series",
        aspirational: true,
      },
      {
        expr: ["LogGamma", ["Interval", 0.41, 0.42]],
        expected: ["Interval", 0.7468637271280142, 0.7714224633947468],
        category: "Scope",
        caption: "Interval arithmetic: decreasing here, so the endpoints swap; not yet",
        aspirational: true,
      },
      {
        expr: ["LogGamma", ["Around", 1.2, 0.01]],
        expected: ["Around", -0.08537409000331585, 0.002890398965921883],
        category: "Scope",
        caption: "Uncertainty propagation, with $\\psi(1.2)$ as the slope; not yet",
        aspirational: true,
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.LogGamma,
        note: "The continuation pinned by ln\u0393(1) = 0 and (ln\u0393)\u2032 = \u03c8 \u2014 which is what makes it the continuation and not Ln(Gamma(z)), whose branch differs off the positive axis.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/loggamma.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "LogGamma[z] and mpmath.loggamma(z) — both the continuation, not Log[Gamma[z]].",
      },
    ],
    seeAlso: ["Gamma", "GammaLn", "LogBarnesG", "Digamma"],
  },
  {
    name: "ClausenCl",
    domain: "Special functions",
    signature: "ClausenCl(n, θ)",
    summary:
      "The Clausen functions $\\mathrm{Cl}_n(\\theta)$: $\\sum_{k\\ge1} \\sin(k\\theta)/k^n$ for even $n$ and $\\sum_{k\\ge1} \\cos(k\\theta)/k^n$ for odd $n$ — the imaginary or real part of $\\operatorname{Li}_n(e^{i\\theta})$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "ClausenCl(n, θ)",
        description:
          "the Clausen function $\\mathrm{Cl}_n(\\theta)$ of integer order $n \\ge 1$ and real $\\theta$.",
        library: LIBRARY,
      },
    ],
    details: [
      "$\\mathrm{Cl}_2(\\theta) = -\\int_0^\\theta \\ln\\left|2\\sin\\tfrac{t}{2}\\right|\\,dt$ is the classical Clausen function; $\\mathrm{Cl}_1(\\theta) = -\\ln|2\\sin(\\theta/2)|$, infinite at $\\theta \\equiv 0$.",
      "Parity alternates with the order (DLMF §25.12(ii), mpmath's `clsin` / `clcos`): even $n$ gives the odd, $2\\pi$-periodic sine series, odd $n$ the even cosine series, so that $\\mathrm{Cl}_n(\\theta) = \\operatorname{Im}\\operatorname{Li}_n(e^{i\\theta})$ or $\\operatorname{Re}\\operatorname{Li}_n(e^{i\\theta})$ respectively. See [[PolyLog]].",
      "Special values: $\\mathrm{Cl}_2(\\pi/2) = G$ (Catalan's constant), $\\mathrm{Cl}_{2m}(0) = \\mathrm{Cl}_{2m}(\\pi) = 0$, $\\mathrm{Cl}_{2m+1}(0) = \\zeta(2m+1)$, $\\mathrm{Cl}_{2m+1}(\\pi) = -\\eta(2m+1)$, $\\mathrm{Cl}_{2m}(\\pi/2) = \\beta(2m)$, $\\mathrm{Cl}_{2m+1}(\\pi/2) = -2^{-(2m+1)}\\eta(2m+1)$. See [[DirichletEta]], [[DirichletBeta]].",
      "$\\mathrm{Cl}_2$ peaks at $\\theta = \\pi/3$ with value $1.01494\\ldots$, the Gieseking constant's companion; the volume of the ideal regular tetrahedron is $3\\,\\mathrm{Cl}_2(\\pi/3)/2$.",
      "Wolfram has no Clausen head: there it is spelled $\\operatorname{Im}[\\mathrm{PolyLog}[n, e^{i\\theta}]]$, which is how the oracle checks are phrased. Numerically, the polylogarithm's expansion at the unit circle (DLMF 25.12.12) with $\\theta$ reduced into $(-\\pi, \\pi]$.",
    ],
    examples: [
      {
        expr: ["ClausenCl", 2, ["Divide", "Pi", 2]],
        expected: "Catalan",
        caption: "$\\mathrm{Cl}_2(\\pi/2) = G$, Catalan's constant",
      },
      {
        expr: ["ClausenCl", 3, 0],
        expected: ["Zeta", 3],
        caption: "Odd orders are cosine series: $\\mathrm{Cl}_3(0) = \\zeta(3)$",
      },
      {
        expr: ["ClausenCl", 2, "Pi"],
        expected: 0,
        category: "Properties",
        caption: "$\\mathrm{Cl}_2(\\pi) = 0$: the sine series vanishes at multiples of $\\pi$",
      },
      {
        expr: ["ClausenCl", 3, "Pi"],
        expected: ["Multiply", ["Rational", -3, 4], ["Zeta", 3]],
        category: "Properties",
        caption: "$\\mathrm{Cl}_3(\\pi) = -\\eta(3) = -\\tfrac34\\zeta(3)$",
      },
      {
        expr: ["ClausenCl", 4, ["Divide", "Pi", 2]],
        expected: ["DirichletBeta", 4],
        category: "Properties",
        caption: "$\\mathrm{Cl}_4(\\pi/2) = \\beta(4)$, which has no closed form of its own",
      },
      {
        expr: ["ClausenCl", 2, 1.0471975511965976],
        expected: 1.0149416064096533,
        caption: "$\\mathrm{Cl}_2(\\pi/3) = 1.01494\\ldots$, the maximum of $\\mathrm{Cl}_2$",
      },
      {
        expr: ["ClausenCl", 1, 0],
        expected: "PositiveInfinity",
        category: "Possible issues",
        caption: "$\\mathrm{Cl}_1(\\theta) = -\\ln|2\\sin(\\theta/2)|$ diverges at $\\theta = 0$",
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.ClausenCl,
        note: "Cl_n cuts Li_n(e^{i\u03b8}) in two by parity: the even orders are the sine series (its imaginary part), the odd orders the cosine series (its real part).",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/clausen.ts",
      },
      {
        origin: "mapped",
        form: "mpmath",
        environment: "external",
        note: "clsin(n, θ) for even n, clcos(n, θ) for odd n. Wolfram has no head; Im/Re PolyLog[n, E^(I θ)] instead.",
      },
    ],
    seeAlso: ["PolyLog", "DirichletBeta", "DirichletEta", "Zeta"],
  },
  {
    name: "DirichletEta",
    domain: "Special functions",
    signature: "DirichletEta(s)",
    summary:
      "The Dirichlet eta function $\\eta(s) = \\sum_{n\\ge1} (-1)^{n-1} n^{-s} = (1 - 2^{1-s})\\,\\zeta(s)$, the alternating zeta — entire, with $\\eta(1) = \\ln 2$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "DirichletEta(s)",
        description: "the Dirichlet eta function $\\eta(s)$.",
        library: LIBRARY,
      },
    ],
    details: [
      "$\\eta(s) = (1 - 2^{1-s})\\zeta(s)$: the alternating series converges for $\\operatorname{Re}(s) > 0$, and the factor cancels $\\zeta$'s pole, so $\\eta$ is entire with $\\eta(1) = \\ln 2$.",
      "Integer values follow from [[Zeta]]'s: $\\eta(2) = \\pi^2/12$, $\\eta(0) = \\tfrac12$, $\\eta(-1) = \\tfrac14$, and $\\eta(3) = \\tfrac34\\zeta(3)$ stays in terms of $\\zeta(3)$.",
      "Zeros: the nontrivial zeros of $\\zeta$, plus those of $1 - 2^{1-s}$ on the line $\\operatorname{Re}(s) = 1$.",
      "Plain evaluation reduces exact integer $s$ through $\\zeta$; other exact $s$ stays symbolic (as in Wolfram) until N() or a floating-point argument. Numerically, complex $s$ is supported; within $0.25$ of $s = 1$ the alternating series is summed directly (Euler transform, via [[LerchPhi]]) so no pole is cancelled.",
    ],
    examples: [
      {
        expr: ["DirichletEta", 1],
        expected: ["Ln", 2],
        caption: "$\\eta(1) = \\ln 2$ — the alternating harmonic series",
      },
      {
        expr: ["DirichletEta", 2],
        expected: ["Multiply", ["Rational", 1, 12], ["Power", "Pi", 2]],
        caption: "$\\eta(2) = \\pi^2/12$",
      },
      {
        expr: ["DirichletEta", 3],
        expected: ["Multiply", ["Rational", 3, 4], ["Zeta", 3]],
        caption: "$\\eta(3) = \\tfrac34\\zeta(3)$ — no closed form beyond Apéry's constant",
      },
      {
        expr: ["DirichletEta", ["List", 0, -1, -2, -3]],
        expected: ["List", ["Rational", 1, 2], ["Rational", 1, 4], 0, ["Rational", -1, 8]],
        category: "Properties",
        caption: "Nonpositive integers: $\\eta(-n) = (2^{n+1} - 1)\\,B_{n+1}/(n+1)$, rational",
      },
      {
        expr: ["DirichletEta", 0.5],
        expected: { num: "0.604898643421630370245" },
        caption:
          "On the critical line — through $(1 - 2^{1-s})\\zeta(s)$, so it carries the engine's working precision",
      },
      {
        expr: ["DirichletEta", ["Rational", 1, 2]],
        expected: ["DirichletEta", ["Rational", 1, 2]],
        category: "Possible issues",
        caption: "An exact non-integer argument stays symbolic until N()",
        divergence: {
          wolfram:
            "An exact non-integer argument stays symbolic here; Wolfram rewrites it as $(1-\\sqrt2)\\zeta(1/2)$ instead.",
        },
      },
      {
        expr: ["DirichletEta", 1.5],
        expected: { num: "0.765147024625407945367" },
        caption: "Numeric for a floating-point argument",
      },
      {
        expr: ["DirichletEta", 4],
        expected: ["Multiply", ["Rational", 7, 720], ["Power", "Pi", 4]],
        category: "Properties",
        caption: "$\\eta(4) = \\tfrac78\\zeta(4) = 7\\pi^4/720$",
      },
      {
        expr: ["DirichletEta", ["Complex", 3.5, 2.5]],
        expected: ["Complex", 1.0001097278046978, 0.07812891204148316],
        category: "Scope",
        caption: "Complex arguments",
      },
      {
        expr: [
          "DirichletEta",
          ["List", ["List", ["Rational", 1, 2], -1], ["List", 0, ["Rational", 1, 2]]],
        ],
        expected: [
          "List",
          ["List", ["DirichletEta", ["Rational", 1, 2]], ["Rational", 1, 4]],
          ["List", ["Rational", 1, 2], ["DirichletEta", ["Rational", 1, 2]]],
        ],
        category: "Scope",
        caption: "Threads elementwise over an array",
        divergence: {
          wolfram:
            "Wolfram also threads, but rewrites $\\eta(\\tfrac12)$ as $(1-\\sqrt2)\\zeta(\\tfrac12)$.",
        },
      },
      {
        expr: ["DirichletEta", "PositiveInfinity"],
        expected: 1,
        category: "Scope",
        caption: "$\\eta(s) \\to 1$ as $s \\to \\infty$; the limit is not taken yet",
        aspirational: true,
      },
      {
        expr: ["DirichletEta", ["Interval", 1.5, 1.6]],
        expected: ["Interval", 0.7651470246254078, 0.7777227266611288],
        category: "Scope",
        caption: "Interval arithmetic over an increasing stretch; not yet",
        aspirational: true,
      },
      {
        expr: ["DirichletEta", ["Around", 2, 0.01]],
        expected: ["Around", 0.8224670334241132, 0.001013165781635045],
        category: "Scope",
        caption: "Uncertainty propagation: $\\eta(2 \\pm 0.01) = 0.82247 \\pm 0.00101$; not yet",
        aspirational: true,
      },
      {
        expr: ["FunctionExpand", ["DirichletEta", "s"]],
        expected: ["Multiply", ["Subtract", 1, ["Power", 2, ["Subtract", 1, "s"]]], ["Zeta", "s"]],
        category: "Properties",
        caption:
          "Rewriting in terms of [[Zeta]]: $\\eta(s) = (1 - 2^{1-s})\\zeta(s)$ — needs a `FunctionExpand` head",
        aspirational: true,
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.DirichletEta,
        note: "The defining identity — except at s = 1, where the native kernel sums the alternating series instead.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/dirichlet.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "DirichletEta[s]; mpmath.altzeta(s).",
      },
    ],
    seeAlso: ["Zeta", "DirichletBeta", "LerchPhi", "PolyLog"],
  },
  {
    name: "DirichletBeta",
    domain: "Special functions",
    signature: "DirichletBeta(s)",
    summary:
      "The Dirichlet beta function $\\beta(s) = \\sum_{n\\ge0} (-1)^n (2n+1)^{-s}$, the L-function of the nontrivial character mod 4 — entire, with $\\beta(1) = \\pi/4$ and $\\beta(2) = G$ (Catalan). Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "DirichletBeta(s)",
        description: "the Dirichlet beta function $\\beta(s)$.",
        library: LIBRARY,
      },
    ],
    details: [
      "$\\beta(s) = 4^{-s}\\left(\\zeta(s, \\tfrac14) - \\zeta(s, \\tfrac34)\\right)$ in terms of [[HurwitzZeta]], which is how it is evaluated numerically (complex $s$ included).",
      "Odd positive integers have closed forms in $\\pi$ and the Euler numbers: $\\beta(2k+1) = (-1)^k E_{2k}\\,\\pi^{2k+1} / (4^{k+1}(2k)!)$ — $\\beta(1) = \\pi/4$ (Leibniz), $\\beta(3) = \\pi^3/32$, $\\beta(5) = 5\\pi^5/1536$.",
      "Even positive integers do not: $\\beta(2) = G = 0.9159\\ldots$ is Catalan's constant, and $\\beta(4), \\beta(6), \\dots$ stay symbolic.",
      "Nonpositive integers are Euler numbers: $\\beta(-2k) = E_{2k}/2$ ($\\beta(0) = \\tfrac12$, $\\beta(-2) = -\\tfrac12$, $\\beta(-4) = \\tfrac52$), and $\\beta(-(2k+1)) = 0$.",
      "Functional equation $\\beta(1-s) = (\\pi/2)^{-s} \\sin(\\pi s/2)\\,\\Gamma(s)\\,\\beta(s)$; entire, no poles.",
    ],
    examples: [
      {
        expr: ["DirichletBeta", 1],
        expected: ["Multiply", ["Rational", 1, 4], "Pi"],
        caption: "$\\beta(1) = \\pi/4$: Leibniz's series $1 - \\tfrac13 + \\tfrac15 - \\cdots$",
      },
      {
        expr: ["DirichletBeta", 2],
        expected: "Catalan",
        caption: "$\\beta(2) = G$, Catalan's constant",
      },
      {
        expr: ["DirichletBeta", 3],
        expected: ["Multiply", ["Rational", 1, 32], ["Power", "Pi", 3]],
        caption: "$\\beta(3) = \\pi^3/32$",
      },
      {
        expr: ["DirichletBeta", 7],
        expected: ["Multiply", ["Rational", 61, 184320], ["Power", "Pi", 7]],
        category: "Properties",
        caption: "$\\beta(7) = 61\\pi^7/184320$ — the $61$ is the Euler number $|E_6|$",
      },
      {
        expr: ["DirichletBeta", ["List", 0, -1, -2, -3, -4]],
        expected: ["List", ["Rational", 1, 2], 0, ["Rational", -1, 2], 0, ["Rational", 5, 2]],
        category: "Properties",
        caption: "$\\beta(-2k) = E_{2k}/2$ and $\\beta(-(2k+1)) = 0$",
      },
      {
        expr: ["DirichletBeta", 4],
        expected: ["DirichletBeta", 4],
        category: "Possible issues",
        caption:
          "Even $s \\ge 4$ has no closed form and stays symbolic; N() gives $0.98894\\ldots$",
        divergence: {
          wolfram:
            "Stays symbolic here; Wolfram rewrites it via $\\zeta(4, 1/4)$ and $\\zeta(4, 3/4)$ instead of a further-reduced number.",
        },
      },
      {
        expr: ["DirichletBeta", 2.5],
        expected: { num: "0.948622174037054707445" },
        caption:
          "Numeric for a floating-point argument — through $4^{-s}(\\zeta(s,\\tfrac14) - \\zeta(s,\\tfrac34))$, so it answers to the engine's working precision rather than a double's",
      },
      {
        expr: ["DirichletBeta", "s"],
        expected: ["DirichletBeta", "s"],
        caption: "A symbolic argument stays symbolic",
      },
      {
        expr: ["DirichletBeta", 5],
        expected: ["Multiply", ["Rational", 5, 1536], ["Power", "Pi", 5]],
        category: "Properties",
        caption: "$\\beta(5) = 5\\pi^5/1536$",
      },
      {
        expr: ["DirichletBeta", ["Complex", 0.5, 14]],
        expected: ["Complex", 1.537115438440316, 1.3434514268677573],
        category: "Scope",
        caption: "Complex arguments, here on the critical line",
      },
      {
        expr: ["DirichletBeta", ["List", ["List", 1, -1], ["List", -1, 1]]],
        expected: [
          "List",
          ["List", ["Multiply", ["Rational", 1, 4], "Pi"], 0],
          ["List", 0, ["Multiply", ["Rational", 1, 4], "Pi"]],
        ],
        category: "Scope",
        caption: "Threads elementwise over an array",
      },
      {
        expr: ["DirichletBeta", "PositiveInfinity"],
        expected: 1,
        category: "Scope",
        caption: "$\\beta(s) \\to 1$ as $s \\to \\infty$; the limit is not taken yet",
        aspirational: true,
      },
      {
        expr: ["DirichletBeta", ["Around", 2, 0.01]],
        expected: ["Around", 0.915965594177219, 0.000815807361165928],
        category: "Scope",
        caption: "Uncertainty propagation: $\\beta(2 \\pm 0.01) = G \\pm 0.00082$; not yet",
        aspirational: true,
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.DirichletBeta,
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/dirichlet.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "DirichletBeta[s]; mpmath.dirichlet(s, [0, 1, 0, -1]).",
      },
    ],
    seeAlso: ["DirichletEta", "HurwitzZeta", "ClausenCl", "Zeta"],
  },
  {
    name: "StieltjesGamma",
    domain: "Special functions",
    signature: "StieltjesGamma(n)",
    summary:
      "The Stieltjes constants $\\gamma_n$, the coefficients of the Laurent expansion of $\\zeta(s)$ at $s = 1$: $\\zeta(s) = \\dfrac{1}{s-1} + \\sum_{n\\ge0} \\dfrac{(-1)^n}{n!}\\gamma_n (s-1)^n$; with a second argument, the generalized $\\gamma_n(a)$ for [[HurwitzZeta]]. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "StieltjesGamma(n)",
        description: "the $n$-th Stieltjes constant $\\gamma_n$.",
        library: LIBRARY,
      },
      {
        call: "StieltjesGamma(n, a)",
        description:
          "the generalized Stieltjes constant $\\gamma_n(a)$, from the expansion of $\\zeta(s, a)$ at $s = 1$.",
        library: LIBRARY,
      },
    ],
    details: [
      "$\\gamma_0 = \\gamma = 0.5772\\ldots$ is Euler's constant; $\\gamma_1 = -0.0728158\\ldots$, $\\gamma_2 = -0.0096903\\ldots$. They have no closed forms beyond $\\gamma_0$.",
      "$\\gamma_n = \\lim_{m\\to\\infty}\\left(\\sum_{k=1}^m \\dfrac{\\ln^n k}{k} - \\dfrac{\\ln^{n+1} m}{n+1}\\right)$; for $n = 0$ this is the definition of Euler's constant.",
      "Generalized: $\\zeta(s, a) = \\dfrac{1}{s-1} + \\sum_n \\dfrac{(-1)^n}{n!}\\gamma_n(a)(s-1)^n$, so $\\gamma_n(1) = \\gamma_n$ and $\\gamma_0(a) = -\\psi(a)$, the negated digamma. Shift: $\\gamma_n(a+1) = \\gamma_n(a) - \\ln^n(a)/a$. Poles at $a = 0, -1, -2, \\dots$.",
      "Same normalisation as Wolfram's $\\mathrm{StieltjesGamma}[n, a]$ and mpmath's `stieltjes(n, a)`. Complex $a$ supported.",
      "Numerically, Euler–Maclaurin on $\\ln^n(x)/x$. In double precision the partial sum and the subtracted $\\ln^{n+1}$ term cancel more and more with $n$: about $10^{-12}$ relative through $n = 15$, $10^{-10}$ at $n = 20$, $10^{-8}$ at $n = 30$ — and orders past 30 are left unevaluated rather than returned wrong.",
    ],
    examples: [
      {
        expr: ["StieltjesGamma", 0],
        expected: "EulerGamma",
        caption: "$\\gamma_0 = \\gamma$, Euler's constant",
      },
      {
        expr: ["StieltjesGamma", 0, "a"],
        expected: ["Negate", ["PolyGamma", 0, "a"]],
        category: "Properties",
        caption: "$\\gamma_0(a) = -\\psi(a)$, symbolically in $a$",
      },
      {
        expr: ["StieltjesGamma", 1],
        expected: ["StieltjesGamma", 1],
        caption:
          "No closed form past $\\gamma_0$ — stays symbolic until N(), which gives $-0.0728158\\ldots$",
      },
      {
        expr: ["StieltjesGamma", 1, 1.5],
        expected: 0.0328346803149494,
        caption: "$\\gamma_1(\\tfrac32)$ numerically — a floating-point argument asks for a number",
      },
      {
        expr: ["StieltjesGamma", 3, 0.5],
        expected: -0.6674242737113798,
        caption: "$\\gamma_3(\\tfrac12) = -0.66742\\ldots$",
      },
      {
        expr: ["StieltjesGamma", 2, -1],
        expected: "ComplexInfinity",
        category: "Possible issues",
        caption: "$\\gamma_n(a)$ has poles at the nonpositive integers, like $\\zeta(s, a)$",
      },
      {
        expr: ["StieltjesGamma", 40],
        expected: ["StieltjesGamma", 40],
        category: "Possible issues",
        caption:
          "Orders past 30 stay unevaluated even under N(): the double-precision kernel cannot be trusted there",
      },
      {
        expr: ["StieltjesGamma", 2, 1.5],
        expected: 0.007958447383888047,
        caption: "$\\gamma_2(\\tfrac32)$",
      },
      {
        expr: ["N", ["StieltjesGamma", 1]],
        expected: -0.07281584548367652,
        caption: "$\\gamma_1 = -0.0728158\\ldots$ under N()",
      },
      {
        expr: ["N", ["StieltjesGamma", 2, ["Complex", 1, 1]]],
        expected: ["Complex", 0.1703042014685879, 0.37317719575749525],
        category: "Scope",
        caption: "Complex $a$",
      },
      {
        expr: ["StieltjesGamma", ["List", 1, 2, 3], 0.5],
        expected: ["List", -1.3534596808049415, 0.9688644752202907, -0.6674242737113807],
        category: "Scope",
        caption: "Listable in the order $n$: threads over a list; not yet (a type error today)",
        aspirational: true,
      },
      {
        expr: ["StieltjesGamma", 2, ["Interval", 2.34, 2.35]],
        expected: ["Interval", -0.06724128035508715, -0.06514040366307242],
        category: "Scope",
        caption: "Interval arithmetic in $a$; not yet (a type error today)",
        aspirational: true,
      },
      {
        expr: ["StieltjesGamma", 1, 1],
        expected: ["StieltjesGamma", 1],
        category: "Properties",
        caption: "$\\gamma_n(1) = \\gamma_n$; the two-argument form does not reduce to it yet",
        aspirational: true,
      },
      {
        expr: ["StieltjesGamma", 0, 1],
        expected: "EulerGamma",
        category: "Properties",
        caption: "$\\gamma_0(1) = -\\psi(1) = \\gamma$; stops at $-\\psi(1)$",
        aspirational: true,
      },
      {
        expr: ["StieltjesGamma", 0, ["Rational", 1, 2]],
        expected: ["Add", "EulerGamma", ["Multiply", 2, ["Ln", 2]]],
        category: "Properties",
        caption:
          "$\\gamma_0(\\tfrac12) = -\\psi(\\tfrac12) = \\gamma + 2\\ln 2$; stops at $-\\psi(\\tfrac12)$",
        aspirational: true,
      },
    ],
    // \u03b3\u2099(a) IS a Laurent coefficient of \u03b6(s, a) at s = 1, so its definition is a limit of an
    // n-th derivative \u2014 and compute-engine cannot take it: the head collapses to the pole at
    // s = 1 before `Limit` sees a limit, and the partial-sum form converges too slowly to
    // extrapolate. Only \u03b3\u2080(a) = \u2212\u03c8(a) reduces, which the head already does.
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/stieltjes.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "StieltjesGamma[n, a]; mpmath.stieltjes(n, a).",
      },
    ],
    seeAlso: ["Zeta", "HurwitzZeta", "EulerGamma", "Digamma"],
  },
  {
    name: "DirichletCharacter",
    domain: "Special functions",
    signature: "DirichletCharacter(k, j, n)",
    summary:
      "The $j$-th Dirichlet character modulo $k$ evaluated at $n$: a completely multiplicative, $k$-periodic map $\\chi_j: \\mathbb{Z} \\to \\mathbb{C}$, zero where $\\gcd(n, k) > 1$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "DirichletCharacter(k, j, n)",
        description:
          "the character $\\chi_j \\bmod k$ at $n$, for $1 \\le j \\le \\varphi(k)$; $j = 1$ is the principal character.",
        library: LIBRARY,
      },
    ],
    details: [
      "There are exactly $\\varphi(k)$ characters mod $k$ — the dual group of $(\\mathbb{Z}/k)^\\times$ — and each is determined by its values on a set of generators. $\\chi_1$, the principal character, is 1 on the units and 0 elsewhere.",
      "Every value is a root of unity of order dividing $\\varphi(k)$, or 0: $\\chi_j(mn) = \\chi_j(m)\\chi_j(n)$ always, and $\\sum_{n=1}^{k}\\chi_j(n) = 0$ for $j \\ne 1$.",
      "The indexing is Wolfram's $\\mathrm{DirichletCharacter}[k, j, n]$, which no published formula pins down; it is reproduced here by decomposing $(\\mathbb{Z}/k)^\\times$ into one cyclic factor per prime power of $k$ in ascending prime order (an odd $p^e$ contributing its least primitive root, $2^e$ contributing $\\langle -1\\rangle \\times \\langle 5 \\rangle$) and reading $j - 1$ as a mixed-radix exponent vector, first component most significant. The whole table is pinned against a Wolfram kernel for every modulus up to 40.",
      "For a prime $k$ with primitive root $g$ this comes out as $\\chi_j(g) = e^{2\\pi i (j-1)/(k-1)}$.",
      "An out-of-range $j$ (greater than $\\varphi(k)$) names no character and is left unevaluated.",
    ],
    examples: [
      {
        expr: ["DirichletCharacter", 4, 2, 3],
        expected: -1,
        caption:
          "The nontrivial character mod 4: $\\chi_2(3) = -1$ (this is the one behind [[DirichletBeta]])",
      },
      {
        expr: ["DirichletCharacter", 5, 2, 2],
        expected: ["Complex", 0, 1],
        caption:
          "$\\chi_2(2) = i$ mod 5 — 2 is a primitive root, so it takes the generating fourth root of unity",
      },
      {
        expr: ["DirichletCharacter", 5, 2, 5],
        expected: 0,
        category: "Properties",
        caption: "A character vanishes where $\\gcd(n, k) > 1$",
      },
      {
        expr: ["DirichletCharacter", 5, 3, 2],
        expected: -1,
        category: "Properties",
        caption:
          "$\\chi_3$ mod 5 is the quadratic character: its period is $1, -1, -1, 1, 0$, the Legendre symbol $\\left(\\tfrac{n}{5}\\right)$",
      },
      {
        expr: ["DirichletCharacter", 1, 1, 7],
        expected: 1,
        category: "Properties",
        caption: "The trivial character mod 1 is 1 everywhere — its L-function is $\\zeta$",
      },
      {
        expr: ["DirichletCharacter", 5, 9, 2],
        expected: ["DirichletCharacter", 5, 9, 2],
        category: "Possible issues",
        caption:
          "$j$ must be at most $\\varphi(k) = 4$; out of range names no character and stays unevaluated",
      },
      {
        expr: ["DirichletCharacter", 7, 3, 3],
        expected: ["Add", ["Rational", -1, 2], ["Complex", 0, ["Divide", ["Sqrt", 3], 2]]],
        category: "Scope",
        caption:
          "Values are roots of unity: 3 generates $(\\mathbb{Z}/7)^\\times$, and $\\chi_3(3) = e^{2\\pi i/3}$",
      },
      {
        expr: ["DirichletCharacter", 3, 2, ["List", 1, 2, 3, 4, 5]],
        expected: ["List", 1, -1, 0, 1, -1],
        category: "Scope",
        caption:
          "Listable in $n$: the nontrivial character mod 3 over $1, \\dots, 5$; not yet (a type error today)",
        aspirational: true,
      },
    ],
    primitive: "kernel",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/dirichlet-l.ts",
        note: "A discrete logarithm against the cyclic decomposition — an algorithm over mutable state, not a tree.",
      },
      {
        origin: "mapped",
        form: "wolfram",
        environment: "external",
        note: "DirichletCharacter[k, j, n], same indexing. mpmath has no character indexing at all.",
      },
    ],
    seeAlso: ["DirichletL", "DirichletBeta", "DirichletEta", "Zeta"],
  },
  {
    name: "DirichletL",
    domain: "Special functions",
    signature: "DirichletL(k, j, s)",
    summary:
      "The Dirichlet L-function $L(s, \\chi) = \\sum_{n\\ge1} \\chi(n)\\,n^{-s}$ of the $j$-th character mod $k$ — the family that contains $\\zeta$, $\\eta$ and $\\beta$, and the setting of Dirichlet's theorem on primes in arithmetic progressions. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "DirichletL(k, j, s)",
        description: "the L-function of [[DirichletCharacter]] $\\chi_j \\bmod k$.",
        library: LIBRARY,
      },
    ],
    details: [
      "$L(s, \\chi_1 \\bmod 1) = \\zeta(s)$, and for the principal character mod $k$ the Euler factors at the primes dividing $k$ drop out: $L(s, \\chi_1) = \\zeta(s)\\prod_{p \\mid k}(1 - p^{-s})$ — so it inherits $\\zeta$'s pole at $s = 1$. Every non-principal $L$ is entire.",
      "$L(s, \\chi_2 \\bmod 4) = \\beta(s)$, the [[DirichletBeta]] function; $\\eta(s)$ is not an L-function of this family (the alternating sign is not a character mod 2) but is $(1 - 2^{1-s})\\zeta(s)$. See [[DirichletEta]].",
      "$L(1, \\chi) \\neq 0$ for every non-principal $\\chi$ is the analytic heart of Dirichlet's theorem: each residue class coprime to $k$ contains infinitely many primes.",
      "Values at nonpositive integers are exact: $L(-n, \\chi) = -k^n \\sum_{r=1}^{k} \\chi(r)\\,B_{n+1}(r/k)/(n+1)$, an algebraic number in the character's roots of unity (generalized Bernoulli numbers). See [[BernoulliB]].",
      "Numerically, $L(s, \\chi) = k^{-s}\\sum_{r=1}^{k}\\chi(r)\\,\\zeta(s, r/k)$ on the [[HurwitzZeta]] kernel, for complex $s$; near $s = 1$ the Hurwitz poles cancel against each other, so there the Laurent expansion in the generalized [[StieltjesGamma]] constants is summed instead.",
    ],
    examples: [
      {
        expr: ["DirichletL", 1, 1, "s"],
        expected: ["Zeta", "s"],
        caption: "Modulus 1: the Riemann zeta function itself",
      },
      {
        expr: ["DirichletL", 4, 2, 1],
        expected: ["Multiply", ["Rational", 1, 4], "Pi"],
        caption: "$L(1, \\chi_2 \\bmod 4) = \\beta(1) = \\pi/4$ — Leibniz's series",
      },
      {
        expr: ["DirichletL", 12, 1, "s"],
        expected: [
          "Multiply",
          ["Add", ["Negate", ["Power", 2, ["Negate", "s"]]], 1],
          ["Add", ["Negate", ["Power", 3, ["Negate", "s"]]], 1],
          ["Zeta", "s"],
        ],
        category: "Properties",
        caption: "A principal character drops the Euler factors at $2$ and $3$",
      },
      {
        expr: ["DirichletL", 12, 1, 1],
        expected: "ComplexInfinity",
        category: "Properties",
        caption: "…and keeps $\\zeta$'s pole; a non-principal $L$ is entire",
        divergence: {
          wolfram:
            "We answer the pole as ComplexInfinity; Wolfram declines and leaves the call unevaluated instead.",
        },
      },
      {
        expr: ["DirichletL", 5, 2, 0],
        expected: ["Complex", ["Rational", 3, 5], ["Rational", 1, 5]],
        category: "Properties",
        caption:
          "$L(0, \\chi) = \\tfrac35 + \\tfrac15 i$ — exact, from the generalized Bernoulli numbers",
      },
      {
        expr: ["DirichletL", 8, 2, -3],
        expected: 11,
        category: "Properties",
        caption: "$L(-3, \\chi_2 \\bmod 8) = 11$",
      },
      {
        expr: ["DirichletL", 5, 2, 2],
        expected: ["DirichletL", 5, 2, 2],
        category: "Possible issues",
        caption:
          "No closed form at positive integer $s$ in general, so this stays symbolic; N() gives $0.95872 + 0.14557i$",
      },
      {
        expr: ["DirichletL", 1, 1, 2],
        expected: ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
        caption: "$L(2, \\chi_1 \\bmod 1) = \\zeta(2) = \\pi^2/6$",
      },
      {
        expr: ["DirichletL", 3, 2, 1.5],
        expected: 0.7039682448687329,
        caption: "Numeric for a floating-point argument",
      },
      {
        expr: ["N", ["DirichletL", 2, 1, ["Complex", 1, 1]]],
        expected: ["Complex", 0.6543589174072331, -0.3843763502147996],
        category: "Scope",
        caption: "Complex $s$: $L(s, \\chi_1 \\bmod 2) = (1 - 2^{-s})\\zeta(s)$ at $s = 1 + i$",
      },
      {
        expr: ["DirichletL", 2, 1, "s"],
        expected: [
          "Multiply",
          ["Add", ["Negate", ["Power", 2, ["Negate", "s"]]], 1],
          ["Zeta", "s"],
        ],
        category: "Properties",
        caption: "The principal character mod 2 removes the Euler factor at 2",
      },
      {
        expr: ["DirichletL", 4, 2, 2],
        expected: "Catalan",
        category: "Properties",
        caption: "$L(2, \\chi_2 \\bmod 4) = \\beta(2) = G$",
      },
      {
        expr: ["DirichletL", 3, 2, 0],
        expected: ["Rational", 1, 3],
        category: "Properties",
        caption:
          "$L(0, \\chi_{-3}) = \\tfrac13$ — the class number formula's $2h/w$ for $\\mathbb{Q}(\\sqrt{-3})$",
      },
      {
        expr: ["DirichletL", 3, 2, 1],
        expected: ["Divide", "Pi", ["Multiply", 3, ["Sqrt", 3]]],
        category: "Properties",
        caption:
          "$L(1, \\chi_{-3}) = \\pi/(3\\sqrt3)$: $s = 1$ for an odd character has a closed form; stays symbolic",
        aspirational: true,
      },
      {
        expr: ["DirichletL", 1, 1, ["List", 1, 2, 3, 4]],
        expected: [
          "List",
          "ComplexInfinity",
          ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
          ["Zeta", 3],
          ["Multiply", ["Rational", 1, 90], ["Power", "Pi", 4]],
        ],
        category: "Scope",
        caption: "Listable in $s$: threads over a list; not yet (a type error today)",
        aspirational: true,
      },
      {
        expr: ["DirichletL", 5, 1, ["Interval", 1.23, 1.24]],
        expected: ["Interval", 4.113958567039058, 4.25898895010849],
        category: "Scope",
        caption: "Interval arithmetic in $s$ (decreasing here); not yet (a type error today)",
        aspirational: true,
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.DirichletL,
        note: "The Hurwitz decomposition — the definition the kernel evaluates, away from s = 1.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/dirichlet-l.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "DirichletL[k, j, s]; mpmath has dirichlet(s, chi) but takes the character as a period, with no indexing of its own.",
      },
    ],
    seeAlso: ["DirichletCharacter", "DirichletBeta", "DirichletEta", "HurwitzZeta", "Zeta"],
  },
  {
    name: "HarmonicNumber",
    domain: "Special functions",
    signature: "HarmonicNumber(n)",
    summary:
      "The harmonic number $H_n = \\sum_{k=1}^n \\tfrac1k$, exact at a non-negative integer $n$; with a second argument, the generalized $H_n^{(r)} = \\sum_{k=1}^n k^{-r}$. Continued off the integers by $H_z = \\psi(z+1) + \\gamma$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "HarmonicNumber(n)",
        description: "the harmonic number $H_n = \\sum_{k=1}^n 1/k$.",
        library: LIBRARY,
      },
      {
        call: "HarmonicNumber(n, r)",
        description: "the generalized harmonic number $H_n^{(r)} = \\sum_{k=1}^n k^{-r}$.",
        library: LIBRARY,
      },
    ],
    details: [
      "At a non-negative integer $n$ (and an integer $r$ of either sign, in the two-argument form) the sum is exact: $H_0 = 0$, $H_1 = 1$, $H_2 = \\tfrac32$, $H_{10} = \\tfrac{7381}{2520}$.",
      "Continued off the lattice by the standard digamma identity $H_z = \\psi(z+1) + \\gamma$ ([[PolyGamma]], [[EulerGamma]]) and its generalization $H_z^{(r)} = \\zeta(r) - \\zeta(r, z+1)$ ([[Zeta]], [[HurwitzZeta]]) — both reduce to the same exact values at the integers, so there is one formula, not a case split.",
      "Negative integer $n$ has no sum and is a pole: $H_{-1} = H_{-2} = \\cdots = \\mathrm{ComplexInfinity}$, in both the one- and two-argument forms — matching Wolfram, which does not extend the sum by the continuation there.",
      "Complex $z$ and complex/non-integer $r$ are supported numerically, via [[PolyGamma]]'s digamma ($r$ absent) and [[HurwitzZeta]] ($r$ present).",
      "A non-integer $r$ (or non-integer $z$ with $r$ present) stays symbolic under plain evaluation even at an otherwise-exact $n$ — the sum $\\sum k^{-r}$ has no rational value there — and only reduces under N() or a floating-point argument, the same gate every head in this package uses.",
    ],
    examples: [
      {
        expr: ["HarmonicNumber", 10],
        expected: ["Rational", 7381, 2520],
        caption: "$H_{10} = \\tfrac{7381}{2520}$",
      },
      { expr: ["HarmonicNumber", 0], expected: 0, caption: "$H_0 = 0$, the empty sum" },
      {
        expr: ["HarmonicNumber", 5, -1],
        expected: 15,
        caption: "$H_5^{(-1)} = \\sum_{k=1}^5 k = 15$ — a negative order is still exact",
      },
      {
        expr: ["HarmonicNumber", 2.5],
        expected: { num: "1.680372305546776047837" },
        caption: "A floating-point argument evaluates via $\\psi(z+1) + \\gamma$",
      },
      {
        expr: ["HarmonicNumber", -3],
        expected: "ComplexInfinity",
        category: "Properties",
        caption: "No sum below $n = 0$",
      },
      {
        expr: ["HarmonicNumber", 5, ["Rational", 1, 2]],
        expected: ["HarmonicNumber", 5, ["Rational", 1, 2]],
        category: "Possible issues",
        caption:
          "A non-integer order stays symbolic under plain evaluation, even at an exact $n$; N() gives $3.23167\\ldots$",
      },
      {
        expr: ["HarmonicNumber", 10, 2],
        expected: ["Rational", 1968329, 1270080],
        caption: "$H_{10}^{(2)} = \\sum_{k=1}^{10} k^{-2}$, exact",
      },
      {
        expr: ["HarmonicNumber", 0.33],
        expected: { num: "0.441523646937363528111" },
        category: "Scope",
        caption: "Non-integer arguments via $\\psi(z+1) + \\gamma$",
      },
      {
        expr: ["HarmonicNumber", 0.8, 3],
        expected: { num: "0.940124048948776980484" },
        category: "Scope",
        caption: "The generalized form off the integers, via $\\zeta(r) - \\zeta(r, z+1)$",
      },
      {
        expr: ["HarmonicNumber", ["Complex", 1.5, 2]],
        expected: ["Complex", 1.6170494230744863, 0.7801971357298588],
        category: "Scope",
        caption: "Complex arguments",
      },
      {
        expr: ["N", ["HarmonicNumber", "ExponentialE", 1]],
        expected: 1.7500213805365417,
        category: "Scope",
        caption:
          "Order $r = 1$ off the integers is plain $H_z$: $H_e = 1.75002\\ldots$ — today it comes back ComplexInfinity, from the pole of $\\zeta(1) - \\zeta(1, z+1)$",
        aspirational: true,
      },
      {
        expr: ["HarmonicNumber", ["List", 2, 3, 5, 7, 11]],
        expected: [
          "List",
          ["Rational", 3, 2],
          ["Rational", 11, 6],
          ["Rational", 137, 60],
          ["Rational", 363, 140],
          ["Rational", 83711, 27720],
        ],
        category: "Scope",
        caption: "Listable: threads over a list; not yet (a type error today)",
        aspirational: true,
      },
      {
        expr: [
          "HarmonicNumber",
          2,
          ["List", ["List", ["Rational", 1, 2], 2], ["List", 2, ["Rational", 1, 2]]],
        ],
        expected: [
          "List",
          ["List", ["Add", 1, ["Divide", 1, ["Sqrt", 2]]], ["Rational", 5, 4]],
          ["List", ["Rational", 5, 4], ["Add", 1, ["Divide", 1, ["Sqrt", 2]]]],
        ],
        category: "Scope",
        caption:
          "Threads elementwise over an array of orders, and $H_2^{(1/2)} = 1 + 1/\\sqrt2$ is a finite sum; not yet",
        aspirational: true,
      },
      {
        expr: ["HarmonicNumber", ["Rational", 1, 2]],
        expected: ["Subtract", 2, ["Multiply", 2, ["Ln", 2]]],
        category: "Properties",
        caption:
          "$H_{1/2} = 2 - 2\\ln 2$: exact at rational arguments by Gauss's digamma theorem; stays symbolic",
        aspirational: true,
      },
      {
        expr: ["HarmonicNumber", ["Rational", 1, 4]],
        expected: ["Subtract", ["Subtract", 4, ["Divide", "Pi", 2]], ["Multiply", 3, ["Ln", 2]]],
        category: "Properties",
        caption: "$H_{1/4} = 4 - \\tfrac{\\pi}{2} - 3\\ln 2$; stays symbolic",
        aspirational: true,
      },
      {
        expr: ["HarmonicNumber", "n", -1],
        expected: ["Multiply", ["Rational", 1, 2], "n", ["Add", "n", 1]],
        category: "Properties",
        caption: "Symbolic $n$: $H_n^{(-1)} = n(n+1)/2$, a Faulhaber sum; stays symbolic",
        aspirational: true,
      },
      {
        expr: ["HarmonicNumber", "PositiveInfinity"],
        expected: "PositiveInfinity",
        category: "Properties",
        caption: "The harmonic series diverges; the limit is not taken yet",
        aspirational: true,
      },
      {
        expr: ["HarmonicNumber", "PositiveInfinity", 2],
        expected: ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
        category: "Properties",
        caption: "$H_\\infty^{(r)} = \\zeta(r)$ for $r > 1$: the Basel sum; not yet",
        aspirational: true,
      },
      {
        expr: ["HarmonicNumber", 0.2, ["Interval", 2.1, 2.2]],
        expected: ["Interval", 0.3863469411841759, 0.3950923922402868],
        category: "Scope",
        caption: "Interval arithmetic in the order; not yet (a type error today)",
        aspirational: true,
      },
      {
        expr: ["HarmonicNumber", ["Rational", 3, 2], ["Around", 2.1, 0.01]],
        expected: ["Around", 1.1455164340491326, 0.0008799826466981091],
        category: "Scope",
        caption: "Uncertainty propagation in the order; not yet",
        aspirational: true,
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.HarmonicNumber,
        note: "The one-argument digamma identity; exact at the integers too (ψ(n+1) + γ = Hₙ), so it doubles as the oracle at both.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/harmonic.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "HarmonicNumber[n] / HarmonicNumber[n, r]; mpmath.harmonic(n) (one-argument only — mpmath has no generalized order).",
      },
    ],
    seeAlso: ["PolyGamma", "EulerGamma", "Zeta", "HurwitzZeta"],
  },
  {
    name: "BesselJZero",
    domain: "Special functions",
    signature: "BesselJZero(nu, k)",
    summary:
      "The $k$-th positive zero of the Bessel function $J_\\nu$, for real $\\nu > -1$ and positive integer $k$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "BesselJZero(nu, k)",
        description: "the $k$-th positive zero of $J_\\nu$.",
        library: LIBRARY,
      },
    ],
    details: [
      "compute-engine's native `BesselJ` only evaluates numerically at integer order, so the zero-finder here carries its own real $J_\\nu$ series (term-ratio, stable for the double-precision range zero-finding needs) rather than depending on it — which matters for exactly the half-integer orders Fungrim's identities use.",
      "McMahon's asymptotic expansion seeds a bracket around the $k$-th zero, then bisection (with a few closing Newton steps) converges it.",
      "Matches mpmath's `besseljzero(nu, k)` and Wolfram's `BesselJZero[nu, k]`.",
    ],
    examples: [
      {
        expr: ["N", ["BesselJZero", ["Rational", 3, 2], 1]],
        expected: 4.493409457909064,
        caption: "$j_{3/2,1} = 4.4934\\ldots$ — also the first positive root of $\\tan x = x$",
      },
      {
        expr: ["N", ["BesselJZero", 0, 1]],
        expected: 2.404825557695773,
        caption: "$j_{0,1} = 2.4048\\ldots$",
      },
      {
        expr: ["N", ["BesselJZero", 0, 3]],
        expected: 8.653727912911013,
        caption: "the third zero of $J_0$",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/bessel-zeros.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "BesselJZero[nu, k]; mpmath.besseljzero(nu, k).",
      },
    ],
    seeAlso: ["Sinc"],
  },
  {
    name: "DigammaFunctionZero",
    domain: "Special functions",
    signature: "DigammaFunctionZero(n)",
    summary:
      "The $n$-th real zero of the digamma function $\\psi$: $n=0$ names the zero on $(0,\\infty)$ ($x_0 \\approx 1.4616$), $n \\ge 1$ the zero on $(-n, -n+1)$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "DigammaFunctionZero(n)",
        description: "the $n$-th real zero of $\\psi$, $n \\ge 0$.",
        library: LIBRARY,
      },
    ],
    details: [
      "$\\psi$ is real, meromorphic, with simple poles at $0, -1, -2, \\dots$ and strictly increasing between consecutive poles ($\\psi' = $ trigamma $> 0$), so each interval carries exactly one zero — bisection on the native [[PolyGamma]]/[[Digamma]] finds it without a separate digamma implementation.",
      "$\\psi(x_0) = 0$ at $x_0 \\approx 1.4616321449683623$, sometimes called the digamma's positive real zero.",
    ],
    examples: [
      {
        expr: ["N", ["DigammaFunctionZero", 0]],
        expected: 1.4616321449683622,
        caption: "the digamma function's positive real zero",
      },
      {
        expr: ["N", ["DigammaFunctionZero", 1]],
        expected: -0.5040830082644554,
        caption: "the zero in $(-1, 0)$",
      },
      {
        expr: ["Chop", ["N", ["Digamma", ["DigammaFunctionZero", 2]]]],
        expected: 0,
        category: "Properties",
        caption: "$\\psi$ vanishes exactly there, by construction",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/digamma-zero.ts",
      },
      {
        origin: "mapped",
        form: "mpmath",
        environment: "external",
        note: "findroot(digamma, ...) at the appropriate bracket — Wolfram has no direct equivalent head.",
      },
    ],
    seeAlso: ["PolyGamma"],
  },
  {
    name: "MultiZetaValue",
    domain: "Special functions",
    signature: "MultiZetaValue(s1, s2)",
    summary:
      "The depth-2 multiple zeta value $\\zeta(s_1, s_2) = \\sum_{n_1 > n_2 \\ge 1} n_1^{-s_1} n_2^{-s_2}$, for integers $s_1, s_2 \\ge 2$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "MultiZetaValue(s1, s2)",
        description: "the depth-2 Euler sum $\\zeta(s_1, s_2)$.",
        library: LIBRARY,
      },
    ],
    details: [
      "Scoped to depth 2 with both weights $\\ge 2$ — every `MultiZetaValue` identity Fungrim declares is this shape, which is also exactly what makes the double sum converge unconditionally. A general depth-$n$ MZV over compositions is a different, open-ended project and is not attempted here.",
      "Numerically: $\\zeta(s_1,s_2) = \\sum_{n\\ge1} n^{-s_1} H_{n-1}^{(s_2)}$, summed directly for $10^5$ terms with the tail approximated by $\\zeta(s_2)\\cdot\\sum_{n>N} n^{-s_1}$ (both from the native [[Zeta]]).",
      "Small cases have closed forms Fungrim states directly: $\\zeta(2,2) = \\tfrac34\\zeta(4)$, $\\zeta(3,3) = \\tfrac12(\\zeta(3)^2-\\zeta(6))$, and Euler's reflection $\\zeta(a)\\zeta(b) - \\zeta(a+b) = \\zeta(a,b) + \\zeta(b,a)$ for $a,b\\ge2$.",
    ],
    examples: [
      {
        expr: ["N", ["MultiZetaValue", 2, 2]],
        expected: 0.8117424252833536,
        caption: "$\\zeta(2,2) = \\tfrac34\\zeta(4)$",
      },
      {
        expr: ["N", ["MultiZetaValue", 3, 3]],
        expected: 0.2137988682245925,
        caption: "$\\zeta(3,3) = \\tfrac12(\\zeta(3)^2-\\zeta(6))$",
      },
      {
        expr: ["MultiZetaValue", 1, 2],
        expected: ["MultiZetaValue", 1, 2],
        category: "Possible issues",
        caption: "$s_1 < 2$ stays symbolic — outside the depth-2, both-weights-$\\ge2$ scope",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/multizeta.ts",
      },
    ],
    seeAlso: ["Zeta", "HurwitzZeta"],
  },
  {
    name: "HypergeometricUStar",
    domain: "Special functions",
    signature: "HypergeometricUStar(a, b, z)",
    summary:
      "The regularized Tricomi confluent hypergeometric function $U^*(a,b,z) = z^a\\,U(a,b,z)$, for $b$ not an integer. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "HypergeometricUStar(a, b, z)",
        description: "$z^a$ times Tricomi's confluent hypergeometric $U(a,b,z)$.",
        library: LIBRARY,
      },
    ],
    details: [
      "compute-engine declares `HypergeometricU` but does not evaluate it numerically (a symbolic stub only), so $U$ itself is supplied here via Kummer's connection formula in terms of the entire confluent hypergeometric $M = {}_1F_1$: $U(a,b,z) = \\tfrac{\\Gamma(1-b)}{\\Gamma(a-b+1)}M(a,b,z) + \\tfrac{\\Gamma(b-1)}{\\Gamma(a)}z^{1-b}M(a-b+1,2-b,z)$.",
      "$1/\\Gamma$ is taken directly (zero at the nonpositive integers) rather than as a raw division, so the formula stays finite exactly where $a-b+1$ or $a$ lands on one of $\\Gamma$'s poles — not an edge case Fungrim's own identities avoid.",
      "$b$ at (or very near) an integer is declined: both $\\Gamma(1-b)$ and $\\Gamma(b-1)$ blow up there, and the log-case limit that resolves it is not implemented.",
      "$z^{1-b}$ and the closing $z^a$ take the principal branch, matching mpmath's `hyperu` and Wolfram's `HypergeometricU`.",
    ],
    examples: [
      {
        expr: [
          "Chop",
          [
            "Subtract",
            ["N", ["HypergeometricUStar", ["Rational", 1, 2], ["Rational", 3, 2], 2]],
            1,
          ],
        ],
        expected: 0,
        caption: "$U^*(\\tfrac12,\\tfrac32,2) = 1$",
      },
      {
        expr: ["HypergeometricUStar", 1.3, 2.7, 4.0],
        expected: 1.1137052905867906,
        caption: "a generic point, checked against mpmath's `hyperu`",
      },
      {
        expr: ["HypergeometricUStar", 1, 2, 3],
        expected: ["HypergeometricUStar", 1, 2, 3],
        category: "Possible issues",
        caption:
          "integer $b$ stays symbolic — the connection formula's log-case limit is not implemented",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/hypergeometric-ustar.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "z^a HypergeometricU[a,b,z]; z**a * mpmath.hyperu(a,b,z).",
      },
    ],
    seeAlso: [],
  },
  {
    name: "SloaneA",
    domain: "Special functions",
    signature: "SloaneA(id, n)",
    summary:
      "The $n$-th term of an OEIS sequence, `id` a quoted A-number — scoped to the specific sequences Fungrim's own `SloaneA` identities cite, each aliased to a head that already computes it. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "SloaneA(id, n)",
        description: "the $n$-th term of OEIS sequence `id`.",
        library: LIBRARY,
      },
    ],
    details: [
      "A general OEIS lookup is out of reach — most sequences have no closed form at all — so this aliases exactly the A-numbers Fungrim's identities use: A000045 ([[Fibonacci]]), A000040 (the primes, via `PrimeNumber`), A000720 (`PrimePi`), A000041 (`NPartition`), A000110 (`BellNumber`), A000142 (`Factorial`), A027641/A027642 (the numerator/denominator of [[BernoulliB]]), and A000793 (Landau's function $g(n)$, the largest order of an element of $S_n$ — computed directly, since compute-engine's `LandauG` is a symbolic stub with no numeric evaluator).",
      "An id this package does not carry stays symbolic rather than guessing (e.g. A060691, which Fungrim cites only inside a derivative formula for AGM's Taylor coefficients, not as an equation for the sequence's value).",
    ],
    examples: [
      {
        expr: ["SloaneA", "'A000045'", 10],
        expected: 55,
        caption: "A000045 is the Fibonacci numbers: the 10th is 55",
      },
      {
        expr: ["SloaneA", "'A000793'", 10],
        expected: 30,
        caption: "A000793, Landau's function: $g(10) = 30$",
      },
      {
        expr: ["SloaneA", "'A060691'", 5],
        expected: ["SloaneA", "'A060691'", 5],
        category: "Possible issues",
        caption: "An OEIS id outside the declared alias table stays symbolic",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/sloane-a.ts",
      },
    ],
    seeAlso: ["Fibonacci", "BellNumber", "BernoulliB"],
  },
  {
    name: "QPochhammer",
    domain: "Special functions",
    signature: "QPochhammer(a, q, n)",
    summary:
      "The q-Pochhammer symbol $(a; q)_n = \\prod_{k=0}^{n-1} (1 - a q^k)$, for a nonnegative integer $n$ or $n = \\infty$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "QPochhammer(a, q, n)",
        description: "the q-Pochhammer symbol $(a; q)_n$.",
        library: LIBRARY,
      },
    ],
    details: [
      "Finite $n \\ge 0$ builds the product from exact boxed arithmetic — an exact rational $a$ or $q$ stays exact, and $n = 0$ gives the empty product, 1, even for symbolic $a$ and $q$.",
      "$n = \\infty$ is Euler's infinite product, numeric-only and only where it converges ($|q| < 1$); it stays symbolic for exact operands (use `N()`) and for $|q| \\ge 1$.",
      "Negative or symbolic $n$ is not implemented and stays symbolic — Wolfram's extension to negative $n$ via $(a;q)_{-n} = 1/\\prod_{k=1}^n(1 - a q^{-k})$ is not carried here.",
    ],
    examples: [
      {
        expr: ["QPochhammer", 2, 3, 3],
        expected: -85,
        caption: "$(1-2)(1-6)(1-18) = -85$",
      },
      {
        expr: ["QPochhammer", ["Rational", 1, 2], ["Rational", 1, 2], 3],
        expected: ["Rational", 21, 64],
        caption: "Exact rational arithmetic, no `N()` needed",
      },
      {
        expr: ["QPochhammer", "a", "q", 0],
        expected: 1,
        category: "Properties",
        caption: "The empty product",
      },
      {
        expr: ["QPochhammer", 0.5, 0.5, "PositiveInfinity"],
        expected: 0.2887880950866024,
        category: "Scope",
        caption: "The infinite product, Euler's function at $q = \\tfrac12$",
      },
    ],
    primitive: "kernel",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/q-series.ts",
        note: "finite n: exact boxed Multiply/Subtract/Power, evaluated in place. Infinite n: a capped product until |q^k| underflows.",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "QPochhammer[a, q, n]; mpmath.qp(a, q, n).",
      },
    ],
    seeAlso: ["QFactorial", "QBinomial"],
  },
  {
    name: "QFactorial",
    domain: "Special functions",
    signature: "QFactorial(n, q)",
    summary:
      "The q-factorial $[n]_q! = [1]_q [2]_q \\cdots [n]_q$, where $[k]_q = 1 + q + \\cdots + q^{k-1}$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "QFactorial(n, q)",
        description: "the q-factorial $[n]_q!$.",
        library: LIBRARY,
      },
    ],
    details: [
      "Built as a product of q-integers $[k]_q$, each a sum of $k$ powers of $q$ — exact boxed arithmetic throughout, so it reduces to a number for numeric $q$ (rational stays rational) and to a genuine polynomial in $q$ that `Expand` can open up for symbolic $q$.",
      "At $q = 1$, $[k]_1 = k$ termwise (no division, so no $q \\to 1$ limit to take), reducing exactly to $n!$.",
    ],
    examples: [
      {
        expr: ["QFactorial", 3, 2],
        expected: 21,
        caption: "$[1]_2 [2]_2 [3]_2 = 1 \\cdot 3 \\cdot 7$",
      },
      { expr: ["QFactorial", 4, 2], expected: 315 },
      {
        expr: ["QFactorial", 3, ["Rational", 1, 2]],
        expected: ["Rational", 21, 8],
        category: "Scope",
      },
      {
        expr: ["QFactorial", 5, 1],
        expected: 120,
        category: "Properties",
        caption: "At $q = 1$ it is the ordinary factorial",
      },
      {
        expr: ["Expand", ["QFactorial", 3, "q"]],
        expected: [
          "Add",
          ["Power", "q", 3],
          ["Multiply", 2, ["Power", "q", 2]],
          ["Multiply", 2, "q"],
          1,
        ],
        category: "Applications",
        caption:
          "The inversion generating function of SymmetricGroup(3): $\\sum_\\pi q^{\\mathrm{inv}(\\pi)}$",
      },
    ],
    primitive: "kernel",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/q-series.ts",
        note: "product of q-integers, built at canonicalization time (not evaluate) so Expand sees the tree to open up.",
      },
      {
        origin: "mapped",
        form: "wolfram",
        environment: "external",
        note: "QFactorial[n, q].",
      },
    ],
    seeAlso: ["QPochhammer", "QBinomial", "Factorial"],
  },
  {
    name: "QBinomial",
    domain: "Special functions",
    signature: "QBinomial(n, k, q)",
    summary:
      "The Gaussian (q-)binomial coefficient $\\binom{n}{k}_q$, the generating polynomial in $q$ for partitions fitting in a $k \\times (n-k)$ box. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "QBinomial(n, k, q)",
        description: "the Gaussian binomial coefficient $\\binom{n}{k}_q$.",
        library: LIBRARY,
      },
    ],
    details: [
      "Built by the Pascal-like recurrence $\\binom{n}{k}_q = \\binom{n-1}{k-1}_q + q^k \\binom{n-1}{k}_q$, with $\\binom{n}{0}_q = \\binom{n}{n}_q = 1$ — pure addition and multiplication, never division, so it stays a genuine polynomial for symbolic $q$ that `Expand` can open up. The equivalent quotient $[n]_q!/([k]_q![n-k]_q!)$ is exact numerically but `Expand` alone can't cancel it down to a polynomial when $q$ is symbolic, which is why the recurrence is used instead.",
      "At $q = 1$ it reduces to the ordinary $\\binom{n}{k}$ by the same recurrence Pascal's triangle uses.",
    ],
    examples: [
      {
        expr: ["QBinomial", 4, 2, 2],
        expected: 35,
        caption: "$\\frac{(2^4-1)(2^3-1)}{(2^2-1)(2-1)} = 35$",
      },
      {
        expr: ["Expand", ["QBinomial", 4, 2, "q"]],
        expected: [
          "Add",
          ["Power", "q", 4],
          ["Power", "q", 3],
          ["Multiply", 2, ["Power", "q", 2]],
          "q",
          1,
        ],
        category: "Scope",
        caption: "A polynomial in q whose coefficients count partitions in a 2 × 2 box",
      },
      {
        expr: ["QBinomial", 6, 3, 1],
        expected: 20,
        category: "Properties",
        caption: "At q = 1 it is Binomial(6, 3)",
      },
      {
        expr: ["QBinomial", 5, 2, 3],
        expected: 1210,
        category: "Applications",
        caption: "The number of 2-dimensional subspaces of $\\mathbb{F}_3^5$",
      },
    ],
    primitive: "kernel",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/q-series.ts",
        note: "the Pascal-like recurrence, built at canonicalization time so Expand sees the tree.",
      },
      {
        origin: "mapped",
        form: "wolfram",
        environment: "external",
        note: "QBinomial[n, k, q].",
      },
    ],
    seeAlso: ["QPochhammer", "QFactorial", "Binomial"],
  },
  {
    name: "RiemannSiegelTheta",
    domain: "Special functions",
    signature: "RiemannSiegelTheta(t)",
    summary:
      "The Riemann–Siegel theta function $\\vartheta(t) = \\operatorname{Im}\\ln\\Gamma(\\tfrac14 + \\tfrac{it}{2}) - \\tfrac{t}{2}\\ln\\pi$, for real $t$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "RiemannSiegelTheta(t)",
        description: "the Riemann–Siegel theta function $\\vartheta(t)$.",
        library: LIBRARY,
      },
    ],
    details: [
      "Reuses the existing log-gamma continuation ([[LogGamma]], `packages/analytic/src/loggamma.ts`) rather than deriving one — $\\vartheta$ is just its imaginary part on the $\\operatorname{Re} = \\tfrac14$ line, minus the linear term.",
      "Real $t$ only; a complex argument stays symbolic. $\\vartheta(0) = 0$ exactly (no `N()` needed) since $\\ln\\Gamma(\\tfrac14)$ is real.",
      "Numeric otherwise: `N()`, or an inexact $t$, is required to reduce.",
    ],
    examples: [
      { expr: ["RiemannSiegelTheta", 1.5], expected: -2.19819085737941 },
      { expr: ["N", ["RiemannSiegelTheta", 10]], expected: -3.0670743962898954 },
      {
        expr: ["RiemannSiegelTheta", 0],
        expected: 0,
        category: "Properties",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/riemann-siegel.ts",
        note: "built directly on the LogGamma kernel; no new zeta or gamma evaluation of its own.",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "RiemannSiegelTheta[t]; mpmath.siegeltheta(t).",
      },
    ],
    seeAlso: ["RiemannSiegelZ", "Zeta", "LogGamma"],
  },
  {
    name: "RiemannSiegelZ",
    domain: "Special functions",
    signature: "RiemannSiegelZ(t)",
    summary:
      "The Riemann–Siegel function $Z(t) = e^{i\\vartheta(t)}\\zeta(\\tfrac12 + it)$, real-valued for real $t$ by construction. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "RiemannSiegelZ(t)",
        description: "the Riemann–Siegel Z-function.",
        library: LIBRARY,
      },
    ],
    details: [
      "Reuses [[RiemannSiegelTheta]] and the existing generalized-zeta kernel ([[Zeta]]/[[HurwitzZeta]], `packages/analytic/src/hurwitz-zeta.ts`, at $a=1$) — no new zeta evaluation is added here, only the phase rotation onto the real line.",
      "Real $t$ only; numeric via `N()` or an inexact $t$, same as [[RiemannSiegelTheta]].",
      "The sign of $Z$ on the real line is what [[RiemannZetaZero]]'s zero-finder scans for.",
    ],
    examples: [
      { expr: ["RiemannSiegelZ", 1.5], expected: -0.595568336782887 },
      { expr: ["RiemannSiegelZ", 20.5], expected: 0.5993287025147513 },
      {
        expr: ["N", ["RiemannSiegelZ", 0]],
        expected: -1.4603545088095868,
        category: "Properties",
        caption: "$Z(0) = \\zeta(1/2)$",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/riemann-siegel.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "RiemannSiegelZ[t]; mpmath.siegelz(t).",
      },
    ],
    seeAlso: ["RiemannSiegelTheta", "Zeta", "RiemannZetaZero"],
  },
  {
    name: "RiemannZetaZero",
    domain: "Special functions",
    signature: "RiemannZetaZero(k)",
    summary:
      "The $k$-th nontrivial zero of the Riemann zeta function on the critical line, $\\tfrac12 + i t_k$ for a positive integer $k$. Wolfram calls this `ZetaZero`; compute-engine's own Fungrim identity table already spells it `RiemannZetaZero`. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "RiemannZetaZero(k)",
        description: "the k-th nontrivial zero, $\\tfrac12 + i t_k$.",
        library: LIBRARY,
      },
    ],
    details: [
      "$t_k$ is found by scanning [[RiemannSiegelZ]] for sign changes along the real line from $t \\approx 0$, counting crossings as it goes, then bisecting the bracket once the $k$-th crossing turns up. This counts crossings directly rather than bracketing between Gram points, so it isn't exposed to a Gram's-law failure (the first is at Gram index 126) the way a Gram-point method would be.",
      "Supported range: $k$ such that $t_k \\le 2000$ — comfortably past the first 1000 zeros, and well beyond every example here. Above that the call is left symbolic rather than guess further out with an unvalidated scan; $k < 1$ is likewise left symbolic, and a non-integer $k$ is a type error.",
      "Numeric only (`N()` or an inexact operand) — the real part is always exactly $\\tfrac12$; the search cost is in the imaginary part.",
    ],
    examples: [
      {
        expr: ["N", ["RiemannZetaZero", 1]],
        expected: ["Complex", 0.5, 14.134725141734693],
        caption: "The first nontrivial zero, $\\tfrac12 + 14.1347\\ldots i$",
      },
      {
        expr: ["N", ["RiemannZetaZero", 2]],
        expected: ["Complex", 0.5, 21.022039638771556],
      },
      {
        expr: ["N", ["RiemannZetaZero", 10]],
        expected: ["Complex", 0.5, 49.7738324776723],
        category: "Scope",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/riemann-siegel.ts",
        note: "sign-change scan of RiemannSiegelZ + bisection; see the file header for the range this covers.",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "ZetaZero[k]; mpmath.zetazero(k).",
      },
    ],
    seeAlso: ["RiemannSiegelZ", "Zeta"],
  },
  {
    name: "Hypergeometric0F1",
    domain: "Special functions",
    signature: "Hypergeometric0F1(b, z)",
    summary:
      "The confluent hypergeometric limit function ${}_0F_1(b; z) = \\sum_{k\\ge0} z^k / ((b)_k\\,k!)$ — entire in $z$, related to the Bessel functions. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "Hypergeometric0F1(b, z)",
        description: "${}_0F_1(b; z)$, by its defining series.",
        library: LIBRARY,
      },
    ],
    details: [
      "compute-engine 0.128 does not declare this head at all — no `Hypergeometric1F1`-style native to extend — so it is supplied here directly, by the term-ratio recurrence (Fungrim's own `Hypergeometric0F1` identities relate it to `AiryAi`, `Sin` and `Sinc`).",
      "Poles at $b$ a nonpositive integer $0, -1, -2, \\dots$ stay symbolic; see [[Hypergeometric0F1Regularized]] for the entire version.",
    ],
    examples: [
      {
        expr: ["Hypergeometric0F1", 2, 0.5],
        expected: 1.271723456312137,
        caption: "a generic point, checked against mpmath's `hyp0f1`",
      },
      {
        expr: ["Hypergeometric0F1", 0, 0.5],
        expected: ["Hypergeometric0F1", 0, 0.5],
        category: "Possible issues",
        caption: "$b = 0$ is a pole — stays symbolic",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/hypergeometric.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "Hypergeometric0F1[b,z]; mpmath.hyp0f1(b,z).",
      },
    ],
    seeAlso: ["Hypergeometric0F1Regularized", "BesselJ"],
  },
  {
    name: "Hypergeometric0F1Regularized",
    domain: "Special functions",
    signature: "Hypergeometric0F1Regularized(b, z)",
    summary:
      "The regularized confluent hypergeometric limit function ${}_0F_1(b; z) / \\Gamma(b)$ — entire in both $b$ and $z$, unlike [[Hypergeometric0F1]] itself. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "Hypergeometric0F1Regularized(b, z)",
        description: "${}_0F_1(b; z) / \\Gamma(b)$.",
        library: LIBRARY,
      },
    ],
    details: [
      "Computed by its own series $\\sum_{k\\ge0} z^k / (\\Gamma(b+k)\\,k!)$ rather than dividing `Hypergeometric0F1` by `Gamma(b)`: at $b$ a nonpositive integer, `Gamma(b)` is itself a pole, and $1/\\Gamma$ is taken directly (zero there, by the standard convention) so the sum stays finite exactly where the naive division would not.",
      "Entire in $z$ too ($p \\le q$ for this series), so — unlike [[Hypergeometric2F1Regularized]] — never declines on $z$.",
    ],
    examples: [
      {
        expr: ["Hypergeometric0F1Regularized", 2, 0.5],
        expected: 1.2717234563121365,
        caption: "matches Hypergeometric0F1(2, 0.5) / Gamma(2) = Hypergeometric0F1(2, 0.5)",
      },
      {
        expr: ["Hypergeometric0F1Regularized", -1, 0.5],
        expected: 0.1471797367221067,
        caption: "$b = -1$ is a pole of $\\Gamma$, but the regularized form is finite there",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/hypergeometric.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "Hypergeometric0F1Regularized[b,z]; mpmath's own regularized series (rgamma per term).",
      },
    ],
    seeAlso: ["Hypergeometric0F1", "BesselJ"],
  },
  {
    name: "Hypergeometric1F1Regularized",
    domain: "Special functions",
    signature: "Hypergeometric1F1Regularized(a, b, z)",
    summary:
      "The regularized Kummer confluent hypergeometric function ${}_1F_1(a,b;z) / \\Gamma(b)$ — entire in $b$ and $z$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "Hypergeometric1F1Regularized(a, b, z)",
        description: "${}_1F_1(a,b;z) / \\Gamma(b)$.",
        library: LIBRARY,
      },
    ],
    details: [
      "compute-engine declares `Hypergeometric1F1` itself (real and complex $z$) but not this regularized form. Computed by the same $1/\\Gamma$-per-term series as [[Hypergeometric0F1Regularized]], so it stays finite at $b$ a nonpositive integer rather than dividing by `Gamma(b)`'s pole there.",
      "Entire in $z$ ($p = q$ for this series), so never declines on $z$.",
    ],
    examples: [
      {
        expr: ["Hypergeometric1F1Regularized", 1, 2, 0.5],
        expected: 1.2974425414002555,
        caption: "matches Hypergeometric1F1(1, 2, 0.5) / Gamma(2)",
      },
      {
        expr: ["Hypergeometric1F1Regularized", 1, -1, 0.7],
        expected: 0.9867388266605329,
        caption: "$b = -1$ is a pole of $\\Gamma$, but the regularized form is finite there",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/hypergeometric.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "Hypergeometric1F1Regularized[a,b,z]; mpmath's own regularized series (rgamma per term).",
      },
    ],
    seeAlso: ["Hypergeometric2F1Regularized", "HypergeometricU"],
  },
  {
    name: "Hypergeometric2F1Regularized",
    domain: "Special functions",
    signature: "Hypergeometric2F1Regularized(a, b, c, z)",
    summary:
      "The regularized Gauss hypergeometric function ${}_2F_1(a,b,c;z) / \\Gamma(c)$ (fungrim:fe6e74) — entire in $c$; only converges for $|z| < 1$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "Hypergeometric2F1Regularized(a, b, c, z)",
        description: "${}_2F_1(a,b,c;z) / \\Gamma(c)$.",
        library: LIBRARY,
      },
    ],
    details: [
      "Computed by the $1/\\Gamma$-per-term series ($p = q + 1$ here), so it stays finite at $c$ a nonpositive integer rather than dividing `Hypergeometric2F1` by `Gamma(c)`'s pole there.",
      "The series only converges for $|z| < 1$; outside the unit disc this stays symbolic rather than answering with a guessed analytic continuation. Several of Fungrim's own identities for this head (e.g. fungrim:90ac58) rewrite to a different argument first — that rewrite belongs in the identity layer, not here.",
    ],
    examples: [
      {
        expr: ["Hypergeometric2F1Regularized", 1, 1, 2, 0.5],
        expected: 1.3862943611198895,
        caption: "matches Hypergeometric2F1(1, 1, 2, 0.5) / Gamma(2)",
      },
      {
        expr: ["Hypergeometric2F1Regularized", 1, 1, 2, 1.5],
        expected: ["Hypergeometric2F1Regularized", 1, 1, 2, 1.5],
        category: "Possible issues",
        caption: "$|z| \\ge 1$ stays symbolic — no continuation past the unit disc",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/hypergeometric.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "Hypergeometric2F1Regularized[a,b,c,z]; mpmath's own regularized series (rgamma per term).",
      },
    ],
    seeAlso: ["Hypergeometric3F2Regularized", "Hypergeometric1F1Regularized"],
  },
  {
    name: "Hypergeometric3F2Regularized",
    domain: "Special functions",
    signature: "Hypergeometric3F2Regularized(a1, a2, a3, b1, b2, z)",
    summary:
      "The regularized generalized hypergeometric function ${}_3F_2(a_1,a_2,a_3;b_1,b_2;z) / (\\Gamma(b_1)\\Gamma(b_2))$ — entire in $b_1, b_2$; only converges for $|z| < 1$. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "Hypergeometric3F2Regularized(a1, a2, a3, b1, b2, z)",
        description: "${}_3F_2(a_1,a_2,a_3;b_1,b_2;z) / (\\Gamma(b_1)\\Gamma(b_2))$.",
        library: LIBRARY,
      },
    ],
    details: [
      "compute-engine has no `Hypergeometric3F2` at all, regularized or otherwise. Computed directly by the $1/\\Gamma$-per-term series ($p = q + 1$ here), finite at either $b_1$ or $b_2$ a nonpositive integer.",
      "The series only converges for $|z| < 1$; outside the unit disc this stays symbolic. Fungrim's own identities for this head (e.g. the Chebyshev derivative formulas, fungrim:6582c4 / fungrim:e1797b) are unconstrained in their own argument, so not every instance evaluates.",
      "Wolfram has no dedicated 3,2 head; it maps to the generic `HypergeometricPFQRegularized[{a1,a2,a3},{b1,b2},z]`.",
    ],
    examples: [
      {
        expr: ["Hypergeometric3F2Regularized", 1, 1, 1, 2, 3, 0.5],
        expected: 0.5507754140499144,
        caption: "a generic point inside the unit disc",
      },
      {
        expr: ["Hypergeometric3F2Regularized", 1, 1, 1, 2, 3, 1.2],
        expected: ["Hypergeometric3F2Regularized", 1, 1, 1, 2, 3, 1.2],
        category: "Possible issues",
        caption: "$|z| \\ge 1$ stays symbolic — no continuation past the unit disc",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/hypergeometric.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "HypergeometricPFQRegularized[{a1,a2,a3},{b1,b2},z]; mpmath's own regularized series (rgamma per term).",
      },
    ],
    seeAlso: ["Hypergeometric2F1Regularized"],
  },
  {
    name: "HypergeometricU",
    domain: "Special functions",
    signature: "HypergeometricU(a, b, z)",
    summary:
      "Tricomi's confluent hypergeometric function $U(a,b,z)$, for $b$ not an integer — see [[HypergeometricUStar]] for the $z^a$-regularized form Fungrim builds most of its identities from. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "HypergeometricU(a, b, z)",
        description: "Tricomi's confluent hypergeometric $U(a,b,z)$.",
        library: LIBRARY,
      },
    ],
    details: [
      "compute-engine 0.128 references this head only inside its identity rules (relating it to `HypergeometricUStar`) but never actually declares it as an operator, so there was nothing to extend — it is declared directly here, reusing the same Kummer connection-formula kernel as `HypergeometricUStar`.",
      "$b$ at (or very near) an integer is declined, for the same reason `HypergeometricUStar` declines there: the connection formula's $\\Gamma(1-b)$ and $\\Gamma(b-1)$ blow up, and the log-case limit that resolves it is not implemented.",
      "$U(a,b,z) \\cdot z^a$ equals `HypergeometricUStar(a,b,z)` exactly (fungrim:c8fcc7), which is how this is cross-checked.",
    ],
    examples: [
      {
        expr: ["HypergeometricU", 1, 2.5, 3],
        expected: 0.3823406624903156,
        caption: "a generic point, checked against mpmath's `hyperu`",
      },
      {
        expr: ["HypergeometricU", 1, 2, 3],
        expected: ["HypergeometricU", 1, 2, 3],
        category: "Possible issues",
        caption:
          "integer $b$ stays symbolic — the connection formula's log-case limit is not implemented",
      },
    ],
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/hypergeometric-ustar.ts",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "HypergeometricU[a,b,z]; mpmath.hyperu(a,b,z).",
      },
    ],
    seeAlso: ["HypergeometricUStar", "Hypergeometric1F1Regularized"],
  },
];
