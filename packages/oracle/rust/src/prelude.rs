// What the `rust` emit templates call. An emitted expression nests arbitrarily, and Rust's
// types don't, so every value is a `V` — an integer, exact rational, float, boolean, list or
// p-adic — whose operators promote the way ours do (integers stay exact, a float makes the
// rest float). Every function is an adapter: it converts its arguments to what the crate
// wants and wraps the answer. No mathematics is reimplemented here.
#![allow(dead_code)]

use adic::normed::{Normed, UltraNormed, Valuation};
use adic::traits::{AdicPrimitive, PrimedFrom};
use adic::{EAdic, QAdic};
use num_bigint::BigInt;
use num_integer::Integer;
use num_rational::BigRational;
use num_traits::{Signed, ToPrimitive, Zero};
use std::ops::{Add, Div, Mul, Neg, Sub};
use std::panic::{catch_unwind, UnwindSafe};

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
        self.int().to_u64().expect("a non-negative integer")
    }
    pub fn usize(&self) -> usize {
        self.int().to_usize().expect("a non-negative integer")
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

fn arith(a: V, b: V, i: fn(BigInt, BigInt) -> V, r: fn(BigRational, BigRational) -> V, f: fn(f64, f64) -> f64) -> V {
    match (&a, &b) {
        (Int(p), Int(q)) => i(p.clone(), q.clone()),
        (Float(_), _) | (_, Float(_)) => Float(f(a.f64(), b.f64())),
        _ => r(a.rat(), b.rat()),
    }
}
impl Add for V {
    type Output = V;
    fn add(self, b: V) -> V {
        if let (Adic(p), Adic(q)) = (&self, &b) {
            return Adic(p.clone() + q.clone());
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
        if let (Adic(p), Adic(q)) = (&self, &b) {
            return Adic(p.clone() * q.clone());
        }
        arith(self, b, |p, q| Int(p * q), |p, q| normal(p * q), |p, q| p * q)
    }
}
impl Div for V {
    type Output = V;
    fn div(self, b: V) -> V {
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
        _ => Float(a.f64().powf(b.f64())),
    }
}
pub fn equal(a: V, b: V) -> V {
    Bool(match (&a, &b) {
        (Bool(p), Bool(q)) => p == q,
        (List(p), List(q)) => p.len() == q.len() && p.iter().zip(q).all(|(x, y)| matches!(equal(x.clone(), y.clone()), Bool(true))),
        (Float(_), _) | (_, Float(_)) => a.f64() == b.f64(),
        _ => a.rat() == b.rat(),
    })
}

// ── std's float functions ─────────────────────────────────────────────────────

macro_rules! float_fn {
    ($($name:ident),*) => { $(pub fn $name(v: V) -> V { Float(v.f64().$name()) })* };
}
float_fn!(sin, cos, tan, exp, ln, sqrt);
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
pub fn powermod(a: V, e: V, m: V) -> V {
    Int(a.int().modpow(&e.int(), &m.int()))
}

// ── primal, statrs ────────────────────────────────────────────────────────────

pub fn is_prime(v: V) -> V {
    Bool(primal::is_prime(v.u64()))
}
pub fn nth_prime(v: V) -> V {
    n(primal::StreamingSieve::nth_prime(v.usize()) as i64)
}
pub fn prime_pi(v: V) -> V {
    n(primal::StreamingSieve::prime_pi(v.usize()) as i64)
}
pub fn factorial(v: V) -> V {
    Float(statrs::function::factorial::factorial(v.u64()))
}
pub fn gamma(v: V) -> V {
    Float(statrs::function::gamma::gamma(v.f64()))
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
        other => panic!("valuation {other:?}"),
    }
}
pub fn adic_norm(v: V) -> V {
    let r = v.adic().norm();
    normal(BigRational::new(BigInt::from(*r.numer()), BigInt::from(*r.denom())))
}
pub fn adic_prime(v: V) -> V {
    n(u32::from(v.adic().p()) as i64)
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
            Adic(a) => a.to_string(),
        }
    }
}

/// Run one item, printing `<<i>>value`, or `<<i>>!!message` when it panics.
pub fn item<F: FnOnce() -> V + UnwindSafe>(i: usize, f: F) {
    std::panic::set_hook(Box::new(|_| {})); // the message is reported below, not on stderr
    match catch_unwind(f) {
        Ok(v) => println!("<<{i}>>{}", v.show()),
        Err(e) => {
            let msg = e
                .downcast_ref::<String>()
                .cloned()
                .or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string()))
                .unwrap_or_default();
            println!("<<{i}>>!!panic: {}", msg.replace('\n', " "));
        }
    }
}

#[allow(unused)]
fn _zero_used() -> bool {
    BigInt::zero().is_zero()
}
