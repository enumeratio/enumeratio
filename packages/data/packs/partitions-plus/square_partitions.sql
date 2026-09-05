-- requires: fibonacci, integer_partitions, realizer
-- square_partitions — ported from pg-enumeratio-core_old_backup/sqlsrc/square-partitions.sql. Partitions of n
-- into perfect-square parts (1, 4, 9, 16, 25, …), repetition allowed. A base_restrict of integer_partitions:
-- reuses its carrier (integer_partition), notation, and descending-lex floor order (which is exactly the old
-- collection's canonical revlex order — largest square first). |square_partitions(n)| = A001156.

CREATE FUNCTION is_square_partition(p integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(is_perfect_square(x)), true) FROM unnest((p).parts) x $$;   -- is_perfect_square from 20-fibonacci

SELECT base_restrict('square_partitions', 'integer_partitions', 'is_square_partition');

CREATE FUNCTION fiber_symbol(f square_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SP(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('square_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('square_partitions','A001156(n) for n=0..9 = 1,1,1,1,2,2,2,2,3,4','eq','1,1,1,1,2,2,2,2,3,4','the count anchor from the old-backup source',$q$
    SELECT string_agg(cardinality(square_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,9) n $q$),

  ('square_partitions','A001156(12) = 5, A001156(13) = 6','eq','5,6','further anchor values from the old-backup examples',$q$
    SELECT cardinality(square_partitions(12))::text || ',' || cardinality(square_partitions(13))::text $q$),

  ('square_partitions','square_partitions(9) in revlex order: 9, 4+4+1, 4+1+1+1+1+1, 1^9','eq','9,4+4+1,4+1+1+1+1+1,1+1+1+1+1+1+1+1+1','filtered floor inherits the parent''s descending-lex order',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(square_partitions(9)) e $q$),

  ('square_partitions','every part of every square-partition of n (n=0..13) is a perfect square','ok',NULL,'the defining invariant, checked over the floor',$q$
    DO $b$ BEGIN
      IF EXISTS (
        SELECT 1 FROM generate_series(0,13) n, LATERAL elements(square_partitions(n)) el, LATERAL unnest(((el).value).parts) x
        WHERE NOT is_perfect_square(x)
      ) THEN RAISE EXCEPTION 'square-part invariant violated'; END IF;
    END $b$ $q$),

  ('square_partitions','every square-partition of n still sums to n (n=0..13)','ok',NULL,'restriction reuses the parent invariant',$q$
    DO $b$ BEGIN
      IF EXISTS (
        SELECT 1 FROM generate_series(0,13) n, LATERAL elements(square_partitions(n)) el
        WHERE (SELECT coalesce(sum(x),0) FROM unnest(((el).value).parts) x) <> n
      ) THEN RAISE EXCEPTION 'sum invariant violated'; END IF;
    END $b$ $q$),

  ('square_partitions','contains via <@: 4+4+1 ∈ square_partitions(9); 3+3+3 ∉ (not squares); 4+4 ∉ (wrong sum)','eq','true|false|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[4,4,1])::integer_partition <@ square_partitions(9))::text || '|' ||
           (ROW(ARRAY[3,3,3])::integer_partition <@ square_partitions(9))::text || '|' ||
           (ROW(ARRAY[4,4])::integer_partition <@ square_partitions(9))::text $q$);
