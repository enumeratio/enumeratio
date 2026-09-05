-- requires: binary_words, lucas_numbers, realizer, utilities
-- independent_sets_cycle — the independent sets of the cycle graph C_n, as binary words with no two CYCLICALLY
-- adjacent 1s (position n is adjacent to position 1). Count = the Lucas numbers L_n: 2,3,4,7,11,18,29,… — the
-- cyclic analogue of sparse_subsets (independent sets of the PATH P_n, the Fibonacci numbers). A RESTRICTION of
-- binary_words. (independent_sets_path is exactly sparse_subsets, so it isn't a separate collection here.)
CREATE FUNCTION is_independent_set_cycle(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_series(1, coalesce(array_length((w).bits, 1), 0) - 1) i
                     WHERE (w).bits[i] = 1 AND (w).bits[i+1] = 1)                      -- no two linearly adjacent 1s
     AND NOT (coalesce(array_length((w).bits, 1), 0) >= 2
              AND (w).bits[1] = 1 AND (w).bits[array_length((w).bits, 1)] = 1) $$;     -- …and not both endpoints (the wrap edge)

-- accel hook (#172): the Lucas numbers for n≥2; n=1 is 2 (C₁'s self-loop is ignored here, so both "0" and "1"
-- qualify — differs from lucas_term(1)=1, see the header note vs. lucas_strings); n=0 is the vacuous empty word.
CREATE FUNCTION independent_sets_cycle_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int <= 1 THEN (f).n::int + 1::numeric ELSE lucas_term((f).n::term_index) END $$;

SELECT base_restrict('independent_sets_cycle', 'binary_words', 'is_independent_set_cycle', count_fn => 'independent_sets_cycle_count');

CREATE FUNCTION fiber_symbol(f independent_sets_cycle_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Ind(C' || (f).n::int || ')' $$;

SELECT wire_set_notation('independent_sets_cycle');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('independent_sets_cycle','count = Lucas numbers (independent sets of C_n) for n=1..7','eq','2,3,4,7,11,18,29','the cyclic analogue of sparse_subsets (Fibonacci)',$q$
    SELECT string_agg(cardinality(independent_sets_cycle(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n $q$),
  ('independent_sets_cycle','independent_sets_cycle(4) = the 7 independent sets of C₄','eq','0000,0001,0010,0100,0101,1000,1010','1001 dropped: positions 1 and 4 are cyclically adjacent',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(independent_sets_cycle(4)) e $q$),
  ('independent_sets_cycle','contains via <@: 1010 ∈, 1001 ∉ (wrap edge), 0110 ∉ (adjacent)','eq','true|false|false','no two cyclically adjacent 1s',$q$
    SELECT (ROW(ARRAY[1,0,1,0])::binary_word <@ independent_sets_cycle(4))::text || '|' ||
           (ROW(ARRAY[1,0,0,1])::binary_word <@ independent_sets_cycle(4))::text || '|' ||
           (ROW(ARRAY[0,1,1,0])::binary_word <@ independent_sets_cycle(4))::text $q$);
