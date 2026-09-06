-- requires: realizer, utilities
-- words — ported from old-backup 38-words.sql (+ 56-words-engines.sql). The words (tuples) of length `size`
-- over an alphabet of `base` letters, i.e. the functions [size] -> [base]; equivalently the mixed-radix
-- numerals of `size` digits in base `base`. |words(size, base)| = base^size (A000012 unfolds this at base=1;
-- the general two-axis family has no single OEIS sequence). binary_words is the base=2 specialization: it keeps
-- its own 0/1 `binary_word` carrier + bitstring notation, but RELABELS this engine at base 2 (bit = letter − 1).
--
-- Multi-grade chain [size, base]: `size` is a true grade axis; `base` is a family PARAMETER (#67 D7) — it selects
-- which alphabet (which collection), is not recoverable from a single word, and has NO default range. words(n, base)
-- binds the rankable fiber; words(n) alone leaves base unbound (the family skeleton). Fiber [size,base] = all `size`-length tuples over
-- {1..base}, in lexicographic order (most-significant letter first) — rank 0 is the all-1s word, matching the
-- old mixed-radix numeral ranking. count of a fiber = base^size (pow_int, exact).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE word AS (letters int[]);                                  -- 1-based letters; {1,1,2} over base>=2
CREATE FUNCTION notation(w word) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((w).letters, ',') $$;

CREATE TYPE words_fiber AS (size natural_number, base natural_number);   -- typed fiber; axes: size, base
-- ── the FLOOR: build words letter-by-letter, each letter in [1,base]; emit in lex order ────────────────
CREATE FUNCTION fiber_elements(f words_fiber, element_limit int) RETURNS SETOF word LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS letters, (f).size::int AS remaining
    UNION ALL
    SELECT letters || a, remaining - 1
      FROM build, LATERAL generate_series(1, (f).base::int) a
     WHERE remaining > 0
  )
  SELECT ROW(letters)::word FROM build
   WHERE remaining = 0
   ORDER BY letters
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int((f).base::int, (f).size::int) $$;                    -- base^size (exact; 0^0 = 1, the empty word)
CREATE FUNCTION contains_in_fiber(f words_fiber, v word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).letters, 1), 0) = (f).size::int    -- exactly `size` letters
     AND coalesce((SELECT bool_and(l BETWEEN 1 AND (f).base::int) FROM unnest((v).letters) l), true) $$;   -- each letter in [1,base]
-- direct unrank (capability layer 3): the ord-th word in lex order = ord's `size`-digit base-`base` numeral, most-
-- significant digit first, each digit lifted to a 1-based letter. O(size), no floor scan — makes words indexable.
CREATE FUNCTION fiber_unrank(f words_fiber, rank rank_index) RETURNS word LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT (1 + (rank / pow_int((f).base::int, i)::bigint) % (f).base::int)::int
      FROM generate_series((f).size::int - 1, 0, -1) i))::word $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('words', 'word');
INSERT INTO base_grade (collection, pos, name, lo_expr, hi_expr, role, admissible) VALUES
  ('words', 1, 'size', NULL, NULL, 'axis',  NULL),                    -- the word length: a true grade (recoverable = array length)
  ('words', 2, 'base', NULL, NULL, 'param', 'base >= 1');             -- the alphabet size: a family PARAMETER (#67, D7 — no default range; not recoverable from a word once base ≥ max letter)
CREATE FUNCTION fiber_symbol(f words_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '[' || (f).base::int || ']' || to_unicode_superscript((f).size) $$;   -- corpus symbol

SELECT base_realize('words');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('words','words of length 4 over base 3 (anchor)','eq','81','3^4 via the accel',$q$
    SELECT cardinality(words(4,3))::text $q$),
  ('words','words of length 3 over base 2 (anchor)','eq','8','2^3 via the accel',$q$
    SELECT cardinality(words(3,2))::text $q$),
  ('words','words(2,2) enumerated in lex order','eq','1,1,1,2,2,1,2,2','the realized floor for fiber [2,2]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(words(2,2)) e $q$),
  ('words','words(2,3) enumerated in lex order','eq','1,1,1,2,1,3,2,1,2,2,2,3,3,1,3,2,3,3','the realized floor for fiber [2,3]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(words(2,3)) e $q$),
  ('words','multi-grade chain: fiber = (size,base) named axes','eq','2|3','unrank(words(2,3), 0).fiber is (size=2,base=3)',$q$
    SELECT (unrank(words(2,3), 0)).fiber.size::text || '|' || (unrank(words(2,3), 0)).fiber.base::text $q$),
  ('words','unrank(words(2,3), 5) = 2,3 (mixed-radix rank 5)','eq','2,3','the r-th element in lex order',$q$
    SELECT notation((unrank(words(2,3), 5)).value) $q$),
  ('words','n = 0 => one empty word, whatever the base','eq','1|','base^0 = 1; the empty letter tuple',$q$
    SELECT cardinality(words(0,5))::text || '|' || notation((unrank(words(0,5), 0)).value) $q$),
  -- (#67 D7) base is now role='param' — no 1..size default range, so words(3) with base UNBOUND is the family
  -- skeleton, not a fiber unfold. The retired examples (cardinality(words(3)) = 36; fibers(words(3)) = base 1,2,3)
  -- are gone; base must be bound. The counts differential below binds base explicitly and still holds:
  ('words','fiber counts for size=4 over base=1..5: 1,16,81,256,625','eq','1,16,81,256,625','base bound per term',$q$
    SELECT string_agg(cardinality(words(4,base))::text, ',' ORDER BY base) FROM generate_series(1,5) base $q$),
  ('words','every element of fiber [4,3] has 4 letters, each in [1,3]','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(array_length(((e).value).letters, 1) = 4
                AND NOT EXISTS (SELECT 1 FROM unnest(((e).value).letters) l WHERE l < 1 OR l > 3))::text
      FROM elements(words(4,3)) e $q$),
  ('words','contains via <@: {1,1,2} in words(3,2), {1,1,2} not in words(3,1), {1,1,3} not in words(3,2)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[1,1,2])::word <@ words(3,2))::text || '|' ||
           (ROW(ARRAY[1,1,2])::word <@ words(3,1))::text || '|' ||
           (ROW(ARRAY[1,1,3])::word <@ words(3,2))::text $q$);
