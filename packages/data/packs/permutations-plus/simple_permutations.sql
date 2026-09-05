-- requires: permutations, realizer, utilities
-- simple_permutations — a RESTRICTION of permutations: those with no non-trivial INTERVAL (block). An interval is a
-- contiguous window of positions [i..j] whose values form a set of consecutive integers; the trivial ones are the
-- singletons (size 1) and the whole word (size n). A simple permutation has no interval strictly between — it is an
-- atom of the substitution decomposition of S_n. Counts 1,1,2,0,2,6,46,338,… [[OEIS:A111111]] (note the 0 at n=3:
-- every permutation of [3] has a non-trivial interval). At n=4 the only simple permutations are 2413 and 3142 — the
-- two that are NOT Baxter (Baxter permutations avoid every simple permutation of length ≥ 4).
--
-- The predicate: an interval [i..j] spans a consecutive value range iff max−min = j−i. Scan all O(n²) windows; the
-- floor is small so an existence check per window is fine. n ≤ 2 is vacuously simple (no non-trivial window exists).
CREATE FUNCTION is_simple(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT array_length((p).image,1) IS NULL OR array_length((p).image,1) <= 2 OR NOT EXISTS (
    SELECT 1 FROM generate_subscripts((p).image,1) i, generate_subscripts((p).image,1) j
    WHERE i <= j AND (j - i + 1) BETWEEN 2 AND array_length((p).image,1) - 1
      AND (SELECT max(x) - min(x) FROM unnest((p).image[i:j]) x) = j - i) $$;

SELECT base_restrict('simple_permutations', 'permutations', 'is_simple');
CREATE FUNCTION fiber_symbol(f simple_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Simp(' || (f).size::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('simple_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('simple_permutations','anchor: |simple_permutations(n)| for n=0..7 is 1,1,2,0,2,6,46,338','eq','1,1,2,0,2,6,46,338','A111111 — note the 0 at n=3',$q$
    SELECT string_agg(cardinality(simple_permutations(n))::text, ',' ORDER BY n) FROM generate_series(0,7) n $q$),
  ('simple_permutations','simple_permutations(3) is EMPTY (every perm of [3] has a non-trivial interval)','eq','0','the vanishing term B(3)-hole',$q$
    SELECT count(*)::text FROM elements(simple_permutations(3)) e $q$),
  ('simple_permutations','simple_permutations(4) = {2413, 3142} — the only simple perms of length 4','eq','2413,3142','exactly the two non-Baxter perms of [4]',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(simple_permutations(4)) e $q$),
  ('simple_permutations','contains via <@: 2413 ∈ simple_permutations(4), 1234 ∉ (its prefixes are intervals)','eq','true|false','derived membership = parent ∧ simple',$q$
    SELECT (ROW(ARRAY[2,4,1,3])::permutation <@ simple_permutations(4))::text || '|' ||
           (ROW(ARRAY[1,2,3,4])::permutation <@ simple_permutations(4))::text $q$);
