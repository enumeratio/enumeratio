-- requires: binary_words, tri_compositions, realizer, utilities
-- tri_strings — binary words of length n with NO three consecutive 1s ("111"-avoiding / tribonacci strings). Count
-- follows the tribonacci recurrence t(n)=t(n-1)+t(n-2)+t(n-3): 1,2,4,7,13,24,44,81,149 for n=0..8 (A000073 shifted;
-- same count as tri_compositions, a {1,2,3}-composition of n+1 via the run-length bijection). base_restrict of
-- binary_words — the natural step up from fib_strings (no "11") to no "111".

CREATE FUNCTION is_tri_string(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_series(1, coalesce(array_length((w).bits,1),0) - 2) i
                     WHERE (w).bits[i] = 1 AND (w).bits[i+1] = 1 AND (w).bits[i+2] = 1) $$;   -- no three-in-a-row 1s

-- accel hook (#172): |tri_strings(n)| = |tri_compositions(n+1)| (the run-length bijection shifts by one) — reuses
-- tri_compositions.sql's tribonacci_composition_count rather than redefining the recurrence.
CREATE FUNCTION tri_string_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT tribonacci_composition_count((f).n::int + 1) $$;

SELECT base_restrict('tri_strings', 'binary_words', 'is_tri_string', count_fn => 'tri_string_count');
CREATE FUNCTION fiber_symbol(f tri_strings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Tri(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('tri_strings');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('tri_strings','count = tribonacci for n=0..8: 1,2,4,7,13,24,44,81,149','eq','1,2,4,7,13,24,44,81,149','111-avoiding binary words (A000073 shifted)',$q$
    SELECT string_agg(cardinality(tri_strings(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('tri_strings','tri_strings(3) enumerated = every length-3 word except 111','eq','000,001,010,011,100,101,110','7 of the 8 words (only 111 excluded)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(tri_strings(3)) e $q$),
  ('tri_strings','no element of any fiber has three adjacent 1s (n=0..7)','eq','true','the defining invariant across the floor',$q$
    SELECT bool_and(is_tri_string((e).value)) FROM elements(tri_strings(0,7)) e $q$),
  ('tri_strings','contains via <@: 0110 ∈ tri(4) (only a pair), 0111 ∉ (a triple)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[0,1,1,0])::binary_word <@ tri_strings(4))::text || '|' ||
           (ROW(ARRAY[0,1,1,1])::binary_word <@ tri_strings(4))::text $q$);
