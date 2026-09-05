-- requires: number-theory, integer_factorizations, utilities, tags, realizer
-- requires-tag: collection
-- (the safe late anchor, per set_builders.sql: the registration below reads base_collection as a one-shot
-- INSERT ... SELECT snapshot, not a view, so every numeric collection must already be registered before this
-- file runs, wherever its own file happens to sort.)
-- number.stats.sql — the numeric-carrier statistics layer (issue #169). 82 of the catalog's collections sit on
-- the plain `numeric` carrier (natural_numbers, prime_numbers, the figurate/recurrence/digit-based/divisor-sum
-- families, …) and had ZERO registered statistics. catalog-resolution.sql deliberately restricts carrier-level
-- stat INHERITANCE to COMPOSITE carriers (pg_type.typtype = 'c'): blanket-inheriting a stat across every
-- collection sharing the bare `numeric` carrier would be wrong (a subset's cardinality stat has no business on
-- prime_numbers). That gate is untouched here — this file adds no numeric branch to base_stat_resolved's
-- cross-collection inheritance; every row below is a per-collection OWN registration.
--
-- GATING MECHANISM (the least-invasive option — flag for the maintainer to confirm/adjust): every carrier =
-- 'numeric' collection is auto-tagged 'integer_sequence' by tags.sql's derived-tag closure
-- (`SELECT id, 'integer_sequence' FROM base_collection WHERE carrier = 'numeric'`), so registering PER-COLLECTION
-- base_stat rows over `base_collection_tag WHERE tag = 'integer_sequence'` lights up exactly the numeric families
-- through DATA — no new inheritance code, no per-collection hand-wiring, fully reversible (delete this file and
-- all 82 collections go back to zero stats). The tag alone is NOT carrier-precise, though: hyperbinary_representations
-- also carries 'integer_sequence' (via the 'recurrence' tag's `implies`), but its carrier is the composite
-- hyperbinary_word, not scalar numeric — so the registration below additionally filters on
-- base_collection.carrier = 'numeric' directly, which is both the semantically-correct gate and the one that
-- keeps every value_fn below type-checking against the element it's applied to.
--
-- KNOWN CONFLICT (flag for the maintainer): catalog-resolution.sql's self-cert example "inheritance is
-- carrier-gated: the numeric families do NOT cross-inherit" asserts `count(*) FROM base_stat_resolved WHERE
-- collection = 'natural_numbers'` = 0. That assertion held only because no numeric collection had ever registered
-- its OWN stats — base_stat_resolved's `s.collection = c.id` branch is unconditional (a collection's own rows
-- always surface; only the CROSS-collection composite-carrier branch is gated). Registering natural_numbers' own
-- stats is the entire point of issue #169, so that example now fails. Its assertion is stale and needs a maintainer
-- update to something that still proves the real invariant — e.g. "every resolved stat on a numeric collection has
-- own = true" (cross-carrier inheritance stays off; only direct registration lights numeric collections up). NOT
-- fixed here, per the constraint against editing catalog-resolution.sql — `node run.mts` will show exactly this
-- one pre-existing failure alongside this file's own (passing) examples.
--
-- STATS: reuses what already exists rather than duplicating it. big_omega/little_omega (Ω/ω) already live in
-- number-theory.sql and already take a bare `numeric` — registered as-is. decimal_digit_sum (harshad_numbers.sql)
-- and binary_popcount (evil_numbers.sql) are reused the same way pernicious_numbers.sql already reuses
-- binary_popcount across files. divisor_count/divisor_sum (τ = σ₀, σ = σ₁) delegate to integer_factorizations.sql's
-- divisors_count/divisors_sum via factored(n) — the SAME divisor-sum math the integer_factorizations collection
-- already exposes, not re-derived. Only digit_count and parity are genuinely new here.
--
-- EDGE CASES: Ω/ω already treat n=0 as 0 (pre-existing behavior in number-theory.sql, untouched). divisor_count/
-- divisor_sum are undefined at n<1 (0 has infinitely many divisors) and return NULL — this codebase's sentinel for
-- "no value" (see number-predicates.sql's n≥1/n≥2 domain guards for the same convention). digit_sum/digit_count/
-- binary_weight/parity are well-defined at 0. Every one of the 82 numeric-carrier integer_sequence collections
-- was checked directly against its own elements: all are non-negative integers, so no collection needed to be
-- skipped as ill-defined — a per-row NULL at n=0 is enough, nothing needed excluding wholesale.
--
-- parity, NOT a boolean is_even: the client's groupBy()/distribution() (packages/client/src/core.ts) unconditionally
-- build `min/max/sum(value_fn(...))::float8` over every OTHER registered stat when summarizing a group, and
-- Postgres has no min/max aggregate for boolean (confirmed directly against pglite: "function min(boolean) does
-- not exist") — a boolean-returning stat would hard-crash groupBy() on any of these collections, all of which now
-- carry ≥2 stats. So parity returns int 0/1 (even/odd), matching every other stat in the catalog — no base_stat
-- row anywhere returns boolean, for the same reason.

-- ── new stat functions (numeric n) ──────────────────────────────────────────────────────────────────────
-- τ(n)/σ(n): delegate to the divisor-sum math integer_factorizations.sql already defines on the factored carrier
-- (divisors_count/divisors_sum) — one source of truth, reached via the same factored(n) bijection number-predicates.sql
-- composes with. Undefined below n=1.
CREATE FUNCTION divisor_count(n numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n < 1 THEN NULL ELSE divisors_count(factored(n)) END $$;
CREATE FUNCTION divisor_sum(n numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n < 1 THEN NULL ELSE divisors_sum(factored(n)) END $$;

-- decimal digit count — same loop shape as decimal_digit_sum (harshad_numbers.sql); "0" counts as one digit.
CREATE FUNCTION digit_count(n numeric) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m numeric := trunc(abs(n)); c int := 0; BEGIN
    IF m = 0 THEN RETURN 1; END IF;
    WHILE m > 0 LOOP c := c + 1; m := div(m, 10); END LOOP;
    RETURN c;
  END $$;

-- parity: 0 = even, 1 = odd (int, not boolean — see the header note on why).
CREATE FUNCTION parity(n numeric) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT mod(trunc(abs(n)), 2)::int $$;

-- ── data-driven registration: every carrier='numeric' collection × the eight stats above ──────────────────
-- FINALIZER, not a one-shot INSERT (#283 phase 3): a bulk `INSERT ... SELECT FROM base_collection` here would only
-- ever see core's own collections (this file loads once, at core-load time), going stale the moment a pack loads
-- afterwards and adds its own carrier='numeric' collections — the same whole-catalog-sweep trap meta_collection_counts
-- hit (see meta-collections.stats.sql). Registered 'collection'-scope, so base_pack_finalize(pack) calls it once per
-- collection owned by that pack, for core AND for every later pack.
CREATE FUNCTION number_stats_finalize(p_collection text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain)
  SELECT c.id, s.stat_id, s.value_fn, s.title, s.codomain
  FROM base_collection c
  JOIN base_collection_tag ct ON ct.collection = c.id AND ct.tag = 'integer_sequence'
  CROSS JOIN (VALUES
    ('big_omega',     'big_omega',         'Ω — prime factors with multiplicity', 'natural_numbers'),
    ('little_omega',  'little_omega',      'ω — distinct prime factors',          'natural_numbers'),
    ('divisor_count', 'divisor_count',     'τ = σ₀ — number of divisors',         'natural_numbers'),
    ('divisor_sum',   'divisor_sum',       'σ = σ₁ — sum of divisors',            'natural_numbers'),
    ('digit_sum',     'decimal_digit_sum', 'Decimal digit sum',                   'natural_numbers'),
    ('digit_count',   'digit_count',       'Decimal digit count',                 'natural_numbers'),
    ('binary_weight', 'binary_popcount',   'Binary weight (popcount)',            'natural_numbers'),
    ('parity',        'parity',            'Parity (0 = even, 1 = odd)',          'natural_numbers')
  ) AS s(stat_id, value_fn, title, codomain)
  WHERE c.id = p_collection AND c.carrier = 'numeric';
END $$;
INSERT INTO base_finalizer (id, fn, description, scope) VALUES
  ('number_stats_finalize', 'number_stats_finalize',
   'registers the 8 numeric-carrier stats on a newly-loaded integer_sequence collection', 'collection');

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('number-stats','new functions: τ(12)=6, σ(12)=28, digit_count(12345)=5, parity(7)=1, parity(100)=0','eq','6|28|5|1|0',
   'divisor_count/divisor_sum delegate to integer_factorizations; digit_count/parity are new',$q$
    SELECT divisor_count(12)::text || '|' || divisor_sum(12)::text || '|' || digit_count(12345)::text || '|' ||
           parity(7)::text || '|' || parity(100)::text $q$),

  ('number-stats','n=0 edge cases: τ(0)/σ(0) undefined (NULL); digit_sum=0, digit_count=1, binary_weight=0, parity=0 (even)',
   'eq','NULL|NULL|0|1|0|0','0 has infinitely many divisors; the digit/bit/parity stats are still well-defined at 0',$q$
    SELECT coalesce(divisor_count(0)::text,'NULL') || '|' || coalesce(divisor_sum(0)::text,'NULL') || '|' ||
           decimal_digit_sum(0)::text || '|' || digit_count(0)::text || '|' || binary_popcount(0)::text || '|' || parity(0)::text $q$),

  ('number-stats','pinned check on natural_numbers: rank 12 = value 12 = 2²·3 (Ω=3, τ=6, σ=28, digit_sum=3)','eq','3|6|28|3',
   'divisors of 12: 1,2,3,4,6,12 (τ=6, Σ=28); Ω counts the multiset {2,2,3}',$q$
    SELECT big_omega((unrank(natural_numbers(),12)).value)::text || '|' ||
           divisor_count((unrank(natural_numbers(),12)).value)::text || '|' ||
           divisor_sum((unrank(natural_numbers(),12)).value)::text || '|' ||
           decimal_digit_sum((unrank(natural_numbers(),12)).value)::text $q$),

  ('number-stats','pinned check on prime_numbers: rank 5 = value 13 (prime, Ω=ω=1, τ=2, σ=14)','eq','1|1|2|14',
   'a prime has exactly one prime factor and exactly two divisors, {1, itself}',$q$
    SELECT big_omega((unrank(prime_numbers(),5)).value)::text || '|' ||
           little_omega((unrank(prime_numbers(),5)).value)::text || '|' ||
           divisor_count((unrank(prime_numbers(),5)).value)::text || '|' ||
           divisor_sum((unrank(prime_numbers(),5)).value)::text $q$),

  ('number-stats','pinned check on triangular_numbers (figurate): rank 7 = value 28 — also a perfect number','eq','3|6|56|10|3',
   '28 = 2²·7 (T7, the 8th triangular number); it is separately perfect, so σ(28) = 2·28 = 56; binary 11100 has weight 3',$q$
    SELECT big_omega((unrank(triangular_numbers(),7)).value)::text || '|' ||
           divisor_count((unrank(triangular_numbers(),7)).value)::text || '|' ||
           divisor_sum((unrank(triangular_numbers(),7)).value)::text || '|' ||
           decimal_digit_sum((unrank(triangular_numbers(),7)).value)::text || '|' ||
           binary_popcount((unrank(triangular_numbers(),7)).value)::text $q$),

  ('number-stats','natural_numbers now resolves all eight numeric stats, all OWN (not carrier-inherited)','eq','true',
   'base_stat_resolved — proves per-collection registration, not a new carrier-inheritance branch',$q$
    SELECT (array_agg(stat_id ORDER BY stat_id) =
              ARRAY['big_omega','binary_weight','digit_count','digit_sum','divisor_count','divisor_sum','little_omega','parity']
            AND bool_and(own))::text
    FROM base_stat_resolved WHERE collection = 'natural_numbers' $q$),

  ('number-stats','a formerly-zero-stat numeric collection now resolves statistics (e.g. triangular_numbers)','eq','true',
   'base_stat_resolved count > 0 — was 0 for every numeric collection before issue #169; any carrier=numeric
    collection demonstrates it, so this picks a core one rather than a number-sets collection (#283 phase 3)',$q$
    SELECT (count(*) > 0)::text FROM base_stat_resolved WHERE collection = 'triangular_numbers' $q$),

  ('number-stats','coverage: every carrier=numeric collection now carries exactly the 8 registered stats — no gaps, no dupes','eq','true',
   'a structural check (no hardcoded collection count, so it stays true as numeric collections are added)',$q$
    SELECT (NOT EXISTS (
      SELECT 1 FROM base_collection c
      LEFT JOIN (SELECT collection, count(*) n FROM base_stat GROUP BY collection) s ON s.collection = c.id
      WHERE c.carrier = 'numeric' AND coalesce(s.n, 0) <> 8
    ))::text $q$);
