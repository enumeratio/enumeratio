-- requires: binary_words, lucas_numbers, realizer, utilities
-- lucas_strings — CIRCULAR binary words of length n with no two consecutive 1s, the wrap edge (position n ↔ 1)
-- included. Count = 1,1,3,4,7,11,18,29,47 for n=0..8 — the Lucas numbers (A000032, with the empty word taken as 1
-- at n=0). Companion to fib_strings (linear no-11, Fibonacci). Distinct from independent_sets_cycle ONLY at n=1:
-- here the length-1 cycle is a self-loop, so "1" is excluded (independent_sets_cycle treats C₁ as edgeless and keeps
-- it). base_restrict of binary_words; the predicate policing every cyclic-adjacent pair, i and (i mod n)+1.

CREATE FUNCTION is_lucas_string(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_series(1, coalesce(array_length((w).bits,1),0)) i
                     WHERE (w).bits[i] = 1 AND (w).bits[(i % array_length((w).bits,1)) + 1] = 1) $$;   -- cyclic no-11 (wrap included)

-- accel hook (#172): the Lucas numbers, EXCEPT n=0 (the file header's "empty word taken as 1" deviates from
-- lucas_term(0)=2 — a genuine special case, not a formula that happens to work at the boundary).
CREATE FUNCTION lucas_string_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int = 0 THEN 1::numeric ELSE lucas_term((f).n::term_index) END $$;

SELECT base_restrict('lucas_strings', 'binary_words', 'is_lucas_string', count_fn => 'lucas_string_count');
CREATE FUNCTION fiber_symbol(f lucas_strings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Luc(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('lucas_strings');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('lucas_strings','count = Lucas for n=0..8: 1,1,3,4,7,11,18,29,47','eq','1,1,3,4,7,11,18,29,47','circular 11-avoiding binary words (A000032)',$q$
    SELECT string_agg(cardinality(lucas_strings(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('lucas_strings','lucas_strings(4) enumerated','eq','0000,0001,0010,0100,0101,1000,1010','1001 dropped (wrap edge); the 7 independent sets of C₄',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(lucas_strings(4)) e $q$),
  ('lucas_strings','the C₁ self-loop: "0" ∈ lucas(1) but "1" ∉ (differs from independent_sets_cycle)','eq','1|0','n=1 has a single element; the lone "1" fails the wrap edge',$q$
    SELECT cardinality(lucas_strings(1))::text || '|' ||
           (ROW(ARRAY[1])::binary_word <@ lucas_strings(1))::int::text $q$),
  ('lucas_strings','contains via <@: 1010 ∈ luc(4), 1001 ∉ (wrap edge), 0110 ∉ (adjacent)','eq','true|false|false','no two cyclically adjacent 1s',$q$
    SELECT (ROW(ARRAY[1,0,1,0])::binary_word <@ lucas_strings(4))::text || '|' ||
           (ROW(ARRAY[1,0,0,1])::binary_word <@ lucas_strings(4))::text || '|' ||
           (ROW(ARRAY[0,1,1,0])::binary_word <@ lucas_strings(4))::text $q$);
