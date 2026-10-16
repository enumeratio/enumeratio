# Helpers the `julia` emit templates call (a head's `form: julia` bindings): Nemo's ball arithmetic
# behind a uniform entry point, and the printers a scan reads a value through.
#
# Nemo's special functions live on balls (arb/acb), and mostly on the complex ones. `enumeratio_ball`
# lifts every operand to a complex ball, calls the function, and drops back to a real ball when the
# answer's imaginary part is zero and every operand was real. A printed ball must be tight, so a scan
# never agrees with a midpoint the ball does not vouch for.

Nemo.set_precision!(Balls, 256)
const RR = RealField()
const CC = ComplexField()

const _Exact = Union{Integer,Rational,ZZRingElem,QQFieldElem}

# Exact operands stay exact: an integer or a rational goes through ZZ and QQ, since Nemo would
# otherwise round a big one through a 256-bit BigFloat without keeping the error.
_isreal(x) = !(x isa Complex || x isa ComplexFieldElem)
_c(x::ComplexFieldElem) = x
_c(x::Complex) = CC(_r(real(x)), _r(imag(x)))
_c(x::AbstractFloat) = isfinite(x) ? CC(x) : error("non-finite argument")
_c(x::Integer) = CC(ZZ(x))
_c(x::Rational) = CC(QQ(ZZ(numerator(x)), ZZ(denominator(x))))
_c(x) = CC(x)
_r(x::RealFieldElem) = x
_r(x::ComplexFieldElem) = iszero(imag(x)) ? real(x) : error("complex argument")
_r(x::AbstractFloat) = isfinite(x) ? RR(x) : error("non-finite argument")
_r(x::Integer) = RR(ZZ(x))
_r(x::Rational) = RR(QQ(ZZ(numerator(x)), ZZ(denominator(x))))
_r(x) = RR(x)

function _collapse(z::ComplexFieldElem, real_in::Bool)
  real_in || return z
  i = imag(z)
  iszero(i) || (contains_zero(i) && radius(i) < 1e-30) ? real(z) : z
end
_collapse(z, _) = z

enumeratio_ball(f, args...) = _collapse(f(map(_c, args)...), all(_isreal, args))

# Exact where both sides are, a ball otherwise.
enumeratio_div(a::_Exact, b::_Exact) = a // b
enumeratio_div(a, b) = enumeratio_ball(/, a, b)
enumeratio_pow(a::Integer, n::Integer) = n >= 0 ? big(a)^n : 1 // big(a)^(-n)
enumeratio_pow(a::Rational, n::Integer) = big(a)^n
enumeratio_pow(a, b) = enumeratio_ball(^, a, b)
enumeratio_complex(a, b) = CC(_r(a), _r(b))

function enumeratio_equal(a, b)
  a isa AbstractVector && return b isa AbstractVector && length(a) == length(b) && all(enumeratio_equal.(a, b))
  if a isa Union{RealFieldElem,ComplexFieldElem} || b isa Union{RealFieldElem,ComplexFieldElem}
    ca, cb = _c(a), _c(b)
    return abs(ca - cb) < (abs(ca) > 1 ? abs(ca) : RR(1)) * RR(10)^(-14)
  end
  a == b
end

enumeratio_atan2(y, x) = atan2(_r(y), _r(x))

# Wolfram's Mod, a - b floor(a / b), through the ball's floor; Nemo's generic mod answers 0 on balls.
const _Plain = Union{Integer,Rational,AbstractFloat,ZZRingElem,QQFieldElem}
enumeratio_mod(a::_Plain, b::_Plain) = mod(a, b)
function enumeratio_mod(a, b)
  x, y = _r(a), _r(b)
  x - y * floor(x / y)
end

# N(x, d): the value rounded to d significant digits, as Wolfram's N does (ties to even).
function _big(x::RealFieldElem)
  isfinite(x) && (accuracy_bits(x) >= 40 || radius(x) < 1e-15) || error("ball too wide")
  BigFloat(x)
end
enumeratio_n(x::AbstractVector, d) = Any[enumeratio_n(e, d) for e in x]
function enumeratio_n(x, d)
  d isa Integer || return x
  z = _c(x)
  re, im = round(_big(real(z)), sigdigits = Int(d)), round(_big(imag(z)), sigdigits = Int(d))
  iszero(imag(z)) ? re : complex(re, im)
end

# ── elementary functions Nemo has on real balls only, or not at all, by their principal branches ──

_sec(z) = inv(cos(z))
_csc(z) = inv(sin(z))
_sech(z) = inv(cosh(z))
_csch(z) = inv(sinh(z))
_asin(z) = -onei(CC) * log(onei(CC) * z + sqrt(1 - z^2))
_acos(z) = const_pi(RR) / 2 - _asin(z)
_asinh(z) = log(z + sqrt(z^2 + 1))
_acosh(z) = log(z + sqrt(z + 1) * sqrt(z - 1))
_atanh(z) = (log(1 + z) - log(1 - z)) / 2
_acoth(z) = iszero(z) ? const_pi(RR) / 2 * onei(CC) : _atanh(inv(z))
_acot(z) = iszero(z) ? const_pi(RR) / 2 : atan(inv(z))
_asec(z) = _acos(inv(z))
_acsc(z) = _asin(inv(z))
_asech(z) = _acosh(inv(z))
_acsch(z) = _asinh(inv(z))
_log10(z) = log(z) / log(CC(10))
_log2(z) = log(z) / log(CC(2))
_log_base(x, b) = log(x) / log(b)

# (a)_n by the product for a whole n (exact at a pole of Γ), by Γ(a + n) / Γ(a) otherwise.
function _rising(a, n)
  ok, k = unique_integer(real(n))
  ok && iszero(imag(n)) && k >= 0 ? rising_factorial(a, Int(k)) : rgamma(a) * gamma(a + n)
end

# ── sign, rounding, roots and extrema ──

enumeratio_sign(x::_Plain) = sign(x)
function enumeratio_sign(x)
  z = _c(x)
  iszero(z) ? 0 : _collapse(z / abs(z), _isreal(x))
end

# Whole parts of a real or complex value; a ball that straddles an integer is an error, not a guess.
_whole(f, x::RealFieldElem) = f(ZZRingElem, x)
_whole(f, x::_Plain) = f(BigInt, x)
function _whole(f, x)
  z = _c(x)
  iszero(imag(z)) ? f(ZZRingElem, real(z)) : CC(f(ZZRingElem, real(z)), f(ZZRingElem, imag(z)))
end
enumeratio_floor(x) = _whole(floor, x)
enumeratio_ceil(x) = _whole(ceil, x)
enumeratio_round(x::_Plain) = round(BigInt, x)
function enumeratio_round(x)
  z = _c(x)
  r(v) = ZZ(round(BigInt, _big(v)))
  iszero(imag(z)) ? r(real(z)) : CC(r(real(z)), r(imag(z)))
end

function enumeratio_cbrt(x)
  z = _c(x)
  _isreal(x) && real(z) < 0 ? -(-z)^(CC(1) / 3) : z^(CC(1) / 3)
end
function enumeratio_root(x, n)
  z, k = _c(x), _c(n)
  _isreal(x) && real(z) < 0 && isodd(Int(ZZ(real(k)))) ? _collapse(-(-z)^(1 / k), true) : _collapse(z^(1 / k), _isreal(x))
end

_greater(a::_Plain, b::_Plain) = a > b
_greater(a, b) = (d = _r(a) - _r(b); d > 0 ? true : d < 0 ? false : error("ambiguous order"))
_flat(xs) = reduce(vcat, [x isa AbstractVector ? _flat(x) : Any[x] for x in xs]; init = Any[])
enumeratio_max(xs...) = reduce((a, b) -> _greater(a, b) ? a : b, _flat(xs))
enumeratio_min(xs...) = reduce((a, b) -> _greater(b, a) ? a : b, _flat(xs))
enumeratio_mean(xs) = all(x -> x isa Integer, xs) ? sum(xs) // length(xs) : sum(xs) / length(xs)

# ── orthogonal polynomials and modular functions ──

enumeratio_chebyshev_t(n, x) = chebyshev_t(Int(ZZ(n)), _r(x))
enumeratio_chebyshev_u(n, x) = chebyshev_u(Int(ZZ(n)), _r(x))

function enumeratio_hermite(n, x)
  z = _c(x)
  a, b = CC(1), 2 * z
  for k in 1:Int(ZZ(n))
    a, b = b, 2 * z * b - 2 * k * a
  end
  _collapse(Int(ZZ(n)) == 0 ? CC(1) : a, _isreal(x))
end

# The θ index a is 1 to 4, and the nome q gives τ = log(q) / (π i).
function enumeratio_theta(a, z, q)
  t = jacobi_theta(_c(z) / const_pi(RR), log(_c(q)) / (const_pi(RR) * onei(CC)))[Int(ZZ(a))]
  _collapse(t, _isreal(z) && _isreal(q))
end

# Weight k, as Wolfram's EisensteinG[k, τ].
enumeratio_eisenstein(k, t) = _collapse(eisenstein_g(Int(ZZ(k)), _c(t)), false)

function enumeratio_bernoulli_poly(n, x)
  m, z = Int(ZZ(n)), _c(x)
  _collapse(sum(CC(binomial(ZZ(m), ZZ(k)) * bernoulli(k)) * z^(m - k) for k in 0:m), _isreal(x))
end

# B(z; a, b), the incomplete beta function, by z^a / a 2F1(a, 1 - b; a + 1; z).
_betainc(z, a, b) = z^a / a * hypergeometric_2f1(a, 1 - b, a + 1, z)
_beta(a, b) = gamma(a) * gamma(b) * rgamma(a + b)

# The Jacobi functions with parameter m, from the theta quotients of DLMF 22.2: τ = i K'(m) / K(m)
# and the theta argument is π u / (2 K). Meant for 0 < m < 1.
function enumeratio_jacobi(kind, u, m)
  mc, uc = _c(m), _c(u)
  if iszero(mc) || mc == 1
    # The degenerate moduli, where K' or K is infinite: circular and hyperbolic functions.
    sn, cn, dn = iszero(mc) ? (sin(uc), cos(uc), CC(1)) : (tanh(uc), inv(cosh(uc)), inv(cosh(uc)))
  else
    K, Kp = elliptic_k(mc), elliptic_k(1 - mc)
    tau = onei(CC) * Kp / K
    t = jacobi_theta(uc / (2K), tau)
    s = jacobi_theta(CC(0), tau)
    sn, cn, dn = s[3] / s[2] * (t[1] / t[4]), s[4] / s[2] * (t[2] / t[4]), s[4] / s[3] * (t[3] / t[4])
  end
  r = (sn = sn, cn = cn, dn = dn, cd = cn / dn, cs = cn / sn, dc = dn / cn, ds = dn / sn,
       nc = 1 / cn, nd = 1 / dn, ns = 1 / sn, sc = sn / cn, sd = sn / dn)[kind]
  _collapse(r, _isreal(u) && _isreal(m))
end

# The Lerch transcendent: its defining series for |z| < 1; past the disc, the polylog identity for a whole a
# (Φ(z, s, n) = z^-n (Li_s(z) - Σ_{k<n} z^k k^-s)) and the Hurwitz one for z = -1 (2^-s (ζ(s, a/2) - ζ(s, (a+1)/2))).
function enumeratio_lerch(z, s, a)
  zc, sc, ac = _c(z), _c(s), _c(a)
  real_in = _isreal(z) && _isreal(s) && _isreal(a)
  zc == 1 && return _collapse(zeta(sc, ac), real_in)
  r = Float64(midpoint(abs(zc)))
  if r >= 1
    ok, n = unique_integer(real(ac))
    if ok && iszero(imag(ac)) && n >= 1
      partial = sum((zc^k * CC(k)^(-sc) for k in 1:Int(n) - 1); init = CC(0))
      return _collapse((polylog(sc, zc) - partial) / zc^Int(n), real_in)
    end
    zc == -1 && return _collapse((zeta(sc, ac / 2) - zeta(sc, (ac + 1) / 2)) / CC(2)^sc, real_in)
    error("no continuation past |z| = 1 for this a")
  end
  e = abs(Float64(midpoint(real(sc)))) + 1
  n = 8
  while n < 400_000 && log(max(r, 1e-300)) * n + e * log(n + abs(Float64(midpoint(real(ac)))) + 2) > -170
    n = 2n
  end
  total, power = CC(0), CC(1)
  for k in 0:n
    total += power * (ac + k)^(-sc)
    power *= zc
  end
  _collapse(total, real_in)
end

# ── number theory and counting ──

# Wolfram's shape: the sign as {-1, 1}, 1 as {1, 1}, 0 as {0, 1}.
function enumeratio_factor_integer(n)
  z = ZZ(n)
  iszero(z) && return [(ZZ(0), 1)]
  f = factor(z)
  out = Tuple{ZZRingElem,Int}[]
  (unit(f) == -1 || isone(z)) && push!(out, (unit(f), 1))
  for (p, e) in f
    push!(out, (p, e))
  end
  out
end

# ω, Ω and λ read off the factorization.
enumeratio_prime_nu(n) = length(factor(ZZ(n)))
enumeratio_prime_omega(n) = sum(e for (_, e) in factor(ZZ(n)); init = 0)
enumeratio_liouville(n) = iseven(enumeratio_prime_omega(n)) ? 1 : -1

# By Combinatorics.jl for whole arguments, by Γ(Σk + 1) / ΠΓ(k + 1) otherwise.
enumeratio_multinomial(ks::Integer...) = Combinatorics.multinomial(map(big, ks)...)
enumeratio_multinomial(ks...) =
  _collapse(gamma(sum(_c, ks) + 1) * prod(rgamma(_c(k) + 1) for k in ks), all(_isreal, ks))
enumeratio_subfactorial(n::Integer) = Combinatorics.subfactorial(big(n))
enumeratio_subfactorial(n) = enumeratio_ball((n) -> gamma(n + 1, CC(-1)) / const_e(RR), n)

# ── printing: a value as the scan reads it ──

# A ball too wide to vouch for its midpoint, or a NaN (a pole, or an argument reduction that lost all its
# digits), is tried again at more bits.
function oracle_eval(src)
  try
    for bits in (256, 1024, 8192)
      Nemo.set_precision!(Balls, bits)
      try
        shown = show_oracle(Core.eval(Main, Meta.parse(src)))
        occursin("NaN", shown) && bits < 8192 && continue
        return shown
      catch e
        (e isa ErrorException && e.msg == "ball too wide" && bits < 8192) || rethrow()
      end
    end
  finally
    Nemo.set_precision!(Balls, 256)
  end
end

show_oracle(x::AbstractFloat) = isnan(x) ? "NaN" : isinf(x) ? (x > 0 ? "PositiveInfinity" : "NegativeInfinity") : string(x)
show_oracle(x::Bool) = x ? "true" : "false"
show_oracle(x::Tuple) = "(" * join(map(show_oracle, x), ", ") * ")"
show_oracle(x::Pair) = show_oracle((x.first, x.second))

function _show_real(x::RealFieldElem)
  if !isfinite(x)
    s = string(x)
    return occursin("nan", s) || occursin("+/-", s) ? "NaN" : startswith(s, "-") ? "NegativeInfinity" : "PositiveInfinity"
  end
  accuracy_bits(x) >= 40 || radius(x) < 1e-15 || error("ball too wide")
  string(BigFloat(x))
end

show_oracle(x::RealFieldElem) = _show_real(x)
function show_oracle(x::ComplexFieldElem)
  re, im = _show_real(real(x)), _show_real(imag(x))
  iszero(imag(x)) && return re
  "(" * re * (startswith(im, "-") ? "-" * im[2:end] : "+" * im) * "j)"
end
