-- requires: realizer, words
-- binary_words — the length-n binary words {0,1}ⁿ, REALIZED as words(n, 2) relabelled to bits. A word over the
-- 1-based alphabet {1,2} becomes a bit vector by letter − 1 (and back by bit + 1); binary_words keeps its own
-- 0/1 `binary_word` carrier + bitstring notation, but its floor / count / contains / unrank all delegate to the
-- generic words engine at base 2 — so the enumeration IS words-at-2's, carried across the relabel. Single grade [n].
-- Canonical order: value 0..2ⁿ−1 as its bit vector, MSB first — the words lex order over {1,2} maps onto it, so
-- ordinality IS the integer value. cardinality(n) = 2ⁿ.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE binary_word AS (bits int[]);                               -- MSB first; {1,0,1} = 101 = 5
CREATE FUNCTION notation(w binary_word) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT array_to_string((w).bits, '') $$;

-- the relabel bijection binary_word ↔ word: a bit is its {1,2}-letter shifted down by one (and back up by one).
CREATE FUNCTION binary_word_of_word(w word) RETURNS binary_word LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT l - 1 FROM unnest((w).letters) WITH ORDINALITY t(l, o) ORDER BY o))::binary_word $$;
CREATE FUNCTION word_of_binary_word(w binary_word) RETURNS word LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT b + 1 FROM unnest((w).bits) WITH ORDINALITY t(b, o) ORDER BY o))::word $$;

-- ── the engines: relabel the words(n, 2) engine ──────────────────────────────────────────────────────
CREATE TYPE binary_words_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION words_fiber_of(f binary_words_fiber) RETURNS words_fiber LANGUAGE sql IMMUTABLE AS $$ SELECT ROW((f).n, 2)::words_fiber $$;   -- n letters over base 2
CREATE FUNCTION fiber_elements(f binary_words_fiber, element_limit int) RETURNS SETOF binary_word LANGUAGE sql STABLE AS $$
  SELECT binary_word_of_word(v) FROM fiber_elements(words_fiber_of(f), element_limit) v $$;
CREATE FUNCTION fiber_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fiber_count(words_fiber_of(f)) $$;   -- base^n = 2^n
CREATE FUNCTION contains_in_fiber(f binary_words_fiber, v binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(words_fiber_of(f), word_of_binary_word(v)) $$;   -- length n, every bit 0/1 (letters 1/2)

-- direct unrank (capability layer 3): the words mixed-radix unrank at base 2, relabelled to bits.
CREATE FUNCTION fiber_unrank(f binary_words_fiber, rank rank_index) RETURNS binary_word LANGUAGE sql IMMUTABLE AS $fu$ SELECT binary_word_of_word(fiber_unrank(words_fiber_of(f), rank)) $fu$;
INSERT INTO base_collection VALUES ('binary_words', 'binary_word');
INSERT INTO base_grade VALUES ('binary_words', 1, 'n', NULL, NULL);
SELECT base_realize('binary_words');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('binary_words','words of length 3 in value order','eq','000,001,010,011,100,101,110,111','realized fiber [3], MSB-first',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(binary_words(3)) e $q$),
  ('binary_words','|length 3| = 8 = 2^3 (accel)','eq','8','realized cardinality via the accel',$q$
    SELECT cardinality(binary_words(3))::text $q$),
  ('binary_words','count anchor 2^n for n = 0..5','eq','1,2,4,8,16,32','the known sequence for several small n',$q$
    SELECT string_agg(cardinality(binary_words(n))::text, ',' ORDER BY n) FROM generate_series(0, 5) n $q$),
  ('binary_words','unrank(binary_words(3), 5) = 101 (ordinality = value)','eq','101','the r-th element, then its value',$q$
    SELECT notation((unrank(binary_words(3), 5)).value) $q$),
  ('binary_words','n = 0 ⇒ one empty word','eq','1|','2^0 = 1; the empty bit vector',$q$
    SELECT cardinality(binary_words(0))::text || '|' || notation((unrank(binary_words(0), 0)).value) $q$),
  ('binary_words','element carries a TYPED point fiber + ordinality','eq','3|5','unrank(binary_words(3), 5)',$q$
    SELECT (unrank(binary_words(3), 5)).fiber.n::text || '|' || ordinality(unrank(binary_words(3), 5))::text $q$),
  ('binary_words','range constructor: fibers(binary_words(1,3)) unfold to n = 1,2,3','eq','1,2,3','the (lo,hi) range form',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(binary_words(1,3)) f $q$),
  ('binary_words','range handle: cardinality(binary_words(1,3)) = 14 = 2+4+8','eq','14','2^1+2^2+2^3 summed over fibers',$q$
    SELECT cardinality(binary_words(1,3))::text $q$),
  ('binary_words','unrank crosses fibers (rank 2 = first length-2 word 00)','eq','00','ranks 0,1 are n=1; rank 2 = n=2',$q$
    SELECT notation((unrank(binary_words(1,3), 2)).value) $q$),
  ('binary_words','contains: 101 ∈, 10 ∉ (wrong len), 200 ∉ (non-binary)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT contains(binary_words(3), ROW(ARRAY[1,0,1])::binary_word)::text || '|' ||
           contains(binary_words(3), ROW(ARRAY[1,0])::binary_word)::text || '|' ||
           contains(binary_words(3), ROW(ARRAY[2,0,0])::binary_word)::text $q$),
  ('binary_words','the <@ operator works too: 111 <@ binary_words(3)','eq','true','operator wrapper',$q$
    SELECT (ROW(ARRAY[1,1,1])::binary_word <@ binary_words(3))::text $q$),
  ('binary_words','realized as words(4,2): binary_words(4) IS words(4,2) relabelled bit = letter − 1, rank-aligned','eq','true','the relabel bijection preserves the enumeration order',$q$
    SELECT (ARRAY(SELECT notation((bw).value) FROM elements(binary_words(4)) bw ORDER BY ordinality(bw))
          = ARRAY(SELECT array_to_string(ARRAY(SELECT l - 1 FROM unnest(((w).value).letters) WITH ORDINALITY t(l,o) ORDER BY o), '')
                    FROM elements(words(4,2)) w ORDER BY ordinality(w)))::text $q$);
