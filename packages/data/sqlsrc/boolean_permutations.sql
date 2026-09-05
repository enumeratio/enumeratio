-- requires: permutations, fibonacci, realizer, utilities
-- boolean_permutations — permutations that are a product of PAIRWISE-COMMUTING simple reflections, i.e. σ can be
-- written s_{i₁}···s_{iₖ} with the i's an antichain in the path graph (no two adjacent). Equivalent order-theoretic
-- characterization: σ has NO NON-ADJACENT INVERSION — for all i<j with j-i≥2, σ(i)<σ(j). Count = F(n+1) (Fibonacci):
-- 1,1,2,3,5,8,13,21,34 for n=0..8 (A000045 shifted) — the independent sets of the path P_{n-1}. A base_restrict of
-- permutations: same carrier + grade [size], floor filtered by the predicate, realizer re-ranks.

CREATE FUNCTION is_boolean_permutation(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_subscripts((p).image,1) i, generate_subscripts((p).image,1) j
                     WHERE j - i >= 2 AND (p).image[i] > (p).image[j]) $$;   -- no non-adjacent inversion

-- closed-form count (#254 — base_restrict has no fiber_count of its own, so counting a fiber fell back to
-- enumerate-then-filter): |boolean_permutations(n)| = F(n+1), the independent sets of the path P_{n-1}.
CREATE FUNCTION boolean_permutations_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT fibonacci_term((f).size::int + 1) $$;

SELECT base_restrict('boolean_permutations', 'permutations', 'is_boolean_permutation', count_fn => 'boolean_permutations_count');
CREATE FUNCTION fiber_symbol(f boolean_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Bool(' || (f).size::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('boolean_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('boolean_permutations','count = F(n+1) for n=0..8: 1,1,2,3,5,8,13,21,34','eq','1,1,2,3,5,8,13,21,34','independent sets of the path P_{n-1} (A000045 shifted)',$q$
    SELECT string_agg(cardinality(boolean_permutations(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('boolean_permutations','boolean_permutations(4) enumerated','eq','1234,1243,1324,2134,2143','the 5 boolean permutations of [4], lex order (re-ranked)',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(boolean_permutations(4)) e $q$),
  ('boolean_permutations','no element of any fiber has a non-adjacent inversion (n=0..6)','eq','true','the defining invariant, checked across the floor',$q$
    SELECT bool_and(is_boolean_permutation((e).value)) FROM elements(boolean_permutations(0,6)) e $q$),
  ('boolean_permutations','contains via <@: 2143 ∈ boolean(4); 3421 ∉ (σ(1)=3 > σ(3)=2, a non-adjacent inversion)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[2,1,4,3])::permutation <@ boolean_permutations(4))::text || '|' ||
           (ROW(ARRAY[3,4,2,1])::permutation <@ boolean_permutations(4))::text $q$),
  ('boolean_permutations','closed-form cardinality (#254 accel) agrees with F(n+1) for n=0..12','eq','true','count_fn delegates to fibonacci_term, no floor scan',$q$
    SELECT bool_and(cardinality(boolean_permutations(n)) = fibonacci_term(n+1)) FROM generate_series(0,12) n $q$);
