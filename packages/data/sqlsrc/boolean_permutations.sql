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

-- closed-form unrank (#299): σ = a product of pairwise-commuting simple reflections s_i, i in an independent set
-- S ⊆ {1..n-1} of the path P_{n-1} (no two adjacent) — the SAME S the count above enumerates. The realizer's lex
-- re-ranking coincides with the BINARY VALUE of the indicator vector b_1..b_{n-1} (b_1 = MSB): verified on n=4,
-- {}, {3}, {2}, {1}, {1,3} ↦ 1234, 1243, 1324, 2134, 2143 — exactly the order the example below pins.
--
-- Zeckendorf-style greedy: f(k) = valid length-k bit strings (no two adjacent 1's) = F(k+2) = fibonacci_term(k+2)
-- (f(0)=1, f(1)=2, matching the two base cases of "no bits left" / "one free bit"). Splitting the f(rem) strings
-- of the rem positions still to decide by their leading bit: f(rem-1) start with 0 (a free length-(rem-1) tail),
-- f(rem-2) start with 1 (forces the very next bit to 0, then a free length-(rem-2) tail) — and since 0 < 1,
-- ordering by leading bit already matches ascending binary value, so walking MSB-first and comparing `r` against
-- f(rem-1) = fibonacci_term(rem+1) greedily picks out the r-th valid string. Taking bit 1 at position `pos` means
-- i = pos is in S, i.e. σ gets s_pos applied — swap one-line positions pos, pos+1 — then skip the forced-0 next
-- position (pos+1..pos+2 consumed in one step). The chosen positions are pairwise non-adjacent by construction,
-- so their transpositions touch disjoint index pairs and compose correctly applied directly, left to right.
CREATE FUNCTION boolean_permutations_unrank(f permutations_fiber, ord rank_index) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    n int := (f).size::int;
    m int := greatest(n - 1, 0);                        -- number of reflection positions s_1..s_{n-1}
    r bigint := ord;
    rem int := m;                                        -- positions left to decide
    pos int := 1;                                         -- current position (1-based)
    img int[] := ARRAY(SELECT generate_series(1, n));    -- identity, one-line
    t int;
  BEGIN
    WHILE rem > 0 LOOP
      IF r < fibonacci_term(rem + 1) THEN                -- f(rem-1) = F(rem+1) completions with bit 0 here
        rem := rem - 1; pos := pos + 1;
      ELSE
        r := r - fibonacci_term(rem + 1);
        t := img[pos]; img[pos] := img[pos + 1]; img[pos + 1] := t;   -- s_pos: swap positions pos, pos+1
        rem := rem - 2; pos := pos + 2;
      END IF;
    END LOOP;
    RETURN ROW(img)::permutation;
  END $$;

SELECT base_restrict('boolean_permutations', 'permutations', 'is_boolean_permutation',
                      count_fn => 'boolean_permutations_count', unrank_fn => 'boolean_permutations_unrank');
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
    SELECT bool_and(cardinality(boolean_permutations(n)) = fibonacci_term(n+1)) FROM generate_series(0,12) n $q$),
  ('boolean_permutations','element_at == elements() iterator for n=0..8, and boolean_permutations(10) returns all 89 fast (#299 unrank)','eq','true','closed-form unrank vs enumeration — the differential selfcert.mts also runs catalog-wide',$q$
    SELECT (SELECT coalesce(bool_and((element_at(f, r)).value = (SELECT (e).value FROM elements(f, r+1) e ORDER BY e OFFSET r LIMIT 1)), true)
              FROM fibers(boolean_permutations(0,8)) f, generate_series(0, 40) r WHERE r < cardinality(f))
       AND (SELECT count(*) FROM elements(boolean_permutations(10))) = 89 $q$),
  ('boolean_permutations','the unrank floor (#299) enumerates exactly what filtering the parent does, n=0..6','eq','true','the accelerated floor must agree with scanning permutations(n) and filtering — same elements, same order',$q$
    SELECT bool_and(
      (SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(boolean_permutations(n)) e)
      = (SELECT string_agg(one_line((p).value), ',' ORDER BY ordinality(p))
           FROM elements(permutations(n)) p WHERE is_boolean_permutation((p).value))
    ) FROM generate_series(0,6) n $q$);
