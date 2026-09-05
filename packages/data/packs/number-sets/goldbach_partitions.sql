-- requires: number-theory, realizer, utilities
-- goldbach_partitions(n) — unordered pairs of primes (p,q), p ≤ q, p+q = 2n: the kernel of + on prime_numbers ×
-- prime_numbers restricted to the fiber where the sum is 2n (Goldbach's conjecture: nonempty for every n ≥ 2). A
-- fresh composite carrier — no parent carrier fits a constrained numeric pair (audit §3.2: nothing to restrict,
-- there's no existing "pair of numbers" collection). No closed form for the count (A045917's growth is famously
-- irregular — "Goldbach's comet"), so no accel; direct search per fiber.
CREATE TYPE goldbach_partition AS (p int, q int);   -- p ≤ q, both prime, p+q even
CREATE FUNCTION notation(g goldbach_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT (g).p::text || '+' || (g).q::text $$;

CREATE TYPE goldbach_partitions_fiber AS (n natural_number);   -- typed fiber; axis: n (the even number is 2n)

CREATE FUNCTION fiber_elements(f goldbach_partitions_fiber, element_limit int) RETURNS SETOF goldbach_partition LANGUAGE sql STABLE AS $$
  SELECT ROW(p, 2*(f).n::int - p)::goldbach_partition
    FROM generate_series(2, (f).n::int) p
   WHERE is_prime_number(p) AND is_prime_number(2*(f).n::int - p) AND p <= 2*(f).n::int - p
   ORDER BY p
   LIMIT element_limit $$;

CREATE FUNCTION contains_in_fiber(f goldbach_partitions_fiber, v goldbach_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).p <= (v).q AND (v).p + (v).q = 2 * (f).n::int
     AND is_prime_number((v).p) AND is_prime_number((v).q) $$;

INSERT INTO base_collection VALUES ('goldbach_partitions', 'goldbach_partition');
INSERT INTO base_grade VALUES ('goldbach_partitions', 1, 'n', '2', NULL);   -- 2n ≥ 4, the first even number with a partition
CREATE FUNCTION fiber_symbol(f goldbach_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'G(' || (2 * (f).n::int) || ')' $$;
SELECT base_realize('goldbach_partitions');

-- ── maps: each component IS a prime (the kernel projects back onto both factors of the product) ─────────
CREATE FUNCTION goldbach_partitions_lesser_prime(g goldbach_partition) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT (g).p::numeric $$;
CREATE FUNCTION goldbach_partitions_greater_prime(g goldbach_partition) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT (g).q::numeric $$;
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('goldbach_partitions','lesser_prime','goldbach_partitions_lesser_prime','prime_numbers','Lesser prime',NULL),
  ('goldbach_partitions','greater_prime','goldbach_partitions_greater_prime','prime_numbers','Greater prime',NULL);
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('goldbach_partitions','gap','goldbach_partitions_gap','Gap between the two primes (q−p)','natural_numbers');
CREATE FUNCTION goldbach_partitions_gap(g goldbach_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT (g).q - (g).p $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('goldbach_partitions','G(10) has two partitions: 3+7, 5+5','eq','3+7,5+5',NULL,$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(goldbach_partitions(5)) e $q$),
  ('goldbach_partitions','the count sequence for 2n=4,6,…,30 matches A045917: 1,1,1,2,1,2,2,2,2,3,3,3,2,3','eq','1,1,1,2,1,2,2,2,2,3,3,3,2,3','Goldbach partition counts',$q$
    SELECT string_agg(cardinality(goldbach_partitions(n))::text, ',' ORDER BY n) FROM generate_series(2,15) n $q$),
  ('goldbach_partitions','every element of G(2n) for n=2..50 sums to 2n and both parts are prime','eq','true','the defining invariant',$q$
    SELECT bool_and((e).value <@ goldbach_partitions(n)) FROM generate_series(2,50) n, LATERAL elements(goldbach_partitions(n)) e $q$),
  ('goldbach_partitions','lesser_prime/greater_prime of 5+5 (G(10)''s second partition)','eq','5|5',NULL,$q$
    SELECT goldbach_partitions_lesser_prime(ROW(5,5)::goldbach_partition)::text || '|' || goldbach_partitions_greater_prime(ROW(5,5)::goldbach_partition)::text $q$),
  ('goldbach_partitions','gap of 3+7 is 4','eq','4',NULL,$q$
    SELECT goldbach_partitions_gap(ROW(3,7)::goldbach_partition)::text $q$),
  ('goldbach_partitions','contains: 3+7 ∈ G(10), 7+3 (unsorted) ∉, 4+6 (not prime) ∉','eq','true|false|false',NULL,$q$
    SELECT (ROW(3,7)::goldbach_partition <@ goldbach_partitions(5))::text || '|' || (ROW(7,3)::goldbach_partition <@ goldbach_partitions(5))::text
        || '|' || (ROW(4,6)::goldbach_partition <@ goldbach_partitions(5))::text $q$);
