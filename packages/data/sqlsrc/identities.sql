-- requires: realizer, references
-- base_function: the curated "named math identity" ledger — the registry gap wiki/Catalog-Audit.md names directly
-- ("we have no identity ledger — the 'one identity, many roles' thesis"). A retired math_* naming convention was
-- this ledger implicitly (pre-2026-08 C-extension); the individual functions survived un-prefixed in the pure-SQL
-- rewrite, the central registry didn't. Distinct from base_operation/base_structure (algebra.sql) — that registry
-- is which ALGEBRAIC STRUCTURES a TYPE belongs to (15 fixed operators: add, mul, le, …); this is a catalog of
-- named IDENTITIES (catalan_number, stirling1, gcd, …), each backed by one or more IMPLEMENTATIONS —
-- function_impls.sql's base_function_impl, loaded right after this file — rather than a fixed sql_fn/ts_export
-- pair inline here (#278 increment 2: a function can have multiple impls per engine at different
-- representations, e.g. factorial vs the bigint-exact factorial_bigint, or none at all on one engine, e.g. lcm
-- is TS-only).
--
-- `id` is a curated slug, decoupled from every impl pointer — mirrors base_map's map_id/mapping_fn split, so a
-- rename of an impl never cascades through every attribute/reference row naming this identity. This split is
-- load-bearing, not decorative: lehmer_code below is the concrete case where it matters — a SQL function named
-- `lehmer_code` already exists (lehmer_codes.sql), but it SERIALIZES an already-built permutation_inversion to
-- text; the actual encoding computation TS's lehmer_code() twins is `to_inversion`. Naming this row's pg impl
-- 'lehmer_code' by string-matching the id would silently point at the wrong function. It's also decoupled from
-- TYPE-HINT suffixes on an impl name specifically: gcd/lcm/pow are curated here without their `_int` suffix even
-- though every impl_ref pointing at them keeps it (gcd_int, lcm_int, pow_int) — the suffix documents an
-- implementation detail (int arithmetic) that the identity itself (gcd, lcm, pow) doesn't need to carry, and
-- renaming the live SQL/TS functions themselves is out of scope here.
--
-- Mechanical facts (arity, variadic-ness, the live function body) are NEVER stored here — always derived via
-- pg_proc/AST introspection at docs-build time (docs/develop/data/functions.data.ts), the same "curate the
-- pointer, introspect the rest" split base_stat/base_map already use.
CREATE TABLE base_function (
  id          text PRIMARY KEY,        -- curated identity slug, e.g. 'catalan_number', 'stirling1', 'lcm'
  title       text,
  description text NOT NULL,
  pack        text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack
);
CREATE TRIGGER base_function_pack_guard BEFORE UPDATE OR DELETE ON base_function FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

-- base_function_attribute: named FUNCTION-level capabilities, mirroring base_trait's shape (id/title/description/
-- implies) rather than base_structure.axioms text[] (unstructured strings nothing reads — confirmed zero
-- references outside algebra.sql). The vocabulary is Wolfram Language's function-attribute set, but named for the
-- PROPERTY each one is (a property of a function) rather than WL's own keyword: associativity (WL Flat),
-- commutativity (WL Orderless), threadability (WL Listable), idempotency, and one_identity (WL OneIdentity). The
-- WL keyword is kept in each title/description as a cross-reference, see reference.wolfram.com/language/ref/Flat.html
-- and siblings. associativity/commutativity/idempotency/threadability describe N-ARY ENDO-OPERATIONS
-- ONLY (arity ≥ 2, return type = an argument type being recombined) — gcd/gaussian_add-shaped, never
-- catalan_number/stirling1-shaped (a counting sequence, or a function whose args and return type differ, doesn't
-- type-check for "regroup the same operands"). This is a CURATION GUIDELINE, checked below by a base_example
-- against pg_proc.pronargs, not a DB CHECK (Postgres can't self-inspect another function's own signature against
-- a curated attribute row without a trigger).
--
-- The polytope correspondence (side table below) is optional, EXPLORATORY framing new to this repo (not a
-- previously documented correspondence, confirmed by full-text search of sqlsrc + wiki): associativity ↔ the
-- Associahedron — every bracketing of an n-ary endo-operation's operands is a distinct Associahedron vertex
-- (binary-tree shape / dissection); associativity means they all collapse to the same value. commutativity ↔ the
-- Permutahedron — every ordering is a distinct vertex; commutativity means they all collapse. Both vertex
-- correspondences are standard combinatorics; their pairing with these properties is this project's own synthesis.
-- Treat as decoration on the docs page ("corresponds to"), never as a proof the schema enforces — idempotency /
-- threadability / one_identity have no such correspondence (the side table simply omits them).
CREATE TABLE base_function_attribute (
  id          text PRIMARY KEY,        -- descriptive property nouns: 'associativity','commutativity','threadability','idempotency','one_identity'
  title       text,
  description text NOT NULL,
  implies     text[] NOT NULL DEFAULT '{}'
);

-- The polytope correspondence itself is a SIDE TABLE (#283 phase 2.2, §3.3's pack-contract precedent), not a
-- column on base_function_attribute: both curated correspondences ('associativity'→associahedron, 'commutativity'→
-- permutahedron) name packs/polytopes collections, and a pack may only INSERT rows, never UPDATE a row core
-- already inserted — so the pairing is populated from packs/polytopes/identities.polytopes.sql, joined in at
-- read time (docs/develop/data/functions.data.ts). Empty here when polytopes isn't loaded; the docs page's
-- "corresponds to" decoration just doesn't render, same graceful-absence shape as an unmounted profile.
CREATE TABLE base_function_attribute_polytope (
  attribute  text NOT NULL REFERENCES base_function_attribute,
  collection text NOT NULL REFERENCES base_collection,
  PRIMARY KEY (attribute, collection)
);

-- function ↔ attribute, the editorial assignments (mirrors base_collection_trait_manual). FK on both sides
-- catches a typo'd id at load time.
CREATE TABLE base_function_attribute_manual (
  function  text NOT NULL REFERENCES base_function,
  attribute text NOT NULL REFERENCES base_function_attribute,
  PRIMARY KEY (function, attribute)
);

INSERT INTO base_function_attribute (id, title, description, implies) VALUES
  ('associativity', 'Associativity (WL Flat)',
   'f(f(a,b),f(c,d)) = f(a,b,c,d) for any bracketing — Wolfram Language calls this Flat. For an n-ary '
   'endo-operation, every bracketing of the same operands is a distinct Associahedron vertex; associativity '
   'means they all collapse to one value.', '{}'),
  ('commutativity', 'Commutativity (WL Orderless)',
   'Argument order doesn''t matter — Wolfram Language calls this Orderless. For an n-ary endo-operation, '
   'every ordering of the same operands is a distinct Permutahedron vertex; commutativity means they all '
   'collapse.', '{}'),
  ('idempotency', 'Idempotency',
   'The idempotent (semilattice) law x∘x = x — combining an operand with itself yields it unchanged. Sits '
   'beside associativity + commutativity: an operation with all three is a semilattice (gcd/lcm are the '
   'meet/join of the divisibility lattice). Distinct from Wolfram OneIdentity (below) and from the unary '
   'compose-twice law f(f(x)) = f(x) that arity-1 functions/maps carry.', '{}'),
  ('threadability', 'Threadability (WL Listable)',
   'Automatically threads elementwise over lists/arrays in argument position — f({a,b},{c,d}) = '
   '{f(a,c),f(b,d)}. Wolfram Language calls this Listable. No identity below is curated with it yet (no '
   'current SQL impl provides an array-threading overload) — vocabulary, ready for one that does.', '{}'),
  ('one_identity', 'One-identity (WL OneIdentity)',
   'The single-argument application of a variadic head collapses to its argument: f(x) ≡ x (e.g. Add[x] → x). '
   'Wolfram Language calls this OneIdentity; it is a REWRITE/pattern-matching rule, not idempotency (Plus has '
   'OneIdentity yet 1+1 ≠ 1, and idempotent Abs has no OneIdentity — the two are orthogonal). Kept as its own '
   'property because the IR wants exactly this normalization (Head[x] → x) for substitution. No identity below '
   'is curated with it yet — vocabulary.', '{}');

-- Curation batch 1 — 28 identities covering packages/math's ~45 exported functions (see function_impls.sql for
-- the 59 impl rows backing them — every one with a real bare-callable SQL function, a packages/math TS twin, or
-- both; lcm is TS-only). factorial_bigint and binomial_bigint are NOT separate identities here — they were in
-- the original 30-row batch, back when the inline sql_fn/ts_export pair left nowhere else to put a second impl;
-- they're now impl rows (representation 'bigint') on factorial/binomial. Deliberately EXCLUDED from this batch
-- (follow-up: the GitHub issue tracking this registry): every "No bare SQL fn (generic dispatch)" rank/unrank
-- export (integerPartitionRank/Unrank/KRank/KUnrank, rgsRank/Unrank, setPartitionsIntoKBlocksRank/Unrank,
-- permutation_rank, composition_rank) — these are the READ direction of a bijection whose SQL side is dispatched
-- generically through unrank(<collection>(...), r), not a separately named identity; gaussian_sub/multicomplex_sub (each
-- file's own comment: "defined as a + (-b) there too" — definitional, not a distinct identity); and
-- countSurjections/setCompositionRank/setCompositionUnrank (the only SQL counterpart,
-- set_composition_surjections(n,k), is an ENUMERATOR — SETOF int[] — not a scalar count/rank function; the shape
-- doesn't match cleanly enough to curate without guessing).
INSERT INTO base_function (id, title, description) VALUES
  ('catalan_number', 'Catalan number',
   'Cₖ = C(2k,k)/(k+1) — counts balanced bracketings, binary trees, Dyck paths, and triangulations of a convex '
   '(k+2)-gon.'),
  ('little_schroder_number', 'Little Schröder (super-Catalan) number',
   's(m) — counts dissections of a convex polygon by non-crossing diagonals, among other bracketing-adjacent '
   'structures. 1, 1, 3, 11, 45, 197, …'),
  ('factorial', 'Factorial',
   'n! = 1·2·…·n — counts permutations of n distinct objects. factorial() switches to floating precision loss '
   'beyond n=18; an exact-bigint variant is also available (impl representation ''bigint'', valid through n=20).'),
  ('binomial', 'Binomial coefficient',
   'C(n,k) — the number of k-subsets of an n-set. An exact-bigint variant is also available (impl representation '
   '''bigint'', via an interleaved product/quotient — no intermediate rounding).'),
  ('bell', 'Bell number', 'B(n) — the number of set partitions of an n-set.'),
  ('fubini', 'Fubini (ordered Bell) number', 'a(n) — the number of set compositions (ordered set partitions) of '
   'an n-set.'),
  ('stirling_second', 'Stirling number of the second kind',
   'S(n,k) — the number of set partitions of an n-set into exactly k blocks.'),
  ('partition_number', 'Partition number', 'p(n) — the number of integer partitions of n.'),
  ('gcd', 'Greatest common divisor', 'gcd(a,b) via Euclid''s algorithm, always non-negative.'),
  ('lcm', 'Least common multiple', 'lcm(a,b) = |a·b| / gcd(a,b), 0 if either input is 0.'),
  ('pow', 'Integer power', 'bᵉ via exact repeated integer multiplication (no float ^ scaling/rounding).'),
  ('double_factorial_odd', 'Double factorial (odd)', '(2n-1)!! = 1·3·5·…·(2n-1).'),
  ('gaussian_add', 'Gaussian integer addition',
   'Componentwise addition on ℤ[i]: (a+bi) + (c+di) = (a+c) + (b+d)i — the additive group operation.'),
  ('gaussian_mul', 'Gaussian integer multiplication',
   '(a+bi)(c+di) = (ac-bd) + (ad+bc)i — the commutative-ring multiplication on ℤ[i].'),
  ('gaussian_neg', 'Gaussian integer negation', '-(a+bi) = -a-bi — the additive inverse on ℤ[i].'),
  ('gaussian_norm', 'Gaussian integer norm', 'N(a+bi) = a²+b² — the multiplicative Euclidean gauge on ℤ[i].'),
  ('multicomplex_add', 'Multicomplex addition', 'Componentwise addition mod M on the multicomplex ring ℂₙ(ℤ/Mℤ).'),
  ('multicomplex_mul', 'Multicomplex multiplication',
   'XOR-convolution with a Thue–Morse overlap sign: out[i⊻j] += (−1)^popcount(i∧j)·a[i]·b[j] (mod M).'),
  ('multicomplex_neg', 'Multicomplex negation', 'Componentwise negation mod M.'),
  ('multicomplex_conj', 'Multicomplex conjugation', 'Flips every "odious" (odd-popcount-indexed) coefficient''s sign.'),
  ('multicomplex_norm', 'Multicomplex norm',
   'N(z) = det of the multiplication-by-z map on ℂₙ(ℤ/Mℤ) as a free rank-2ⁿ module — the algebra norm, '
   'multiplicative, computed through the tower as N(z) = N_{ℂₙ₋₁}(u² + v²) for z = u + iₙ·v. Reduces to a²+b² at '
   'n = 1. NOT z·conj(z), which keeps a j₃ part once n ≥ 2 (the unit signature is mixed).'),
  ('multicomplex_inverse', 'Multicomplex inverse',
   'z⁻¹ in ℂₙ(ℤ/Mℤ), or nothing: z is a unit exactly when its norm is invertible mod M (coprimality, not '
   'non-vanishing). Built from z·(u − iₙ·v) = u² + v² recursively down the tower.'),
  ('multicomplex_popcount', 'Popcount', 'The Hamming weight of a non-negative bitmask (0..30 bits) — the sign exponent '
   'multicomplex multiplication is built from.'),
  ('composition_from_mask', 'Composition from gap-cut mask',
   'The bijection: an integer composition of n ↔ a subset of the n-1 gaps between n unit cells (the mask IS the '
   'rank).'),
  ('permutation_unrank', 'Permutation unrank (lexicographic)',
   'The r-th permutation of [n] in lexicographic order — Lehmer-code decode.'),
  ('lehmer_code', 'Lehmer code',
   'L[i] = #{ j > i : perm[j] < perm[i] } for every position — the inversion table of a permutation. SQL twin '
   'is to_inversion(p).code, NOT the SQL function literally named lehmer_code() (that one serializes an '
   'already-built permutation_inversion to text — a naming collision with this identity, not a match). The SQL '
   'array is length n-1 (the always-0 trailing entry is dropped from the stored carrier); the TS array matches '
   '(#293). Lehmer codes embed into factoradics, which keep the trailing place — the drop is Lehmer-specific.'),
  ('descents', 'Descents',
   'Positions i with σ(i) > σ(i+1). The Eulerian statistic — its distribution over Sₙ is the Eulerian triangle.'),
  ('fixed_points', 'Fixed points',
   'Positions with σ(i) = i. Zero of them is a derangement; the distribution is the rencontres triangle.'),
  ('cycle_count', 'Number of cycles',
   'Orbits of σ acting on [n]. The distribution over Sₙ is the unsigned Stirling numbers of the first kind.'),
  ('inversions', 'Inversions (Coxeter length)',
   'The number of pairs out of order in a permutation — the sum of its Lehmer code, and its Coxeter length.'),
  ('stirling1', 'Unsigned Stirling number of the first kind',
   'c(n,k) — the number of permutations of n elements having exactly k cycles.'),
  ('eulerianA', 'Eulerian number', 'A(n,k) — the number of permutations of n elements having exactly k descents.');
-- integer_partition_k_count (p(n,k)) moved to the partitions-plus pack (identities.partitions-plus.sql, #283) —
-- every base_function needs at least one impl row at load time (the floor check below), and its only impl
-- (k_part_partition_count) lives in that pack's k_part_partitions.sql.

-- Attribute assignments — every one below is independently demonstrated (not just asserted) by a base_example
-- further down. gcd/lcm: associative + commutative + idempotent — they're the meet/join of the divisibility
-- lattice, so all three semilattice laws hold (gcd(a,a)=a, lcm(a,a)=a). gaussian_add/gaussian_mul: ℤ[i] is a
-- commutative ring — both operations are associative + commutative (NOT idempotent: a+a=2a). multicomplex_add:
-- componentwise mod-M addition, associative + commutative (not idempotent). multicomplex_mul: COMMUTATIVITY ONLY —
-- commutativity is proved algebraically below (swapping a,b relabels the same sum, since AND and popcount are
-- symmetric in their operands) and demonstrated live; associativity of this specific XOR-convolution/Thue-Morse-
-- cocycle construction is NOT verified here and is deliberately left unassigned rather than guessed (Cayley-
-- Dickson-style doubling constructions are known to lose associativity at exactly this kind of higher dimension —
-- asserting associativity without proof would be worse than leaving it uncurated).
INSERT INTO base_function_attribute_manual (function, attribute) VALUES
  ('gcd', 'associativity'), ('gcd', 'commutativity'), ('gcd', 'idempotency'),
  ('lcm', 'associativity'), ('lcm', 'commutativity'), ('lcm', 'idempotency'),
  ('gaussian_add', 'associativity'), ('gaussian_add', 'commutativity'),
  ('gaussian_mul', 'associativity'), ('gaussian_mul', 'commutativity'),
  ('multicomplex_add', 'associativity'), ('multicomplex_add', 'commutativity'),
  ('multicomplex_mul', 'commutativity');
  -- everything else above: no attribute rows — proves attributes are optional (factorial/catalan_number/etc.
  -- are all zero-attribute cases: counting sequences and non-endo functions, not combining operations)

-- Cross-system references — authored directly with subject_kind='function' (no single dominant external system
-- the way FindStat is for maps, so no new convenience column; base_reference already anticipates 'wolfram' as a
-- system value, unused until now). Conservative: only identities with a citation I'm confident is correct are
-- included here — no fabricated A-numbers or WL symbol names for the rest; the remaining 19 curated rows above
-- can gain references incrementally without a schema change.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta, relation) VALUES
  ('function','catalan_number','oeis','A000108','https://oeis.org/A000108','','isomorphic'),
  ('function','catalan_number','wolfram','CatalanNumber','https://reference.wolfram.com/language/ref/CatalanNumber.html','','isomorphic'),
  ('function','little_schroder_number','oeis','A001003','https://oeis.org/A001003','','isomorphic'),
  ('function','factorial','wolfram','Factorial','https://reference.wolfram.com/language/ref/Factorial.html','','isomorphic'),
  ('function','factorial','mathlib4','Nat.factorial','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Nat/Factorial/Basic.html','','isomorphic'),
  ('function','binomial','wolfram','Binomial','https://reference.wolfram.com/language/ref/Binomial.html','','isomorphic'),
  ('function','bell','oeis','A000110','https://oeis.org/A000110','','isomorphic'),
  ('function','bell','wolfram','BellB','https://reference.wolfram.com/language/ref/BellB.html','','isomorphic'),
  ('function','fubini','oeis','A000670','https://oeis.org/A000670','','isomorphic'),
  ('function','partition_number','oeis','A000041','https://oeis.org/A000041','','isomorphic'),
  ('function','partition_number','wolfram','PartitionsP','https://reference.wolfram.com/language/ref/PartitionsP.html','','isomorphic'),
  ('function','stirling_second','wolfram','StirlingS2','https://reference.wolfram.com/language/ref/StirlingS2.html','','isomorphic'),
  ('function','stirling1','wolfram','StirlingS1','https://reference.wolfram.com/language/ref/StirlingS1.html',
   'WL StirlingS1 is SIGNED; stirling1 here is the UNSIGNED cycle-count c(n,k) = |StirlingS1(n,k)|','isomorphic');

-- the sql_fn-integrity and arity-2 attribute checks that used to live here now live in function_impls.sql, over
-- base_function_impl — the join table replaced the columns they were checking.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('base_function','gcd_int is associative on a sample triple (associativity, demonstrated not just asserted)',
   'eq','true',NULL,$q$
     SELECT (gcd_int(gcd_int(12,18),30) = gcd_int(12,gcd_int(18,30)))::text $q$),
  ('base_function','gcd_int is commutative on a sample pair (commutativity, demonstrated not just asserted)',
   'eq','true',NULL,$q$ SELECT (gcd_int(12,18) = gcd_int(18,12))::text $q$),
  ('base_function','gcd_int is idempotent: gcd(a,a)=a (idempotency, demonstrated not just asserted)',
   'eq','true',NULL,$q$ SELECT (gcd_int(18,18) = 18)::text $q$),
  ('base_function','gaussian_add is commutative on a sample pair (commutativity, demonstrated not just asserted)',
   'eq','true',NULL,$q$
     SELECT (gaussian_add(ROW(2,3)::gaussian_integer, ROW(1,-4)::gaussian_integer)
             = gaussian_add(ROW(1,-4)::gaussian_integer, ROW(2,3)::gaussian_integer))::text $q$),
  ('base_function','gaussian_mul is commutative on a sample pair (commutativity, demonstrated not just asserted)',
   'eq','true',NULL,$q$
     SELECT (gaussian_mul(ROW(2,3)::gaussian_integer, ROW(1,-4)::gaussian_integer)
             = gaussian_mul(ROW(1,-4)::gaussian_integer, ROW(2,3)::gaussian_integer))::text $q$),
  ('base_function','multicomplex_mul is commutative on a sample pair (commutativity, demonstrated — associativity deliberately NOT claimed)',
   'eq','true',NULL,$q$
     SELECT (multicomplex_mul(ROW(ARRAY[2,3],97)::multicomplex, ROW(ARRAY[5,7],97)::multicomplex)
             = multicomplex_mul(ROW(ARRAY[5,7],97)::multicomplex, ROW(ARRAY[2,3],97)::multicomplex))::text $q$);
