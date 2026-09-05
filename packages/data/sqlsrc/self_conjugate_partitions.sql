-- requires: integer_partitions, realizer
-- self_conjugate_partitions — integer partitions equal to their own conjugate (transpose of the Young diagram).
-- Counted by A000700 (n=0..9: 1,1,0,1,1,1,1,1,2,2), also = partitions into distinct odd parts. Realized as a
-- base_restrict of integer_partitions: same carrier (integer_partition) and grade chain [n], floor = the
-- parent's reverse-lex floor filtered by is_self_conjugate_partition, contains inherited automatically.

-- ── predicate ─────────────────────────────────────────────────────────────────────────────────────────
-- conjugate c[i] = #{ j : parts[j] >= i } for i = 1..parts[1] (the largest part; empty partition has none).
-- v is self-conjugate iff that conjugate array equals (v).parts. The empty partition (n=0) has an empty
-- conjugate too — generate_series(1, NULL) yields zero rows, so the comparison subquery is NULL and the
-- coalesce falls through to "empty parts ⇒ true".
CREATE FUNCTION is_self_conjugate_partition(v integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    (SELECT array_agg((SELECT count(*)::int FROM unnest((v).parts) x WHERE x >= i) ORDER BY i)
       FROM generate_series(1, (v).parts[1]) i) = (v).parts,
    coalesce(array_length((v).parts, 1), 0) = 0
  )
$$;

SELECT base_restrict('self_conjugate_partitions', 'integer_partitions', 'is_self_conjugate_partition');

CREATE FUNCTION fiber_symbol(f self_conjugate_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SC(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('self_conjugate_partitions');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('self_conjugate_partitions','A000700 anchor: cardinality n=0..9 = 1,1,0,1,1,1,1,1,2,2','eq','1,1,0,1,1,1,1,1,2,2','partitions equal to their own conjugate',$q$
    SELECT string_agg(cardinality(self_conjugate_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,9) n $q$),
  ('self_conjugate_partitions','self_conjugate_partitions(8) enumerated','eq','4+2+1+1,3+3+2','the restricted floor, in the parent''s reverse-lex order (2 = A000700(8))',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(self_conjugate_partitions(8)) e $q$),
  ('self_conjugate_partitions','every listed partition is its own conjugate (n=0..9)','ok',NULL,'structural invariant checked via the predicate over the restricted floor',$q$
    DO $b$ BEGIN
      IF EXISTS (
        SELECT 1 FROM generate_series(0,9) n, LATERAL elements(self_conjugate_partitions(n)) el
        WHERE NOT is_self_conjugate_partition((el).value)
      ) THEN RAISE EXCEPTION 'self-conjugate invariant violated'; END IF;
    END $b$ $q$),
  ('self_conjugate_partitions','fibers()-unfold: fiber.address for self_conjugate_partitions(1,8)','eq','1,2,3,4,5,6,7,8','one fiber per n, grades unfold same as the parent',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(self_conjugate_partitions(1,8)) f $q$),
  ('self_conjugate_partitions','<@ membership: 4+2+1+1 ∈ self_conjugate_partitions(8); 5+3 ∉','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[4,2,1,1])::integer_partition <@ self_conjugate_partitions(8))::text || '|' ||
           (ROW(ARRAY[5,3])::integer_partition <@ self_conjugate_partitions(8))::text $q$);
