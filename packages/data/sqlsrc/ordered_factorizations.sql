-- requires: integer_factorizations, realizer
-- ordered_factorizations — ordered factorizations of n into factors >= 2 (A074206, the Kalmar problem): all ways
-- to write n as an ordered product of integers >= 2. Ported from old-backup sqlsrc/ordered-factorizations.sql,
-- which modeled n as the collection's size_axis; here n is simply the (single) grade. Count obeys the divisor
-- recurrence a(n) = sum_{d|n, d>=2} a(n/d), a(1) = 1 (the empty product — the trivial "factorization" of 1).
-- Fiber [n] is ordered lexicographically on the factors array (plain array ASC: first factor ascending, then
-- recursively within each remaining quotient); the lex-last element at grade n is always the trivial [n] itself.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE ordered_factorization AS (factors int[]);                 -- e.g. {2,3,2} = 2·3·2 (product 12)
CREATE FUNCTION notation(f ordered_factorization) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(array_length((f).factors, 1), 0) = 0 THEN '1' ELSE array_to_string((f).factors, '·') END $$;
CREATE FUNCTION ordered_factorization_product(a int[]) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r numeric := 1; x int; BEGIN FOREACH x IN ARRAY coalesce(a, '{}') LOOP r := r * x; END LOOP; RETURN r; END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: grow every divisor chain n = d1*d2*...*dk (each di >= 2) by repeatedly peeling off a divisor >= 2 of
-- what remains, until nothing (remaining = 1) is left. n=1 needs no peeling at all — the anchor row (factors={},
-- remaining=1) already satisfies the terminal filter, giving the single trivial "empty product" factorization.
-- Plain array ASC on `factors` IS lex order here: no factorization is ever a strict prefix of another (every
-- factor is >= 2, so the running product only reaches n exactly at completion), so array comparison never has
-- to fall back on length.
CREATE TYPE ordered_factorizations_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f ordered_factorizations_fiber, element_limit int) RETURNS SETOF ordered_factorization LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build(factors, remaining) AS (
      SELECT ARRAY[]::int[], (f).n::int
    UNION ALL
      SELECT b.factors || d.d, b.remaining / d.d
      FROM build b, LATERAL (SELECT gs AS d FROM generate_series(2, b.remaining) gs WHERE b.remaining % gs = 0) d
      WHERE b.remaining > 1
  )
  SELECT ROW(factors)::ordered_factorization FROM build WHERE remaining = 1 ORDER BY factors LIMIT element_limit $$;

-- count accel: the divisor recurrence a(n) = sum_{d|n, d>=2} a(n/d), a(n<=1) = 1 (self-recursive plpgsql; the
-- function name already exists by the time a call executes, so this resolves fine despite the self-reference).
CREATE FUNCTION ordered_factorization_count(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE total numeric := 0; d int;
  BEGIN
    IF n <= 1 THEN RETURN 1; END IF;
    FOR d IN 2..n LOOP
      IF n % d = 0 THEN total := total + ordered_factorization_count(n / d); END IF;
    END LOOP;
    RETURN total;
  END $$;
CREATE FUNCTION fiber_count(f ordered_factorizations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int < 1 THEN 0::numeric ELSE ordered_factorization_count((f).n::int) END $$;

-- contains: v factors n exactly (empty product convention covers n=1) with every factor >= 2.
CREATE FUNCTION contains_in_fiber(f ordered_factorizations_fiber, v ordered_factorization) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT ordered_factorization_product((v).factors) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce((v).factors, '{}')) x WHERE x < 2) $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('ordered_factorizations', 'ordered_factorization');
INSERT INTO base_grade VALUES ('ordered_factorizations', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f ordered_factorizations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'OF(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('ordered_factorizations');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ordered_factorizations','OEIS A074206 anchors (n = 1,2,4,6,8,12,24)','ok',NULL,'a(1)=1,a(2)=1,a(4)=2,a(6)=3,a(8)=4,a(12)=8,a(24)=20 via the accel',$q$
    DO $$ BEGIN
      ASSERT cardinality(ordered_factorizations(1))  = 1,  'a(1)';
      ASSERT cardinality(ordered_factorizations(2))  = 1,  'a(2)';
      ASSERT cardinality(ordered_factorizations(4))  = 2,  'a(4)';
      ASSERT cardinality(ordered_factorizations(6))  = 3,  'a(6)';
      ASSERT cardinality(ordered_factorizations(8))  = 4,  'a(8)';
      ASSERT cardinality(ordered_factorizations(12)) = 8,  'a(12)';
      ASSERT cardinality(ordered_factorizations(24)) = 20, 'a(24)';
    END $$
  $q$),
  ('ordered_factorizations','floor count independently matches the accel (n=12, n=24)','eq','8|20','count the generated floor directly, no accel involved',$q$
    SELECT (SELECT count(*) FROM elements(ordered_factorizations(12)))::text || '|' ||
           (SELECT count(*) FROM elements(ordered_factorizations(24)))::text
  $q$),
  ('ordered_factorizations','ordered factorizations of 12 in lex order','eq','2·2·3,2·3·2,2·6,3·2·2,3·4,4·3,6·2,12','the realized floor for fiber [12], array ASC on factors',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(ordered_factorizations(12)) e
  $q$),
  ('ordered_factorizations','n=1 has exactly the trivial empty-product factorization','eq','1','the single "1" notation, empty factors array',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(ordered_factorizations(1)) e
  $q$),
  ('ordered_factorizations','every element of fiber [24] is a valid ordered factorization of 24','eq','true','structural invariant: product = n, every factor >= 2',$q$
    SELECT bool_and(ordered_factorization_product(((e).value).factors) = 24
                AND NOT EXISTS (SELECT 1 FROM unnest(((e).value).factors) x WHERE x < 2))::text
      FROM elements(ordered_factorizations(24)) e
  $q$),
  ('ordered_factorizations','the lex-last element at grade n is always the trivial [n]','eq','24','last in lex order = the un-split factorization',$q$
    SELECT notation((unrank(ordered_factorizations(24), (cardinality(ordered_factorizations(24)) - 1)::int)).value)
  $q$),
  ('ordered_factorizations','lex rank/unrank round-trips over the full fiber (n=12)','ok',NULL,'unrank(r).value has ordinality r for every r in 0..a(12)-1',$q$
    DO $$ DECLARE r int; BEGIN
      FOR r IN 0..7 LOOP ASSERT ordinality(unrank(ordered_factorizations(12), r)) = r, 'rt @'||r; END LOOP;
    END $$
  $q$),
  ('ordered_factorizations','range handle: cardinality(ordered_factorizations(1,4)) sums a(1)+a(2)+a(3)+a(4)','eq','5','1+1+1+2',$q$
    SELECT cardinality(ordered_factorizations(1,4))::text
  $q$),
  ('ordered_factorizations','fibers(ordered_factorizations(1,4)) unfold to n = 1,2,3,4','eq','1,2,3,4','the grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(ordered_factorizations(1,4)) f
  $q$),
  ('ordered_factorizations','element carries a TYPED point fiber + ordinality','eq','12|1','unrank(ordered_factorizations(12),1)',$q$
    SELECT (unrank(ordered_factorizations(12), 1)).fiber.n::text || '|' || ordinality(unrank(ordered_factorizations(12), 1))::text
  $q$),
  ('ordered_factorizations','contains via <@: 2·2·3 ∈ ordered_factorizations(12), 2·2·2 ∉ (wrong product)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[2,2,3])::ordered_factorization <@ ordered_factorizations(12))::text || '|' ||
           (ROW(ARRAY[2,2,2])::ordered_factorization <@ ordered_factorizations(12))::text
  $q$),
  ('ordered_factorizations','a(2^k) = 2^(k-1) (compositions of k ones-and-twos... just the doubling pattern)','eq','1,2,4,8,16','prime powers: a(2)=1,a(4)=2,a(8)=4,a(16)=8,a(32)=16',$q$
    SELECT string_agg(cardinality(ordered_factorizations((2^k)::int))::text, ',' ORDER BY k) FROM generate_series(1,5) k
  $q$);
