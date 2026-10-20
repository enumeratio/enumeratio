// What the `rust` emit templates call (a scan batch, src/bin/batch.rs, uses it all). An emitted expression nests arbitrarily, and Rust's
// types don't, so every value is a `V` — an integer, exact rational, float, boolean, list or
// p-adic — whose operators promote the way ours do (integers stay exact, a float makes the
// rest float). Every function is an adapter: it converts its arguments to what the crate
// wants and wraps the answer. No mathematics is reimplemented here.
#![allow(dead_code)]

use adic::normed::{Normed, UltraNormed, Valuation};
use adic::traits::{AdicPrimitive, HasDigits, PrimedFrom};
use adic::{EAdic, QAdic};
use num_bigint::BigInt;
use num_integer::Integer;
use num_rational::BigRational;
use num_traits::{One, Signed, ToPrimitive, Zero};
use std::ops::{Add, Div, Mul, Neg, Sub};
use std::panic::{catch_unwind, UnwindSafe};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

#[derive(Clone, Debug)]
pub enum V {
    Int(BigInt),
    Rat(BigRational),
    Float(f64),
    Bool(bool),
    List(Vec<V>),
    Adic(QAdic<EAdic>),
}
use V::*;

// ── literals ──────────────────────────────────────────────────────────────────

pub fn n(x: i64) -> V {
    Int(BigInt::from(x))
}
pub fn x(v: f64) -> V {
    Float(v)
}
pub fn big(digits: &str) -> V {
    Int(digits.parse().expect("an integer literal"))
}
pub fn list(items: Vec<V>) -> V {
    List(items)
}
/// What a crate's unsigned parameter says of an integer it can't hold.
fn unsigned_range(i: &BigInt) -> ! {
    if i.is_negative() {
        panic!("a non-negative integer: the crate's parameter is unsigned")
    } else {
        panic!("an integer below 2^64: the crate's parameter is a machine word")
    }
}
/// A computed float. A NaN or an infinity is a crate stepping outside its domain, or a double
/// overflowing: neither is an answer a comparison may count as agreeing, so it fails the item.
fn flt(v: f64) -> V {
    assert!(v.is_finite(), "non-finite result: {v}");
    Float(v)
}
pub fn rational(a: V, b: V) -> V {
    normal(BigRational::new(a.int(), b.int()))
}
fn normal(r: BigRational) -> V {
    if r.is_integer() {
        Int(r.to_integer())
    } else {
        Rat(r)
    }
}

/// `N`: an exact number as its float.
pub fn nf(v: V) -> V {
    match v {
        Int(_) | Rat(_) => flt(v.f64()),
        other => other,
    }
}

/// `N(x, d)` below another call: the float rounded to `d` significant digits.
pub fn nfd(v: V, d: i64) -> V {
    match v {
        List(items) => List(items.into_iter().map(|e| nfd(e, d)).collect()),
        other => {
            let text = format!("{:.*e}", (d.max(1) - 1) as usize, other.f64());
            flt(text.parse().expect("a float"))
        }
    }
}

// ── conversions the adapters use ──────────────────────────────────────────────

impl V {
    /// A list where a scalar is wanted is compute-engine's Listable threading, which the
    /// crates don't do; it fails as its own kind of error.
    fn scalar(&self) -> &V {
        if let List(_) = self {
            panic!("threading: a list where the crate takes a scalar");
        }
        self
    }
    pub fn int(&self) -> BigInt {
        match self.scalar() {
            Int(i) => i.clone(),
            Rat(r) if r.is_integer() => r.to_integer(),
            other => panic!("an integer, not {}", other.show()),
        }
    }
    pub fn i64(&self) -> i64 {
        self.int().to_i64().expect("an integer in i64")
    }
    pub fn u64(&self) -> u64 {
        let i = self.int();
        i.to_u64().unwrap_or_else(|| unsigned_range(&i))
    }
    pub fn usize(&self) -> usize {
        let i = self.int();
        i.to_usize().unwrap_or_else(|| unsigned_range(&i))
    }
    pub fn rat(&self) -> BigRational {
        match self.scalar() {
            Int(i) => BigRational::from_integer(i.clone()),
            Rat(r) => r.clone(),
            other => panic!("a rational, not {}", other.show()),
        }
    }
    pub fn f64(&self) -> f64 {
        match self.scalar() {
            Int(i) => i.to_f64().expect("a finite value"),
            Rat(r) => r.to_f64().expect("a finite value"),
            Float(f) => *f,
            other => panic!("a number, not {}", other.show()),
        }
    }
    pub fn adic(&self) -> QAdic<EAdic> {
        match self {
            Adic(a) => a.clone(),
            other => panic!("a p-adic number, not {}", other.show()),
        }
    }
}

// ── arithmetic, promoting Int < Rat < Float ───────────────────────────────────

/// Two operands as p-adics of the same prime, when either is one: a scalar is lifted.
fn adic_pair(a: &V, b: &V) -> Option<(QAdic<EAdic>, QAdic<EAdic>)> {
    let p = match (a, b) {
        (Adic(x), _) | (_, Adic(x)) => u32::from(x.p()),
        _ => return None,
    };
    let lift = |v: &V| match v {
        Adic(x) => x.clone(),
        other => QAdic::primed_from(p, other.rat()),
    };
    Some((lift(a), lift(b)))
}

fn arith(a: V, b: V, i: fn(BigInt, BigInt) -> V, r: fn(BigRational, BigRational) -> V, f: fn(f64, f64) -> f64) -> V {
    match (&a, &b) {
        (Int(p), Int(q)) => i(p.clone(), q.clone()),
        (Float(_), _) | (_, Float(_)) => flt(f(a.f64(), b.f64())),
        _ => r(a.rat(), b.rat()),
    }
}
impl Add for V {
    type Output = V;
    fn add(self, b: V) -> V {
        if let Some((p, q)) = adic_pair(&self, &b) {
            return Adic(p + q);
        }
        arith(self, b, |p, q| Int(p + q), |p, q| normal(p + q), |p, q| p + q)
    }
}
impl Sub for V {
    type Output = V;
    fn sub(self, b: V) -> V {
        arith(self, b, |p, q| Int(p - q), |p, q| normal(p - q), |p, q| p - q)
    }
}
impl Mul for V {
    type Output = V;
    fn mul(self, b: V) -> V {
        if let Some((p, q)) = adic_pair(&self, &b) {
            return Adic(p * q);
        }
        arith(self, b, |p, q| Int(p * q), |p, q| normal(p * q), |p, q| p * q)
    }
}
impl Div for V {
    type Output = V;
    fn div(self, b: V) -> V {
        if let Some((p, q)) = adic_pair(&self, &b) {
            return Adic(p / q);
        }
        // An exact quotient, as ours: 1/3 is a rational, not 0.333….
        arith(self, b, |p, q| normal(BigRational::new(p, q)), |p, q| normal(p / q), |p, q| p / q)
    }
}
impl Neg for V {
    type Output = V;
    fn neg(self) -> V {
        match self {
            Int(i) => Int(-i),
            Rat(r) => Rat(-r),
            Float(f) => Float(-f),
            other => panic!("negating {}", other.show()),
        }
    }
}
pub fn power(a: V, b: V) -> V {
    match (&a, &b) {
        (Int(p), Int(q)) if !q.is_negative() => Int(num_traits::pow(p.clone(), q.to_usize().expect("a small exponent"))),
        (Rat(_), Int(q)) | (Int(_), Int(q)) => {
            let base = a.rat();
            let e = q.to_i32().expect("a small exponent");
            normal(if e >= 0 { num_traits::pow(base, e as usize) } else { num_traits::pow(base.recip(), (-e) as usize) })
        }
        _ => flt(a.f64().powf(b.f64())),
    }
}
pub fn equal(a: V, b: V) -> V {
    Bool(match (&a, &b) {
        (Bool(p), Bool(q)) => p == q,
        (List(p), List(q)) => p.len() == q.len() && p.iter().zip(q).all(|(x, y)| matches!(equal(x.clone(), y.clone()), Bool(true))),
        // A float identity holds to the scan's own relative tolerance, not to the last bit; zero is
        // only equal to zero, as in the scan's comparison.
        (Float(_), _) | (_, Float(_)) => {
            let (p, q) = (a.f64(), b.f64());
            p == q || (p.is_finite() && q.is_finite() && (p - q).abs() <= 1e-9 * p.abs().max(q.abs()))
        }
        (Adic(p), Adic(q)) => p == q,
        _ => a.rat() == b.rat(),
    })
}

// ── std's float functions ─────────────────────────────────────────────────────

macro_rules! float_fn {
    ($($name:ident),*) => { $(pub fn $name(v: V) -> V { flt(v.f64().$name()) })* };
}
float_fn!(sin, cos, tan, exp, ln, sqrt, asin, acos, atan, sinh, cosh, tanh, asinh, acosh, atanh, log10, log2, cbrt);
pub fn atan2(y: V, x: V) -> V {
    flt(y.f64().atan2(x.f64()))
}
pub fn abs(v: V) -> V {
    match v.scalar() {
        Int(i) => Int(i.abs()),
        Rat(r) => Rat(r.abs()),
        _ => Float(v.f64().abs()),
    }
}
pub fn floor(v: V) -> V {
    match v.scalar() {
        Int(_) => v,
        Rat(r) => Int(r.floor().to_integer()),
        _ => Float(v.f64().floor()),
    }
}
pub fn ceil(v: V) -> V {
    match v.scalar() {
        Int(_) => v,
        Rat(r) => Int(r.ceil().to_integer()),
        _ => Float(v.f64().ceil()),
    }
}
/// Ties go away from zero, as num-rational's `round` and std's.
pub fn round(v: V) -> V {
    match v.scalar() {
        Int(_) => v,
        Rat(r) => Int(r.round().to_integer()),
        _ => Float(v.f64().round()),
    }
}
pub fn trunc(v: V) -> V {
    match v.scalar() {
        Int(_) => v,
        Rat(r) => Int(r.trunc().to_integer()),
        _ => Float(v.f64().trunc()),
    }
}
pub fn fract(v: V) -> V {
    match v.scalar() {
        Int(_) => n(0),
        Rat(r) => normal(r.fract()),
        _ => Float(v.f64().fract()),
    }
}
pub fn signum(v: V) -> V {
    match v.scalar() {
        Int(i) => Int(i.signum()),
        Rat(r) => Int(r.numer().signum()),
        // std's signum(0.0) is 1.0; zero is its own sign.
        _ if v.f64() == 0.0 => Float(0.0),
        _ => Float(v.f64().signum()),
    }
}
pub fn numerator(v: V) -> V {
    Int(v.rat().numer().clone())
}
pub fn denominator(v: V) -> V {
    Int(v.rat().denom().clone())
}

/// Exact between integers and rationals, as doubles once either is one.
fn order(a: &V, b: &V) -> std::cmp::Ordering {
    match (a.scalar(), b.scalar()) {
        (Float(_), _) | (_, Float(_)) => a.f64().partial_cmp(&b.f64()).expect("a comparable number"),
        _ => a.rat().cmp(&b.rat()),
    }
}
pub fn less(a: V, b: V) -> V {
    Bool(order(&a, &b).is_lt())
}
pub fn less_equal(a: V, b: V) -> V {
    Bool(order(&a, &b).is_le())
}
pub fn greater(a: V, b: V) -> V {
    Bool(order(&a, &b).is_gt())
}
pub fn greater_equal(a: V, b: V) -> V {
    Bool(order(&a, &b).is_ge())
}
pub fn maximum(a: V, b: V) -> V {
    if order(&a, &b).is_lt() {
        b
    } else {
        a
    }
}
pub fn minimum(a: V, b: V) -> V {
    if order(&a, &b).is_gt() {
        b
    } else {
        a
    }
}

// ── num-integer, num-bigint ───────────────────────────────────────────────────

pub fn gcd(a: V, b: V) -> V {
    Int(a.int().gcd(&b.int()))
}
pub fn lcm(a: V, b: V) -> V {
    Int(a.int().lcm(&b.int()))
}
pub fn mod_floor(a: V, b: V) -> V {
    Int(a.int().mod_floor(&b.int()))
}
pub fn binomial(a: V, b: V) -> V {
    Int(num_integer::binomial(a.int(), b.int()))
}
pub fn quotient(a: V, b: V) -> V {
    Int(a.int().div_floor(&b.int()))
}
pub fn mod_inverse(a: V, m: V) -> V {
    Int(a.int().modinv(&m.int()).expect("no modular inverse: the operands share a factor"))
}
/// `[g, x, y]` with `a x + b y = g`, flat as ours is.
pub fn extended_gcd(a: V, b: V) -> V {
    let e = a.int().extended_gcd(&b.int());
    List(vec![Int(e.gcd), Int(e.x), Int(e.y)])
}
pub fn is_coprime(a: V, b: V) -> V {
    Bool(a.int().gcd(&b.int()).is_one())
}
/// `a | b`.
pub fn divides(a: V, b: V) -> V {
    Bool(b.int().is_multiple_of(&a.int()))
}
pub fn is_even(v: V) -> V {
    Bool(v.int().is_even())
}
pub fn is_odd(v: V) -> V {
    Bool(v.int().is_odd())
}
/// The digits of |n| in the base, most significant first.
pub fn integer_digits(v: V, base: V) -> V {
    let radix = u32::try_from(base.u64()).expect("a base the crate takes");
    List(v.int().magnitude().to_radix_be(radix).into_iter().map(|d| n(d as i64)).collect())
}
pub fn from_digits(digits: V, base: V) -> V {
    let radix = u32::try_from(base.u64()).expect("a base the crate takes");
    let List(items) = &digits else { panic!("a list of digits") };
    let digits: Vec<u8> = items.iter().map(|d| u8::try_from(d.u64()).expect("a digit below 256")).collect();
    Int(BigInt::from_radix_be(num_bigint::Sign::Plus, &digits, radix).expect("digits below the base"))
}
pub fn powermod(a: V, e: V, m: V) -> V {
    let (a, e, m) = (a.int(), e.int(), m.int());
    // num-bigint's modpow panics on a negative exponent; invert first, like our own
    // PowerMod does, then raise the (now non-negative) exponent.
    if e.is_negative() {
        let inv = a.modinv(&m).expect("no modular inverse: base and modulus share a factor");
        Int(inv.modpow(&-e, &m))
    } else {
        Int(a.modpow(&e, &m))
    }
}

// ── primal, statrs ────────────────────────────────────────────────────────────

pub fn is_prime(v: V) -> V {
    Bool(primal::is_prime(v.u64()))
}
pub fn nth_prime(v: V) -> V {
    n(primal::StreamingSieve::nth_prime(v.usize()) as i64)
}
pub fn prime_pi(v: V) -> V {
    // A fixed cap, not the item's time cap: past it the count takes minutes, and whether a
    // host finishes in 30 s must not decide a row.
    assert!(v.usize() <= 10_000_000_000, "too large for the scan: the count is past what a sieve finishes in its time cap");
    n(primal::StreamingSieve::prime_pi(v.usize()) as i64)
}
pub fn next_prime(v: V) -> V {
    let from = v.usize();
    assert!(from <= 1_000_000_000, "a sieve to 2n would not fit in memory");
    // Bertrand: a prime lies in (n, 2n].
    let sieve = primal::Sieve::new(2 * from + 2);
    n(sieve.primes_from(from + 1).next().expect("a prime within the sieve") as i64)
}
/// The factorization as `(prime, exponent)` pairs, by a sieve to the square root.
fn factors(v: &V) -> Vec<(usize, usize)> {
    let at = v.usize();
    assert!(at > 0, "zero has no factorization");
    assert!(at <= 1_000_000_000_000_000_000, "a sieve to the square root would not fit in memory");
    let root = (at as f64).sqrt() as usize + 2;
    primal::Sieve::new(root).factor(at).expect("the sieve reaches the square root")
}
pub fn factor_integer(v: V) -> V {
    List(factors(&v).into_iter().map(|(p, e)| List(vec![n(p as i64), n(e as i64)])).collect())
}
pub fn prime_nu(v: V) -> V {
    n(factors(&v).len() as i64)
}
pub fn prime_omega(v: V) -> V {
    n(factors(&v).iter().map(|(_, e)| *e as i64).sum())
}
pub fn is_square_free(v: V) -> V {
    Bool(factors(&v).iter().all(|(_, e)| *e == 1))
}
pub fn is_prime_power(v: V) -> V {
    Bool(primal::as_prime_power(v.u64()).is_some())
}
pub fn is_composite(v: V) -> V {
    let at = v.u64();
    Bool(at > 1 && !primal::is_prime(at))
}
pub fn factorial(v: V) -> V {
    flt(statrs::function::factorial::factorial(v.u64()))
}
pub fn gamma(v: V) -> V {
    flt(statrs::function::gamma::gamma(v.f64()))
}
/// A statrs answer that may be an argument error, reported by name.
fn checked<E: std::fmt::Debug>(r: Result<f64, E>) -> V {
    match r {
        Ok(v) => flt(v),
        Err(e) => panic!("statrs: {e:?}"),
    }
}
pub fn upper_gamma(a: V, z: V) -> V {
    checked(statrs::function::gamma::checked_gamma_ui(a.f64(), z.f64()))
}
pub fn gamma_regularized(a: V, z: V) -> V {
    checked(statrs::function::gamma::checked_gamma_ur(a.f64(), z.f64()))
}
pub fn ln_gamma(v: V) -> V {
    flt(statrs::function::gamma::ln_gamma(v.f64()))
}
pub fn digamma(v: V) -> V {
    flt(statrs::function::gamma::digamma(v.f64()))
}
pub fn beta(a: V, b: V) -> V {
    checked(statrs::function::beta::checked_beta(a.f64(), b.f64()))
}
/// Takes the crate's order, `a`, `b`, then the point.
pub fn beta_regularized(a: V, b: V, x: V) -> V {
    checked(statrs::function::beta::checked_beta_reg(a.f64(), b.f64(), x.f64()))
}
pub fn inverse_beta_regularized(a: V, b: V, x: V) -> V {
    flt(statrs::function::beta::inv_beta_reg(a.f64(), b.f64(), x.f64()))
}
pub fn erf(v: V) -> V {
    flt(statrs::function::erf::erf(v.f64()))
}
pub fn erfc(v: V) -> V {
    flt(statrs::function::erf::erfc(v.f64()))
}
pub fn erf_inv(v: V) -> V {
    flt(statrs::function::erf::erf_inv(v.f64()))
}
pub fn erfc_inv(v: V) -> V {
    flt(statrs::function::erf::erfc_inv(v.f64()))
}
pub fn harmonic(v: V) -> V {
    flt(statrs::function::harmonic::harmonic(v.u64()))
}
pub fn generalized_harmonic(order: V, m: V) -> V {
    flt(statrs::function::harmonic::gen_harmonic(order.u64(), m.f64()))
}
/// E_n(x); the crate answers `None` for x < 0, or when its continued fraction does not converge.
pub fn exp_integral_e(order: V, x: V) -> V {
    flt(statrs::function::exponential::integral(x.f64(), order.u64()).expect("no value: x < 0, or no convergence"))
}

// ── the adic crate ────────────────────────────────────────────────────────────

pub fn adic(p: V, v: V) -> V {
    let p = p.u64();
    assert!(primal::is_prime(p), "the adic crate takes a prime base, not {p}");
    Adic(QAdic::primed_from(p as u32, v.rat()))
}
pub fn adic_valuation(v: V) -> V {
    match v.adic().valuation() {
        Valuation::Finite(k) => n(k as i64),
        // The zero adic's valuation is +∞, same as ours: print it the way our non-finite
        // floats already print (Show's Float branch), not a panic.
        Valuation::PosInf => Float(f64::INFINITY),
    }
}
pub fn adic_norm(v: V) -> V {
    let r = v.adic().norm();
    normal(BigRational::new(BigInt::from(*r.numer()), BigInt::from(*r.denom())))
}
pub fn adic_prime(v: V) -> V {
    n(u32::from(v.adic().p()) as i64)
}
/// The first `count` digits of the unit part, least significant first. The crate's iterator stops
/// where an expansion terminates; the digits after it are zeros.
pub fn adic_digits(v: V, count: V) -> V {
    let unit = v.adic().unit().expect("a non-zero p-adic has a unit part");
    let count = count.usize();
    assert!(count <= 100_000, "too many digits to ask for");
    let mut digits: Vec<V> = unit.digits().take(count).map(|d| n(d as i64)).collect();
    digits.resize(count, n(0));
    List(digits)
}

/// A p-adic printed as ours is written, `["AdicNumeral",p,value]`: its exact rational value
/// read back from the crate (the unit's `rational_value` times p^valuation).
fn adic_mathjson(a: &QAdic<EAdic>) -> String {
    let p = u32::from(a.p()) as i64;
    let value = match (a.unit(), a.valuation()) {
        (Some(u), Valuation::Finite(k)) => {
            let r = u.rational_value().expect("an exact rational");
            let unit = BigRational::new(BigInt::from(*r.numer()), BigInt::from(*r.denom()));
            let scale = num_traits::pow(BigRational::from_integer(BigInt::from(p)), k.unsigned_abs() as usize);
            if k >= 0 { unit * scale } else { unit / scale }
        }
        _ => BigRational::from_integer(BigInt::zero()),
    };
    let json = if value.is_integer() {
        value.to_integer().to_string()
    } else {
        format!("[\"Rational\",{},{}]", value.numer(), value.denom())
    };
    format!("[\"AdicNumeral\",{p},{json}]")
}

// ── printing, and the per-item harness ────────────────────────────────────────

pub trait Show {
    fn show(&self) -> String;
}
impl Show for V {
    fn show(&self) -> String {
        match self {
            Int(i) => i.to_string(),
            Rat(r) => format!("{}/{}", r.numer(), r.denom()),
            // Our side prints the non-finite values by name.
            Float(f) if f.is_nan() => "NaN".into(),
            Float(f) if f.is_infinite() => (if *f > 0.0 { "PositiveInfinity" } else { "NegativeInfinity" }).into(),
            Float(f) => format!("{f:?}"),
            Bool(b) => b.to_string(),
            List(items) => format!("[{}]", items.iter().map(Show::show).collect::<Vec<_>>().join(", ")),
            Adic(a) => adic_mathjson(a),
        }
    }
}

/// Seconds one item may run, as `ITEM_SECONDS` in `src/run.ts`.
const ITEM_SECONDS: u64 = 30;

/// Run one item, printing `<<i>>value`, or `<<i>>!!message` when it panics or runs over
/// `ITEM_SECONDS`. A runaway item can't be stopped, so the process ends after reporting it and
/// the scan resumes with the next item.
pub fn item<F: FnOnce() -> V + UnwindSafe + Send + 'static>(i: usize, f: F) {
    std::panic::set_hook(Box::new(|_| {})); // the message is reported below, not on stderr
    let (tx, rx) = mpsc::channel();
    // Deep recursion in a kernel needs more than a spawned thread's default stack.
    thread::Builder::new()
        .stack_size(256 << 20)
        .spawn(move || {
            let _ = tx.send(catch_unwind(f));
        })
        .expect("a thread for the item");
    match rx.recv_timeout(Duration::from_secs(ITEM_SECONDS)) {
        Ok(Ok(v)) => println!("<<{i}>>{}", v.show()),
        Ok(Err(e)) => {
            let msg = e
                .downcast_ref::<String>()
                .cloned()
                .or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string()))
                .unwrap_or_default();
            println!("<<{i}>>!!panic: {}", msg.replace('\n', " "));
        }
        Err(_) => {
            println!("<<{i}>>!!TimeoutError: over {ITEM_SECONDS} s");
            std::process::exit(0);
        }
    }
}

#[allow(unused)]
fn _zero_used() -> bool {
    BigInt::zero().is_zero()
}
