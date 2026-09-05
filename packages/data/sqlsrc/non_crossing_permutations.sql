-- requires: permutations, non_crossing_partitions, realizer, utilities
-- non_crossing_permutations — a RESTRICTION of permutations: those whose CYCLE decomposition forms a non-crossing
-- set partition of {1..n}. Draw each cycle as arcs on the points 1..n; the permutation is non-crossing when the
-- partition into cycles has no crossing pair. Borrows non_crossing_partitions.sql's crossing check (is_non_crossing)
-- verbatim, applied to the cycle-labelling of the permutation. Counts 1,1,2,6,23,105,553,3311,… : at n=4 the single
-- crossing partition {1,3}/{2,4} realizes as the one permutation (1 3)(2 4) = 3412, so 24 drops to 23.
--
-- perm_cycle_labels tags each position with the least index of its cycle; positions sharing a label share a block,
-- which is exactly what is_non_crossing(rgs) tests (equality of block ids, not their canonical numbering).
CREATE FUNCTION perm_cycle_labels(p permutation) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); lab int[] := array_fill(0, ARRAY[greatest(n,1)]); i int; j int;
  BEGIN
    FOR i IN 1..n LOOP
      IF lab[i] = 0 THEN j := i; LOOP lab[j] := i; j := (p).image[j]; EXIT WHEN j = i; END LOOP; END IF;
    END LOOP;
    RETURN lab[1:n];
  END $$;
CREATE FUNCTION is_non_crossing_perm(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_non_crossing(perm_cycle_labels(p)) $$;

SELECT base_restrict('non_crossing_permutations', 'permutations', 'is_non_crossing_perm');
CREATE FUNCTION fiber_symbol(f non_crossing_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'NCP(' || (f).size::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('non_crossing_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_crossing_permutations','anchor: |non_crossing_permutations(n)| for n=0..6 is 1,1,2,6,23,105,553','eq','1,1,2,6,23,105,553','cycles form a non-crossing partition',$q$
    SELECT string_agg(cardinality(non_crossing_permutations(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('non_crossing_permutations','all 6 perms of [3] are non-crossing (crossings need n ≥ 4)','eq','123,132,213,231,312,321','no crossing partition below n=4',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(non_crossing_permutations(3)) e $q$),
  ('non_crossing_permutations','exactly one perm of [4] is excluded — the crossing (1 3)(2 4) = 3412','eq','3412','24 − 23 = 1; the unique crossing partition {1,3}/{2,4}',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY one_line((e).value))
      FROM elements(permutations(4)) e WHERE NOT is_non_crossing_perm((e).value) $q$),
  ('non_crossing_permutations','contains via <@: 3412 ∉ (crossing cycles), 1234 ∈ (all fixed points)','eq','false|true','derived membership = parent ∧ non-crossing cycles',$q$
    SELECT (ROW(ARRAY[3,4,1,2])::permutation <@ non_crossing_permutations(4))::text || '|' ||
           (ROW(ARRAY[1,2,3,4])::permutation <@ non_crossing_permutations(4))::text $q$);
