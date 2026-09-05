-- requires: binary_words, fibonacci, realizer, utilities
-- fib_strings — binary words of length n with NO two consecutive 1s ("11"-avoiding / Fibonacci strings). Count =
-- F(n+2): 1,2,3,5,8,13,21,34,55 for n=0..8 (A000045 shifted). In bijection with the independent sets of the path
-- graph P_n and with the {1,2}-compositions of n+1 (a run of k zeros then a 1 ↦ a part k+1). The LINEAR analogue of
-- independent_sets_cycle (circular no-11 = Lucas); shares the count of step_compositions. base_restrict of binary_words.

CREATE FUNCTION is_fib_string(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_series(1, coalesce(array_length((w).bits,1),0) - 1) i
                     WHERE (w).bits[i] = 1 AND (w).bits[i+1] = 1) $$;   -- no two linearly adjacent 1s

-- accel hook (#172): |fib_strings(n)| = F(n+2), reusing fibonacci.sql's fibonacci_term rather than redefining it.
CREATE FUNCTION fib_string_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT fibonacci_term((f).n::int + 2) $$;

SELECT base_restrict('fib_strings', 'binary_words', 'is_fib_string', count_fn => 'fib_string_count');
CREATE FUNCTION fiber_symbol(f fib_strings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Fib(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('fib_strings');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fib_strings','count = F(n+2) for n=0..8: 1,2,3,5,8,13,21,34,55','eq','1,2,3,5,8,13,21,34,55','11-avoiding binary words (A000045 shifted)',$q$
    SELECT string_agg(cardinality(fib_strings(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('fib_strings','fib_strings(3) enumerated','eq','000,001,010,100,101','the 5 words of length 3 with no 11, lex order',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(fib_strings(3)) e $q$),
  ('fib_strings','no element of any fiber has two adjacent 1s (n=0..7)','eq','true','the defining invariant across the floor',$q$
    SELECT bool_and(is_fib_string((e).value)) FROM elements(fib_strings(0,7)) e $q$),
  ('fib_strings','contains via <@: 1010 ∈ fib(4), 0110 ∉ (adjacent 1s)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[1,0,1,0])::binary_word <@ fib_strings(4))::text || '|' ||
           (ROW(ARRAY[0,1,1,0])::binary_word <@ fib_strings(4))::text $q$);
