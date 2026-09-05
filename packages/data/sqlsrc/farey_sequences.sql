-- requires: rational_numbers, number-theory, realizer, utilities
-- farey_sequences(n) — the reduced fractions p/q with 0 ≤ p ≤ q ≤ n, gcd(p,q)=1, in increasing order (F_n). Carrier
-- = rational_number (the same carrier as rational_numbers, graded here by denominator bound n rather than left
-- ungraded by the Calkin-Wilf walk — the first graded family on that carrier, per #231). Count = 1 + Σ_{k=1}^{n} φ(k)
-- (A005728), via euler_phi from number-theory.sql. Single grade [n].

CREATE TYPE farey_sequences_fiber AS (n natural_number);   -- typed fiber; axis: n

-- FLOOR: every coprime pair (p,q) with 1≤q≤n, 0≤p≤q, ordered by value p/q. (n<1 ⇒ empty — the grade's lower
-- bound is 1, but keep the fiber well-defined so an out-of-grade probe stays consistent with fiber_count.)
CREATE FUNCTION fiber_elements(f farey_sequences_fiber, element_limit int) RETURNS SETOF rational_number LANGUAGE sql STABLE AS $$
  SELECT ROW(p, q)::rational_number
    FROM generate_series(1, (f).n::int) q, LATERAL generate_series(0, q) p
   WHERE gcd_int(p, q) = 1
   ORDER BY p::numeric / q
   LIMIT element_limit $$;

-- accel: |F_n| = 1 + Σ_{k=1}^{n} φ(k) — A005728 (the "1" is the term 0/1, reached at q=1,p=0; n<1 ⇒ 0).
CREATE FUNCTION fiber_count(f farey_sequences_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int < 1 THEN 0 ELSE 1 + coalesce(sum(euler_phi(k)), 0) END FROM generate_series(1, greatest((f).n::int,1)) k $$;

CREATE FUNCTION contains_in_fiber(f farey_sequences_fiber, v rational_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).denominator >= 1 AND (v).denominator <= (f).n::int
     AND (v).numerator >= 0 AND (v).numerator <= (v).denominator
     AND gcd_int((v).numerator, (v).denominator) = 1 $$;

INSERT INTO base_collection VALUES ('farey_sequences', 'rational_number');
INSERT INTO base_grade VALUES ('farey_sequences', 1, 'n', '1', NULL);
CREATE FUNCTION fiber_symbol(f farey_sequences_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'F(' || (f).n::int || ')' $$;
SELECT base_realize('farey_sequences');

-- ── stats: numerator, denominator (rational_number's first graded family — the carrier had 0 stats before) ──
CREATE FUNCTION farey_sequences_numerator(q rational_number) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT (q).numerator $$;
CREATE FUNCTION farey_sequences_denominator(q rational_number) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT (q).denominator $$;
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('farey_sequences', 'numerator', 'farey_sequences_numerator', 'Numerator', 'natural_numbers'),
  ('farey_sequences', 'denominator', 'farey_sequences_denominator', 'Denominator', 'natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('farey_sequences','F(4) = 0,1/4,1/3,1/2,2/3,3/4,1','eq','0,1/4,1/3,1/2,2/3,3/4,1','the classical F_4',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(farey_sequences(4)) e $q$),
  ('farey_sequences','|F(n)| for n=1..8 matches A005728: 2,3,5,7,11,13,19,23','eq','2,3,5,7,11,13,19,23','1+Σφ(k)',$q$
    SELECT string_agg(cardinality(farey_sequences(n))::text, ',' ORDER BY n) FROM generate_series(1,8) n $q$),
  ('farey_sequences','every element of F(6) is reduced, in [0,1], denominator ≤ 6','eq','true','the defining invariant',$q$
    SELECT bool_and(contains_in_fiber(ROW(6)::farey_sequences_fiber, (e).value)) FROM elements(farey_sequences(6)) e $q$),
  ('farey_sequences','F(10) is strictly increasing in value','eq','true','the floor enumerates in order',$q$
    SELECT bool_and(v < nxt) FROM (
      SELECT ((e).value).numerator::numeric / ((e).value).denominator AS v,
             lead(((e).value).numerator::numeric / ((e).value).denominator) OVER (ORDER BY ordinality(e)) AS nxt
        FROM elements(farey_sequences(10)) e) t
    WHERE nxt IS NOT NULL $q$),
  ('farey_sequences','denominator stat over F(5): 1,5,4,3,5,2,5,3,4,5,1','eq','1,5,4,3,5,2,5,3,4,5,1',NULL,$q$
    SELECT string_agg(farey_sequences_denominator((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(farey_sequences(5)) e $q$),
  ('farey_sequences','contains: 2/5 ∈ F(5), 2/4 (unreduced) ∉','eq','true|false',NULL,$q$
    SELECT (ROW(2,5)::rational_number <@ farey_sequences(5))::text || '|' || (ROW(2,4)::rational_number <@ farey_sequences(5))::text $q$);
