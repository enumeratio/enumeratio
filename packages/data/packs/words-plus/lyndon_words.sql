-- requires: binary_words, number-theory, realizer, utilities
-- lyndon_words — the (binary) Lyndon words: words strictly smaller than every one of their proper rotations. Each is
-- the unique lex-least representative of an aperiodic rotation class, so they're the primitive-necklace reps sitting
-- inside primitive_binary_strings. Count A001037 = (1/n)·Σ_{d|n} μ(d)·2^(n/d): 2,1,2,3,6,9,18,… (over {0,1}; the
-- k-ary generalisation k_lyndon_words is a separate, not-yet-built collection). A RESTRICTION of binary_words.
CREATE FUNCTION is_binary_lyndon(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_series(1, coalesce(array_length((w).bits, 1), 0) - 1) d
    WHERE ((w).bits[d+1:] || (w).bits[1:d]) <= (w).bits) $$;   -- some proper rotation is ≤ w ⇒ not Lyndon

-- accel hook (#172): |Lyndon₂(n)| = (1/n)Σ_{d|n} μ(d)·2^(n/d) for n≥1; n=0 is the vacuous empty word (the sum's
-- own n=0 division is undefined, so it's a genuine special case, not a formula that happens to work there).
CREATE FUNCTION binary_lyndon_word_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int = 0 THEN 1::numeric ELSE
    div((SELECT sum(mobius_function(d) * pow_int(2, (f).n::int / d)) FROM generate_series(1, (f).n::int) d WHERE (f).n::int % d = 0), (f).n::int)
  END $$;

SELECT base_restrict('lyndon_words', 'binary_words', 'is_binary_lyndon', count_fn => 'binary_lyndon_word_count');

CREATE FUNCTION fiber_symbol(f lyndon_words_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Lyn₂(' || (f).n::int || ')' $$;

SELECT wire_set_notation('lyndon_words');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('lyndon_words','count = A001037 (binary Lyndon words) for n=1..7','eq','2,1,2,3,6,9,18','(1/n)·Σ_{d|n} μ(d)·2^(n/d)',$q$
    SELECT string_agg(cardinality(lyndon_words(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n $q$),
  ('lyndon_words','lyndon_words(3) = 001, 011 (the two length-3 binary Lyndon words)','eq','001,011','lex-least of each aperiodic rotation class',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(lyndon_words(3)) e $q$),
  ('lyndon_words','contains via <@: 011 ∈, 010 ∉ (010 > its rotation 001), 000 ∉ (periodic)','eq','true|false|false','strictly less than every rotation',$q$
    SELECT (ROW(ARRAY[0,1,1])::binary_word <@ lyndon_words(3))::text || '|' ||
           (ROW(ARRAY[0,1,0])::binary_word <@ lyndon_words(3))::text || '|' ||
           (ROW(ARRAY[0,0,0])::binary_word <@ lyndon_words(3))::text $q$);
