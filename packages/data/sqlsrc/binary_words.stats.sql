-- requires: binary_words, realizer, utilities
-- binary_words statistics & maps — classic word invariants over {0,1}: the number of ones (popcount, binomially
-- distributed), descents (a 1 immediately followed by a 0), the longest run of ones, the number of runs (maximal
-- equal-bit blocks, distributed as 2·C(n-1,k-1)), and the integer value the word encodes (MSB first). COMPLEMENT
-- (flip every bit) and REVERSE (read right-to-left) are both binary_word involutions — they land back on the fiber.

-- ── statistics (carrier: binary_word(bits int[]) of 0/1, MSB first) ──────────────────────────────────────
-- number of ones: the Hamming weight / popcount. Binomially distributed over binary_words(n).
CREATE FUNCTION binary_word_number_of_ones(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(b), 0)::int FROM unnest((w).bits) b $$;
-- descents: positions where a 1 is immediately followed by a 0 (bits[i] > bits[i+1]).
CREATE FUNCTION binary_word_descents(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((w).bits, 1) i
   WHERE i < array_length((w).bits, 1) AND (w).bits[i] > (w).bits[i+1] $$;
-- longest run of ones: the length of the longest maximal block of consecutive 1s (islands of 1).
CREATE FUNCTION binary_word_longest_run_of_ones(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(cnt), 0)::int FROM (
    SELECT count(*) cnt FROM (
      SELECT o - row_number() OVER (ORDER BY o) AS g
      FROM unnest((w).bits) WITH ORDINALITY AS t(b, o) WHERE b = 1) z
    GROUP BY g) q $$;
-- number of runs: the count of maximal blocks of equal consecutive bits (0 for the empty word). Distributed as
-- 2·C(n-1, k-1) over binary_words(n): choose the k-1 change positions, times two for the leading bit.
CREATE FUNCTION binary_word_number_of_runs(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN array_length((w).bits, 1) IS NULL THEN 0
              ELSE 1 + (SELECT count(*)::int FROM generate_subscripts((w).bits, 1) i
                         WHERE i < array_length((w).bits, 1) AND (w).bits[i] <> (w).bits[i+1]) END $$;
-- value: the non-negative integer the word encodes, MSB first (bits[1] is the high bit).
CREATE FUNCTION binary_word_value(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(b * (1 << (array_length((w).bits, 1) - o)::int))::int, 0)
  FROM unnest((w).bits) WITH ORDINALITY AS t(b, o) $$;

-- ── maps → binary_words ─────────────────────────────────────────────────────────────────────────────────
-- complement: flip every bit, w'(i) = 1 − w(i). An involution on each fiber.
CREATE FUNCTION binary_word_complement(w binary_word) RETURNS binary_word LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT 1 - b FROM unnest((w).bits) WITH ORDINALITY AS t(b, o) ORDER BY o))::binary_word $$;
-- reverse: read the word right-to-left, w'(i) = w(n+1−i). An involution on each fiber.
CREATE FUNCTION binary_word_reverse(w binary_word) RETURNS binary_word LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT (w).bits[array_length((w).bits, 1) + 1 - i]
                   FROM generate_subscripts((w).bits, 1) i))::binary_word $$;

-- ── register in base_stat / base_map ────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('binary_words','number_of_ones','binary_word_number_of_ones','Number of ones','natural_numbers'),
  ('binary_words','descents','binary_word_descents','Descents','natural_numbers'),
  ('binary_words','longest_run_of_ones','binary_word_longest_run_of_ones','Longest run of ones','natural_numbers'),
  ('binary_words','number_of_runs','binary_word_number_of_runs','Number of runs','natural_numbers'),
  ('binary_words','value','binary_word_value','Value','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('binary_words','complement','binary_word_complement','binary_words','Complement',NULL),
  ('binary_words','reverse','binary_word_reverse','binary_words','Reverse',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- binary_words(3) in rank order: 000,001,010,011,100,101,110,111 (8 words); binary_words(4) has 16 words.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('binary_words','number of ones is binomial over binary_words(4): distribution 1,4,6,4,1','eq','1,4,6,4,1','#ones = 0..4 ⇒ C(4,k)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT binary_word_number_of_ones((e).value) k, count(*) c FROM elements(binary_words(4)) e GROUP BY 1) t(k,c) $q$),
  ('binary_words','number of ones: 10110=3, 1101=3, 101=2','eq','3|3|2','Hamming weight / popcount',$q$
    SELECT binary_word_number_of_ones(ROW(ARRAY[1,0,1,1,0])::binary_word)::text || '|' ||
           binary_word_number_of_ones(ROW(ARRAY[1,1,0,1])::binary_word)::text || '|' ||
           binary_word_number_of_ones(ROW(ARRAY[1,0,1])::binary_word)::text $q$),
  ('binary_words','descents distribution over binary_words(4) is 5,10,1','eq','5,10,1','#(1 then 0) = 0,1,2',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT binary_word_descents((e).value) k, count(*) c FROM elements(binary_words(4)) e GROUP BY 1) t(k,c) $q$),
  ('binary_words','descents: 10110=2, 1101=1, 0110=1','eq','2|1|1','a 1 immediately followed by a 0',$q$
    SELECT binary_word_descents(ROW(ARRAY[1,0,1,1,0])::binary_word)::text || '|' ||
           binary_word_descents(ROW(ARRAY[1,1,0,1])::binary_word)::text || '|' ||
           binary_word_descents(ROW(ARRAY[0,1,1,0])::binary_word)::text $q$),
  ('binary_words','longest run of ones distribution over binary_words(4) is 1,7,5,2,1','eq','1,7,5,2,1','longest 1-block = 0..4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT binary_word_longest_run_of_ones((e).value) k, count(*) c FROM elements(binary_words(4)) e GROUP BY 1) t(k,c) $q$),
  ('binary_words','longest run of ones: 10110=2, 1101=2, 101=1','eq','2|2|1','longest maximal block of 1s',$q$
    SELECT binary_word_longest_run_of_ones(ROW(ARRAY[1,0,1,1,0])::binary_word)::text || '|' ||
           binary_word_longest_run_of_ones(ROW(ARRAY[1,1,0,1])::binary_word)::text || '|' ||
           binary_word_longest_run_of_ones(ROW(ARRAY[1,0,1])::binary_word)::text $q$),
  ('binary_words','number of runs distribution over binary_words(4) is 2,6,6,2','eq','2,6,6,2','k runs ⇒ 2·C(3,k-1), k=1..4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT binary_word_number_of_runs((e).value) k, count(*) c FROM elements(binary_words(4)) e GROUP BY 1) t(k,c) $q$),
  ('binary_words','number of runs: 10110=4, 0110=3, 101=3','eq','4|3|3','maximal equal-bit blocks',$q$
    SELECT binary_word_number_of_runs(ROW(ARRAY[1,0,1,1,0])::binary_word)::text || '|' ||
           binary_word_number_of_runs(ROW(ARRAY[0,1,1,0])::binary_word)::text || '|' ||
           binary_word_number_of_runs(ROW(ARRAY[1,0,1])::binary_word)::text $q$),
  ('binary_words','value over binary_words(3) in rank order is 0..7','eq','0,1,2,3,4,5,6,7','value = ordinality (canonical order is by value)',$q$
    SELECT string_agg(binary_word_value((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(binary_words(3)) e $q$),
  ('binary_words','value: 101=5, 10110=22, 1101=13','eq','5|22|13','integer encoded MSB first',$q$
    SELECT binary_word_value(ROW(ARRAY[1,0,1])::binary_word)::text || '|' ||
           binary_word_value(ROW(ARRAY[1,0,1,1,0])::binary_word)::text || '|' ||
           binary_word_value(ROW(ARRAY[1,1,0,1])::binary_word)::text $q$),
  ('binary_words','empty word (n=0): every stat is 0','eq','0|0|0|0|0','edge case, no bits',$q$
    SELECT binary_word_number_of_ones((unrank(binary_words(0),0)).value)::text || '|' ||
           binary_word_descents((unrank(binary_words(0),0)).value)::text || '|' ||
           binary_word_longest_run_of_ones((unrank(binary_words(0),0)).value)::text || '|' ||
           binary_word_number_of_runs((unrank(binary_words(0),0)).value)::text || '|' ||
           binary_word_value((unrank(binary_words(0),0)).value)::text $q$),
  ('binary_words','complement over binary_words(3) in rank order','eq','111,110,101,100,011,010,001,000','flip every bit',$q$
    SELECT string_agg(notation(binary_word_complement((e).value)), ',' ORDER BY ordinality(e)) FROM elements(binary_words(3)) e $q$),
  ('binary_words','complement is an involution on binary_words(4)','eq','true','applying it twice is the identity',$q$
    SELECT bool_and(((binary_word_complement(binary_word_complement((e).value))).bits) = ((e).value).bits)::text
      FROM elements(binary_words(4)) e $q$),
  ('binary_words','reverse over binary_words(3) in rank order','eq','000,100,010,110,001,101,011,111','read right-to-left',$q$
    SELECT string_agg(notation(binary_word_reverse((e).value)), ',' ORDER BY ordinality(e)) FROM elements(binary_words(3)) e $q$),
  ('binary_words','reverse is an involution on binary_words(4)','eq','true','applying it twice is the identity',$q$
    SELECT bool_and(((binary_word_reverse(binary_word_reverse((e).value))).bits) = ((e).value).bits)::text
      FROM elements(binary_words(4)) e $q$),
  ('binary_words','map images render in the codomain (binary_words) form via render_value','eq','010|011','complement(101), reverse(110)',$q$
    SELECT render_value(binary_word_complement(ROW(ARRAY[1,0,1])::binary_word)) || '|' ||
           render_value(binary_word_reverse(ROW(ARRAY[1,1,0])::binary_word)) $q$);
