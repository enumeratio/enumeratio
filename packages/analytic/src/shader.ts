// A WGSL port of the Hurwitz / generalized-zeta kernel, for GPU evaluation of a
// whole a-grid in parallel (domain coloring, surface plots, an interactive
// Manipulate). Import `zetaWGSL`, prepend it to a shader that supplies a uniform s
// and an entry point, and call `hurwitz(s, a)` or `zetaGen(s, a)` per invocation.
// Functions whose magnitude can leave f32 range come in a `…Log` variant returning
// (direction, ln|value|) — the pair domain coloring actually consumes.
//
// This mirrors the CPU kernel in `hurwitz-zeta.ts` (which stays the source of
// truth). Differences to keep in mind:
//   • f32 only. Fine for a phase portrait (~5–6 digits); it visibly degrades where
//     Im(s) is large, because each term carries exp(Im(s)·arg z) and f32 loses the
//     small-vs-huge cancellation. Use the CPU/mpmath path for real accuracy.
//   • Fewer Euler–Maclaurin pairs (8) — later pairs fall below f32 epsilon anyway.
//   • Left of Re(s) = 0 `hurwitz` takes the CPU's Taylor series in a over reflected Riemann
//     zetas, stopping at f32 epsilon; off the real axis (|Im a| past ~½) the direct sum
//     still cancels there, and far worse in f32.
//   • WGSL gotchas learned here: `target` is a reserved word; a dynamically indexed
//     array must be a function `var`, not a module `const`.
//
// A minimal host fragment shader looks like:
//   struct U { s: vec2f, center: vec2f, extent: f32, aspect: f32, mode: u32, _pad: u32 };
//   @group(0) @binding(0) var<uniform> u: U;
//   <zetaWGSL>
//   @fragment fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f { … hurwitz(u.s, a) … }

export const zetaWGSL = /* wgsl */ `
const EM_PAIRS : i32 = 8;

fn cmul(a: vec2f, b: vec2f) -> vec2f { return vec2f(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
fn cdiv(a: vec2f, b: vec2f) -> vec2f { let d = dot(b, b); return vec2f(a.x*b.x + a.y*b.y, a.y*b.x - a.x*b.y) / d; }
fn cexp(z: vec2f) -> vec2f { let e = exp(z.x); return vec2f(e*cos(z.y), e*sin(z.y)); }
fn clog(z: vec2f) -> vec2f { return vec2f(0.5*log(dot(z, z)), atan2(z.y, z.x)); }
fn cpow(z: vec2f, w: vec2f) -> vec2f { return cexp(cmul(w, clog(z))); }

// The rest of the elementary complex functions, for the expression emitter (see
// wgsl-complex.ts) — a portrait may colour any expression, not just a special
// function. Principal branches throughout, matching clog's cut on (-∞, 0].
fn cneg(z: vec2f) -> vec2f { return -z; }
fn cconj(z: vec2f) -> vec2f { return vec2f(z.x, -z.y); }
fn csqrt(z: vec2f) -> vec2f { return cexp(0.5 * clog(z)); }
fn csin(z: vec2f) -> vec2f { return vec2f(sin(z.x) * cosh(z.y), cos(z.x) * sinh(z.y)); }
fn ccos(z: vec2f) -> vec2f { return vec2f(cos(z.x) * cosh(z.y), -sin(z.x) * sinh(z.y)); }
fn csinh(z: vec2f) -> vec2f { return vec2f(sinh(z.x) * cos(z.y), cosh(z.x) * sin(z.y)); }
fn ccosh(z: vec2f) -> vec2f { return vec2f(cosh(z.x) * cos(z.y), sinh(z.x) * sin(z.y)); }

// ζ(s, a). Euler–Maclaurin, except left of Re(s) = 0 near the real axis short of where its
// direct terms end, which there cancel catastrophically: a shifts by an integer to 1 + h and
// ζ(s, 1 + h) = Σₖ C(−s, k) hᵏ ζ(s + k), with ζ(s + k) from the functional equation left of
// the strip. Mirrors hurwitzZeta in hurwitz-zeta.ts. (n+a)=0 terms are dropped (Wolfram
// HurwitzZeta).
fn hurwitz(s: vec2f, a: vec2f) -> vec2f {
  let m = floor(a.x - 0.5);
  let h = vec2f(a.x - m - 1.0, a.y);
  if (s.x >= 0.0 || a.x >= 4.0 * emEdge(s) || abs(m) > 96.0 || length(h) > 0.75) { return hurwitzEM(s, a); }
  var z = zetaNearOne(s, h);
  for (var j = 0; j < i32(abs(m)); j = j + 1) {
    if (m > 0.0) {
      z = z - cpow(vec2f(h.x + 1.0 + f32(j), a.y), -s);
    } else {
      let b = vec2f(a.x + f32(j), a.y);
      if (!(b.x == 0.0 && b.y == 0.0)) { z = z + cpow(b, -s); }
    }
  }
  return z;
}

fn emEdge(s: vec2f) -> f32 { return max(10.0, ceil(abs(s.x) + abs(s.y)) + 5.0); }

// ζ(s, 1 + h) = Σₖ C(−s, k) hᵏ ζ(s + k), |h| < 1; see hurwitzZeta in hurwitz-zeta.ts.
fn zetaNearOne(s: vec2f, h: vec2f) -> vec2f {
  var sum = riemannZeta(s);
  var c = vec2f(1.0, 0.0);
  var hk = vec2f(1.0, 0.0);
  var largest = length(sum);
  var small = 0;
  for (var k = 1; k < 96; k = k + 1) {
    hk = cmul(hk, h);
    if (hk.x == 0.0 && hk.y == 0.0) { break; }
    let f = vec2f(-s.x - f32(k) + 1.0, -s.y);
    // s = 1 − k, an integer: C(−s, k)·ζ(s + k) → −C(−s, k−1)/k, and the series ends.
    if (f.x == 0.0 && f.y == 0.0) { return sum - cmul(c, hk) / f32(k); }
    c = cmul(c, f) / f32(k);
    let t = cmul(cmul(c, hk), riemannZeta(vec2f(s.x + f32(k), s.y)));
    sum = sum + t;
    largest = max(largest, length(t));
    if (length(t) <= 1e-8 * largest) {
      small = small + 1;
      if (small == 2) { break; }
    } else { small = 0; }
  }
  return sum;
}

fn riemannZeta(s: vec2f) -> vec2f {
  if (s.x < 0.0) { return reflectedZeta(s); }
  return hurwitzEM(s, vec2f(1.0, 0.0));
}

// ζ(s) = 2ˢ πˢ⁻¹ sin(πs/2) Γ(1−s) ζ(1−s) for Re(s) < 0, the factors but ζ(1−s) summed as logs.
fn reflectedZeta(s: vec2f) -> vec2f {
  let r = vec2f(1.0 - s.x, -s.y);
  let lg = 0.6931472 * s + 1.1447299 * vec2f(s.x - 1.0, s.y) + clgamma(r) + clogSin(1.5707963 * s);
  return cmul(cexp(lg), hurwitzEM(r, vec2f(1.0, 0.0)));
}

// ln sin w up to 2πi, overflow-free: sin w = (i/2)·e^(−iw)·(1 − e^(2iw)) for Im w ≥ 0.
fn clogSin(w0: vec2f) -> vec2f {
  let flip = w0.y < 0.0;
  let w = select(w0, cconj(w0), flip);
  let u = cexp(vec2f(-2.0 * w.y, 2.0 * w.x));
  let l = clog(vec2f(1.0 - u.x, -u.y)) + vec2f(w.y - 0.6931472, 1.5707963 - w.x);
  return select(l, cconj(l), flip);
}

// lnΓ(z) up to 2πi, for Re(z) > 0: shift to Re ≥ 8, then Stirling to z⁻⁵.
fn clgamma(z0: vec2f) -> vec2f {
  var z = z0;
  var shift = vec2f(0.0);
  for (var k = 0; k < 8 && z.x < 8.0; k = k + 1) {
    shift = shift + clog(z);
    z = z + vec2f(1.0, 0.0);
  }
  let iz = cdiv(vec2f(1.0, 0.0), z);
  let iz2 = cmul(iz, iz);
  let ser = cmul(iz, vec2f(0.083333333, 0.0) + cmul(iz2, vec2f(-0.0027777778, 0.0) + iz2 * 0.00079365079));
  return cmul(z - vec2f(0.5, 0.0), clog(z)) - z + vec2f(0.9189385, 0.0) + ser - shift;
}

// ζ(s, a) via Euler–Maclaurin.
fn hurwitzEM(s: vec2f, a: vec2f) -> vec2f {
  var em = array<f32, 9>(
    0.0, 0.08333333, -0.0013888889, 0.000033068783, -0.00000082671958,
    0.000000020876757, -0.00000000052841901, 0.000000000013382537, -0.00000000000033896803);
  let N = i32(clamp(ceil(emEdge(s) - a.x), 6.0, 96.0));
  let negS = -s;
  var sum = vec2f(0.0);
  for (var k = 0; k < N; k = k + 1) {
    let b = vec2f(a.x + f32(k), a.y);
    if (!(b.x == 0.0 && b.y == 0.0)) { sum = sum + cpow(b, negS); }
  }
  let z = vec2f(a.x + f32(N), a.y);
  let zNegS = cpow(z, negS);
  sum = sum + cdiv(cpow(z, vec2f(1.0 - s.x, -s.y)), vec2f(s.x - 1.0, s.y));
  sum = sum + 0.5 * zNegS;
  var poch = s;
  var zpow = cdiv(zNegS, z);
  let zinv2 = cpow(z, vec2f(-2.0, 0.0));
  for (var k = 1; k <= EM_PAIRS; k = k + 1) {
    sum = sum + em[k] * cmul(poch, zpow);
    let f1 = vec2f(s.x + f32(2*k - 1), s.y);
    let f2 = vec2f(s.x + f32(2*k), s.y);
    poch = cmul(poch, cmul(f1, f2));
    zpow = cmul(zpow, zinv2);
  }
  return sum;
}

// Wolfram generalized zeta: crossed terms ((n+a)^2)^(-s/2), the (n+a)=0 slot dropped
// (finite at a = 0, -1, -2, …, unlike hurwitz).
fn zetaGen(s: vec2f, a0: vec2f) -> vec2f {
  var a = a0;
  var acc = vec2f(0.0);
  var guard = 0;
  loop {
    if (a.x >= 0.0 || guard > 96) { break; }
    acc = acc + cpow(cmul(a, a), -0.5 * s);
    a = a + vec2f(1.0, 0.0);
    guard = guard + 1;
  }
  if (a.x == 0.0 && a.y == 0.0) { a = vec2f(1.0, 0.0); }
  return acc + hurwitz(s, a);
}

// Lerch transcendent Φ(z, s, a) = Σ zⁿ (n+a)^(−s), direct series. Converges for
// |z| < 1 (bounded iteration count on the GPU); z = 1 falls through to hurwitz.
fn lerchPhi(z: vec2f, s: vec2f, a: vec2f) -> vec2f {
  if (z.x == 1.0 && z.y == 0.0) { return hurwitz(s, a); }
  let negS = -s;
  var sum = vec2f(0.0);
  var zp = vec2f(1.0, 0.0);
  for (var n = 0; n < 4096; n = n + 1) {
    let base = vec2f(a.x + f32(n), a.y);
    if (!(base.x == 0.0 && base.y == 0.0)) { sum = sum + cmul(zp, cpow(base, negS)); }
    zp = cmul(zp, z);
    if (dot(zp, zp) < 1e-30) { break; }
  }
  return sum;
}

// Polylogarithm Liₛ(z) = z·Φ(z, s, 1). Same |z| < 1 limit as lerchPhi.
fn polyLog(s: vec2f, z: vec2f) -> vec2f { return cmul(z, lerchPhi(z, s, vec2f(1.0, 0.0))); }

// Polygamma ψ⁽ᵐ⁾(z) = (−1)^(m+1) m! ζ(m+1, z), integer m ≥ 1. ψ⁽ᵐ⁾(1) ≈ m!, which
// leaves f32 range past m = 34, so high orders saturate to inf here — that is the
// value itself overflowing, not a loss of precision. Use polygammaLog to plot them.
fn polygamma(m: vec2f, z: vec2f) -> vec2f {
  let n = i32(round(m.x));
  var fact = 1.0;
  for (var k = 2; k <= n; k = k + 1) { fact = fact * f32(k); }
  let sgn = select(-1.0, 1.0, (n % 2) == 1);
  return sgn * fact * hurwitz(vec2f(f32(n) + 1.0, 0.0), z);
}

// ψ⁽ᵐ⁾(z) split into phase and log-magnitude: xy is the unit direction, z is
// ln|ψ⁽ᵐ⁾(z)|. The m! that overflows above enters additively here as ln(m!), so every
// order stays representable — domain coloring wants exactly this pair (hue from the
// direction, brightness from a compressed log-magnitude), so nothing is lost.
//
// What still bounds a high order is ζ(m+1, z) itself overflowing f32 near a pole
// (|ζ| ~ |z|^-(m+1) there), which reads as a small blown-out disc around each pole
// rather than, as before, a white frame.
fn polygammaLog(m: vec2f, z: vec2f) -> vec3f {
  let n = i32(round(m.x));
  var lnFact = 0.0;
  for (var k = 2; k <= n; k = k + 1) { lnFact = lnFact + log(f32(k)); }
  let h = hurwitz(vec2f(f32(n) + 1.0, 0.0), z);
  let mag = max(length(h), 1e-30);
  let sgn = select(-1.0, 1.0, (n % 2) == 1);
  return vec3f(sgn * h / mag, log(mag) + lnFact);
}

// Iterated quadratic maps. Not special functions, and this is not their permanent home
// (graphics objects have no package of their own yet) -- they live here because this is
// the shared WGSL preamble every GPU layer already gets.
//
// Both return the n-th iterate itself rather than an escape count, which is the honest
// complex-valued object: colouring it gives the familiar picture, because the exterior
// blows up (white) while the interior stays bounded (coloured by where it settles).
// n is clamped, since a shader cannot be trusted with an unbounded loop.
fn iterateQuadratic(z0: vec2f, c: vec2f, n: f32) -> vec2f {
  let steps = i32(clamp(round(n), 1.0, 512.0));
  var z = z0;
  for (var i = 0; i < steps; i = i + 1) {
    z = cmul(z, z) + c;
    // Once it has escaped it only overflows; stop and let the magnitude speak.
    if (dot(z, z) > 1e12) { break; }
  }
  return z;
}

// Mandelbrot: iterate from 0, and let the *parameter* be the plane.
fn mandelbrot(c: vec2f, n: vec2f) -> vec2f { return iterateQuadratic(vec2f(0.0, 0.0), c, n.x); }

// Julia: iterate from the point, holding the parameter fixed.
fn julia(z: vec2f, c: vec2f, n: vec2f) -> vec2f { return iterateQuadratic(z, c, n.x); }

// The same (direction, log-magnitude) pair for a value that is already in range —
// so a portrait can colour every function through one path.
fn clogPolar(v: vec2f) -> vec3f {
  let mag = max(length(v), 1e-30);
  return vec3f(v / mag, log(mag));
}
`;
