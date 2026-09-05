-- requires: permutations, realizer, utilities
-- baxter_permutations — a RESTRICTION of permutations: those avoiding the two VINCULAR patterns 2-41-3 and 3-14-2
-- (the "4" and "1" must sit at ADJACENT positions). These are exactly the permutations sortable by two parallel
-- stacks; counted by the Baxter numbers B(n) = 1,1,2,6,22,92,422,2074,… [[OEIS:A001181]]. Unlike the classical
-- (non-vincular) pattern classes in pattern_avoiding_permutations.sql, the constraint pins b and b+1 adjacent —
-- so the plain permutation_avoids_patternN engine does not apply; a bespoke adjacency-aware predicate does.
--
-- 2-41-3: positions i < b, b+1 < d with p[b+1] < p[i] < p[d] < p[b]   (i plays 2, b→4, b+1→1, d→3)
-- 3-14-2: positions i < b, b+1 < d with p[b] < p[d] < p[i] < p[b+1]   (i plays 3, b→1, b+1→4, d→2)
CREATE FUNCTION is_baxter(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_subscripts((p).image,1) i, generate_subscripts((p).image,1) b, generate_subscripts((p).image,1) d
    WHERE i < b AND b + 1 < d
      AND ( ((p).image[b+1] < (p).image[i] AND (p).image[i] < (p).image[d] AND (p).image[d] < (p).image[b])      -- 2-41-3
         OR ((p).image[b]   < (p).image[d] AND (p).image[d] < (p).image[i] AND (p).image[i] < (p).image[b+1]) )) $$; -- 3-14-2

-- accel hook (#172): the Chung–Graham–Hoggatt–Kleitman closed form (1978) —
--   B(n) = [ Σ_{k=1}^{n} C(n+1,k−1)·C(n+1,k)·C(n+1,k+1) ] / [ C(n+1,1)·C(n+1,2) ],  B(0) = 1.
-- A finite sum of binomial products (no permutation enumerated); count_fn is on the parent (permutations_fiber).
CREATE FUNCTION baxter_permutation_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).size::int = 0 THEN 1::numeric ELSE
    div((SELECT sum(binomial((f).size::int + 1, k - 1) * binomial((f).size::int + 1, k) * binomial((f).size::int + 1, k + 1))
         FROM generate_series(1, (f).size::int) k),
        binomial((f).size::int + 1, 1) * binomial((f).size::int + 1, 2))
  END $$;

SELECT base_restrict('baxter_permutations', 'permutations', 'is_baxter', count_fn => 'baxter_permutation_count');
CREATE FUNCTION fiber_symbol(f baxter_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Bax(' || (f).size::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('baxter_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('baxter_permutations','anchor: |baxter_permutations(n)| for n=0..6 is the Baxter numbers 1,1,2,6,22,92,422','eq','1,1,2,6,22,92,422','A001181 — filtered floor re-counted per fiber',$q$
    SELECT string_agg(cardinality(baxter_permutations(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('baxter_permutations','all six perms of [3] are Baxter (patterns need length ≥ 4)','eq','123,132,213,231,312,321','below length 4 nothing is excluded',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(baxter_permutations(3)) e $q$),
  ('baxter_permutations','the two NON-Baxter perms of [4] are exactly the simple ones 2413, 3142','eq','2413,3142','B(4)=22, so 24−22=2 are excluded',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY one_line((e).value))
      FROM elements(permutations(4)) e WHERE NOT is_baxter((e).value) $q$),
  ('baxter_permutations','contains via <@: 2413 ∉ baxter_permutations(4) (it contains 2-41-3), 1234 ∈','eq','false|true','derived membership = parent ∧ Baxter',$q$
    SELECT (ROW(ARRAY[2,4,1,3])::permutation <@ baxter_permutations(4))::text || '|' ||
           (ROW(ARRAY[1,2,3,4])::permutation <@ baxter_permutations(4))::text $q$),
  ('baxter_permutations','accel hook (#172) is HONORED: the CGHK closed form matches the anchor for n=0..6','eq','true|1,1,2,6,22,92,422','fiber_count wired, and it agrees with the floor-verified sequence',$q$
    SELECT (to_regprocedure('fiber_count(baxter_permutations_fiber)') IS NOT NULL)::text || '|' ||
           string_agg(cardinality(baxter_permutations(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$);
