-- requires: binary_words, number-theory, realizer, utilities
-- primitive_binary_strings — RESTRICTION of binary_words to the APERIODIC ones: no proper period d | n (d < n) with
-- bits[i] = bits[i−d] throughout. These are the primitive (non-repeating) binary words; count A027375 =
-- Σ_{d|n} μ(d)·2^(n/d): 2,2,6,12,30,54,126,… Each primitive word is the representative of an n-element rotation
-- class, so |primitive(n)|/n = the number of binary necklaces of length n with primitive period (Lyndon words).
CREATE FUNCTION is_primitive_binary_word(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_series(1, coalesce(array_length((w).bits, 1), 0) - 1) d
    WHERE array_length((w).bits, 1) % d = 0                                        -- d is a proper period candidate
      AND NOT EXISTS (SELECT 1 FROM generate_series(d + 1, array_length((w).bits, 1)) i
                      WHERE (w).bits[i] <> (w).bits[i - d])) $$;                    -- …and the word actually repeats with period d

-- accel hook (#172): |primitive(n)| = Σ_{d|n} μ(n/d)·2^d for n≥1; n=0 is the vacuous empty word.
CREATE FUNCTION primitive_binary_string_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int = 0 THEN 1::numeric ELSE
    (SELECT sum(mobius_function((f).n::int / d) * pow_int(2, d)) FROM generate_series(1, (f).n::int) d WHERE (f).n::int % d = 0)
  END $$;

SELECT base_restrict('primitive_binary_strings', 'binary_words', 'is_primitive_binary_word', count_fn => 'primitive_binary_string_count');

CREATE FUNCTION fiber_symbol(f primitive_binary_strings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Prim₂(' || (f).n::int || ')' $$;

SELECT wire_set_notation('primitive_binary_strings');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('primitive_binary_strings','count = A027375 (aperiodic binary words) for n=1..7','eq','2,2,6,12,30,54,126','Σ_{d|n} μ(d)·2^(n/d)',$q$
    SELECT string_agg(cardinality(primitive_binary_strings(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n $q$),
  ('primitive_binary_strings','n=4: 0101 and 1010 (period 2) and 0000/1111 (period 1) are dropped, 12 remain','eq','12','16 words minus the 4 periodic ones',$q$
    SELECT cardinality(primitive_binary_strings(4))::text $q$),
  ('primitive_binary_strings','contains via <@: 0010 ∈ (aperiodic), 0101 ∉ (period 2), 0000 ∉ (period 1)','eq','true|false|false','the primitivity test',$q$
    SELECT (ROW(ARRAY[0,0,1,0])::binary_word <@ primitive_binary_strings(4))::text || '|' ||
           (ROW(ARRAY[0,1,0,1])::binary_word <@ primitive_binary_strings(4))::text || '|' ||
           (ROW(ARRAY[0,0,0,0])::binary_word <@ primitive_binary_strings(4))::text $q$);
