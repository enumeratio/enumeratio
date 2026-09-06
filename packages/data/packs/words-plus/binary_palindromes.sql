-- requires: binary_words, realizer, utilities
-- binary_palindromes — RESTRICTION of binary_words to the palindromes (bits read the same reversed). Count 2^⌈n/2⌉:
-- 1,2,2,4,4,8,8,… (the left half is free, the right half mirrors it). Re-ranked within each size fiber.
CREATE FUNCTION is_binary_palindrome(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((w).bits, '{}') = coalesce((SELECT array_agg(b ORDER BY o DESC) FROM unnest((w).bits) WITH ORDINALITY t(b, o)), '{}') $$;

-- accel hook (#172): |binary_palindromes(n)| = 2^⌈n/2⌉ — the free left half determines the mirrored right half.
CREATE FUNCTION binary_palindrome_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int(2, ((f).n::int + 1) / 2) $$;   -- integer division truncates ⇒ ⌈n/2⌉ for n≥0

SELECT base_restrict('binary_palindromes', 'binary_words', 'is_binary_palindrome', count_fn => 'binary_palindrome_count');

CREATE FUNCTION fiber_symbol(f binary_palindromes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Pal(' || (f).n::int || ')' $$;

SELECT wire_set_notation('binary_palindromes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('binary_palindromes','count = 2^⌈n/2⌉ for n=0..6','eq','1,2,2,4,4,8,8','binary palindromes',$q$
    SELECT string_agg(cardinality(binary_palindromes(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('binary_palindromes','binary_palindromes(3) = 000, 010, 101, 111','eq','000,010,101,111','the length-3 palindromes',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(binary_palindromes(3)) e $q$),
  ('binary_palindromes','contains via <@: 101 ∈, 100 ∉','eq','true|false','derived membership',$q$
    SELECT (ROW(ARRAY[1,0,1])::binary_word <@ binary_palindromes(3))::text || '|' ||
           (ROW(ARRAY[1,0,0])::binary_word <@ binary_palindromes(3))::text $q$);
