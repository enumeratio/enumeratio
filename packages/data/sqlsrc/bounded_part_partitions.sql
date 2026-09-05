-- requires: integer_partitions, largest_part_partitions, realizer
-- bounded_part_partitions — ported from old-backup sqlsrc/bounded-part-partitions.sql. Partitions of n into
-- parts each ≤ k — a named SPECIALIZATION of integer_partitions carried as its own multi-grade collection.
-- Multi-grade chain [n, k]; k defaults to its full range 1..n, so bounded_part_partitions(n) unfolds fibers
-- over k with global order (n, k, ordinality). REUSES the integer_partition carrier + notation
-- + the existing partition_generate(n, max_part) floor (which already emits partitions of n with parts ≤ max_part
-- in descending-lex order) and the partition_count_max_part(target, cap) accel. Fiber [n,k] count = number of
-- partitions of n into parts ≤ k; the k=n fiber recovers p(n).

-- The collection OWNS its fiber type — a named typed-axis struct whose SIGNATURE is the fibration (n, then k), each
-- a natural_number. Its hooks are the generic overloaded fiber_elements / fiber_count / contains_in_fiber, dispatched
-- on bounded_part_partitions_fiber. base_realize introspects it → a natural_range handle. (Migrated from the legacy int[] address.)
CREATE TYPE bounded_part_partitions_fiber AS (n natural_number, k natural_number);
-- ── the FLOOR: partitions of n with parts ≤ k, in the parent's descending-lex order ─────────────────────
CREATE FUNCTION fiber_elements(f bounded_part_partitions_fiber, element_limit int) RETURNS SETOF integer_partition LANGUAGE sql STABLE AS $$
  SELECT ROW(parts)::integer_partition FROM partition_generate((f).n::int, (f).k::int) parts LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f bounded_part_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT partition_count_max_part((f).n::int, (f).k::int)::numeric $$;
CREATE FUNCTION contains_in_fiber(f bounded_part_partitions_fiber, v integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT coalesce(sum(x), 0) FROM unnest((v).parts) x) = (f).n::int                 -- sums to n
     AND coalesce((SELECT max(x) FROM unnest((v).parts) x), 0) <= (f).k::int                -- every part ≤ k
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).parts,1) i                        -- stored non-increasing
                     WHERE i > 1 AND (v).parts[i-1] < (v).parts[i]) $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('bounded_part_partitions', 'integer_partition');
INSERT INTO base_grade VALUES
  ('bounded_part_partitions', 1, 'n', NULL, NULL),
  ('bounded_part_partitions', 2, 'k', '1', 'g1');                                            -- part-bound k ranges 1..n
CREATE FUNCTION fiber_symbol(f bounded_part_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'p(' || (f).n::int || ',≤' || (f).k::int || ')' $$;   -- corpus symbol

SELECT base_realize('bounded_part_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('bounded_part_partitions','row n=6 over k=1..6: 1,4,7,9,10,11','eq','1,4,7,9,10,11','partitions of 6 with parts ≤ k (accel)',$q$
    SELECT string_agg(cardinality(bounded_part_partitions(6,k))::text, ',' ORDER BY k) FROM generate_series(1,6) k $q$),
  ('bounded_part_partitions','k=n fiber recovers p(n): bounded_part_partitions(6,6) = partition_number(6) = 11','eq','11|11','the full-bound fiber is all of integer_partitions(n)',$q$
    SELECT cardinality(bounded_part_partitions(6,6))::text || '|' || partition_number(6)::text $q$),
  ('bounded_part_partitions','partitions of 6 with parts ≤ 3, in descending-lex order','eq','3+3,3+2+1,3+1+1+1,2+2+2,2+2+1+1,2+1+1+1+1,1+1+1+1+1+1','the realized floor for fiber [6,3]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(bounded_part_partitions(6,3)) e $q$),
  ('bounded_part_partitions','fibers(bounded_part_partitions(6)) unfold to k = 1..6','eq','1,2,3,4,5,6','the second grade ranges 1..n',$q$
    SELECT string_agg((f).k::text, ',' ORDER BY (f).k) FROM fibers(bounded_part_partitions(6)) f $q$),
  ('bounded_part_partitions','multi-grade chain: fiber = (n,k) named axes','eq','6|3','unrank(bounded_part_partitions(6,3), 0).fiber is (n=6,k=3)',$q$
    SELECT (unrank(bounded_part_partitions(6,3), 0)).fiber.n::text || '|' || (unrank(bounded_part_partitions(6,3), 0)).fiber.k::text $q$),
  ('bounded_part_partitions','every element of fiber [6,3] has all parts ≤ 3 and sums to 6','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and((SELECT max(x) FROM unnest(((e).value).parts) x) <= 3
                AND (SELECT sum(x) FROM unnest(((e).value).parts) x) = 6)::text FROM elements(bounded_part_partitions(6,3)) e $q$),
  ('bounded_part_partitions','contains via <@: 3+2+1 ∈ (6,3); 4+2 ∉ (6,3) (part>3); 3+3 ∈ (6,3)','eq','true|false|true','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[3,2,1])::integer_partition <@ bounded_part_partitions(6,3))::text || '|' ||
           (ROW(ARRAY[4,2])::integer_partition <@ bounded_part_partitions(6,3))::text || '|' ||
           (ROW(ARRAY[3,3])::integer_partition <@ bounded_part_partitions(6,3))::text $q$);
