-- requires: integer_partitions, realizer
-- triangular_partitions — ported from pg-enumeratio-core_old_backup/sqlsrc/triangular-partitions.sql.
-- Partitions of n whose parts are all TRIANGULAR numbers (T(k) = k(k+1)/2: 1, 3, 6, 10, 15, …); parts may
-- repeat. |triangular_partitions(n)| = A007294: 1,1,1,2,2,2,4,4,4,6,7,7,10,11,11,15,…
-- base_restrict of integer_partitions: reuses its carrier (integer_partition), notation, single grade [n], and
-- revlex (largest-part-first) floor order — the restriction just filters that floor by the triangular predicate
-- and the realizer re-ranks. Membership: every part is a positive triangular number ⇔ 8·part+1 is a perfect square.

CREATE FUNCTION is_triangular_partition(p integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(x >= 1 AND s.r * s.r = 8 * x + 1), true)
  FROM unnest((p).parts) AS x, LATERAL (SELECT floor(sqrt(8.0 * x + 1))::bigint AS r) s $$;

SELECT base_restrict('triangular_partitions', 'integer_partitions', 'is_triangular_partition');

CREATE FUNCTION fiber_symbol(f triangular_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'TP(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('triangular_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('triangular_partitions', 'A007294 anchor: cardinality for n=0..15', 'eq',
   '1,1,1,2,2,2,4,4,4,6,7,7,10,11,11,15',
   'the count/first-members sequence anchor from the old source', $q$
    SELECT string_agg(cardinality(triangular_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,15) n
  $q$),

  ('triangular_partitions', '|triangular_partitions(6)| = 4', 'eq', '4', '6, 3+3, 3+1+1+1, 1×6.', $q$
    SELECT cardinality(triangular_partitions(6))::text
  $q$),

  ('triangular_partitions', 'triangular_partitions(6) enumerated, revlex order', 'eq', '6,3+3,3+1+1+1,1+1+1+1+1+1',
   'largest triangular part first, inherited from the integer_partitions floor order', $q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(triangular_partitions(6)) e
  $q$),

  ('triangular_partitions', 'every part is triangular (n=0..15)', 'ok', NULL,
   'each part is a triangular number (8x+1 is a perfect square), checked over the realized floor', $q$
    DO $b$ BEGIN
      IF EXISTS (
        SELECT 1 FROM generate_series(0,15) n, LATERAL elements(triangular_partitions(n)) el
        WHERE NOT is_triangular_partition((el).value)
      ) THEN RAISE EXCEPTION 'nontriangular part found'; END IF;
    END $b$
  $q$),

  ('triangular_partitions', 'every partition sums to n (n=0..15)', 'ok', NULL,
   'the parts of every triangular partition of n sum to n', $q$
    DO $b$ BEGIN
      IF EXISTS (
        SELECT 1 FROM generate_series(0,15) n, LATERAL elements(triangular_partitions(n)) el
        WHERE (SELECT coalesce(sum(x),0) FROM unnest(((el).value).parts) x) <> n
      ) THEN RAISE EXCEPTION 'sum invariant violated'; END IF;
    END $b$
  $q$),

  ('triangular_partitions', 'contains: 3+3 <@ triangular_partitions(6); 4+2 (nontriangular parts) ∉', 'eq', 'true|false',
   'derived membership = integer_partitions-contains ∧ is_triangular_partition', $q$
    SELECT (ROW(ARRAY[3,3])::integer_partition <@ triangular_partitions(6))::text || '|' ||
           (ROW(ARRAY[4,2])::integer_partition <@ triangular_partitions(6))::text
  $q$);
