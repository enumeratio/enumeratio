-- requires: gray_codes, realizer, utilities
-- gray_codes statistics — the first stats on this collection. weight/runs/transitions/leading_zeros/
-- trailing_zeros are plain bit-vector invariants (same shape as binary_words' stats — noted, not a bug: #236
-- folded gray_codes onto the shared binary_word carrier, so both sets of stats resolve on the same collection,
-- and the Gray sequence is a permutation of the same words, so e.g. weight's distribution
-- matches binary_words' number_of_ones exactly). flip_position is the one Gray-specific stat: which bit flips
-- from the PREVIOUS codeword in Gray order — the ruler sequence (OEIS A007814 shifted to a 1-indexed bit
-- position), 0 for the first codeword (rank 0, no predecessor).
--
-- flip_position needs the predecessor's rank without touching the fiber: it recovers r from g alone via the
-- inverse reflected-Gray transform. g = r XOR (r>>1), so r's bits (same MSB-first convention) are the PREFIX
-- PARITY of g's bits: r_bit[j] = XOR(g_bit[1..j]) = sum(g_bit[1..j]) mod 2. The bit that flips going r-1 -> r is
-- r's lowest set bit, i.e. the LAST array position (closest to the LSB) where that prefix parity is 1 — which is
-- 0 (no position) exactly when g is all-zero, i.e. r = 0.

-- ── statistics (carrier: binary_word(bits int[]) of 0/1, MSB first) ──────────────────────────────────────
-- weight: the Hamming weight / popcount (number of 1 bits).
CREATE FUNCTION gray_code_weight(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(b), 0)::int FROM unnest((w).bits) b $$;
-- transitions: the number of 0<->1 adjacencies (bits[i] <> bits[i+1]). 0 for the empty word.
CREATE FUNCTION gray_code_transitions(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((w).bits, 1) i
   WHERE i < array_length((w).bits, 1) AND (w).bits[i] <> (w).bits[i+1] $$;
-- runs: the count of maximal blocks of equal consecutive bits — transitions + 1 (0 for the empty word).
CREATE FUNCTION gray_code_runs(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN array_length((w).bits, 1) IS NULL THEN 0 ELSE gray_code_transitions(w) + 1 END $$;
-- leading zeros: the length of the run of 0s before the first 1 (= n if the word is all-zero, including n=0).
CREATE FUNCTION gray_code_leading_zeros(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(min(i) - 1, coalesce(array_length((w).bits, 1), 0))::int
  FROM generate_subscripts((w).bits, 1) i WHERE (w).bits[i] = 1 $$;
-- trailing zeros: the length of the run of 0s after the last 1 (= n if the word is all-zero, including n=0).
CREATE FUNCTION gray_code_trailing_zeros(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(coalesce(array_length((w).bits, 1), 0) - max(i), coalesce(array_length((w).bits, 1), 0))::int
  FROM generate_subscripts((w).bits, 1) i WHERE (w).bits[i] = 1 $$;
-- flip position: the (1-indexed, MSB-first) array position of the bit that flipped from the previous codeword in
-- Gray order — see the derivation above. 0 for the first codeword of the fiber (rank 0: no predecessor).
CREATE FUNCTION gray_code_flip_position(w binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(o), 0)::int FROM (
    SELECT o, sum(b) OVER (ORDER BY o) % 2 AS parity
    FROM unnest((w).bits) WITH ORDINALITY AS t(b, o)) q
  WHERE parity = 1 $$;

-- ── register in base_stat ───────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('gray_codes','weight','gray_code_weight','Weight','natural_numbers'),
  ('gray_codes','runs','gray_code_runs','Number of runs','natural_numbers'),
  ('gray_codes','transitions','gray_code_transitions','Transitions','natural_numbers'),
  ('gray_codes','leading_zeros','gray_code_leading_zeros','Leading zeros','natural_numbers'),
  ('gray_codes','trailing_zeros','gray_code_trailing_zeros','Trailing zeros','natural_numbers'),
  ('gray_codes','flip_position','gray_code_flip_position','Flip position','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- gray_codes(3) in rank order (r=0..7): 000,001,011,010,110,111,101,100 (r XOR (r>>1), hand-expanded).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gray_codes','weight over gray_codes(3) in rank order is 0,1,2,1,2,3,2,1','eq','0,1,2,1,2,3,2,1','popcount of 000,001,011,010,110,111,101,100',$q$
    SELECT string_agg(gray_code_weight((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(gray_codes(3)) e $q$),
  ('gray_codes','weight is binomial over gray_codes(4): distribution 1,4,6,4,1, same multiset as binary_words(4)','eq','1,4,6,4,1','the Gray sequence is a permutation of the same 16 words',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT gray_code_weight((e).value) k, count(*) c FROM elements(gray_codes(4)) e GROUP BY 1) t(k,c) $q$),
  ('gray_codes','weight: 111=3, 110=2, 101=2','eq','3|2|2','via unrank(gray_codes(3),5)=111 and unrank(gray_codes(3),4)=110',$q$
    SELECT gray_code_weight((unrank(gray_codes(3),5)).value)::text || '|' ||
           gray_code_weight((unrank(gray_codes(3),4)).value)::text || '|' ||
           gray_code_weight(ROW(ARRAY[1,0,1])::binary_word)::text $q$),
  ('gray_codes','runs over gray_codes(3) in rank order is 1,2,2,3,2,1,3,2','eq','1,2,2,3,2,1,3,2','maximal constant-bit blocks',$q$
    SELECT string_agg(gray_code_runs((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(gray_codes(3)) e $q$),
  ('gray_codes','transitions over gray_codes(3) in rank order is 0,1,1,2,1,0,2,1','eq','0,1,1,2,1,0,2,1','= runs - 1',$q$
    SELECT string_agg(gray_code_transitions((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(gray_codes(3)) e $q$),
  ('gray_codes','transitions = runs - 1 over gray_codes(4)','eq','true','the defining relation, checked on all 16 words',$q$
    SELECT bool_and(gray_code_transitions((e).value) = gray_code_runs((e).value) - 1)::text FROM elements(gray_codes(4)) e $q$),
  ('gray_codes','leading_zeros over gray_codes(3) in rank order is 3,2,1,1,0,0,0,0','eq','3,2,1,1,0,0,0,0','run of 0s before the first 1',$q$
    SELECT string_agg(gray_code_leading_zeros((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(gray_codes(3)) e $q$),
  ('gray_codes','trailing_zeros over gray_codes(3) in rank order is 3,0,0,1,1,0,0,2','eq','3,0,0,1,1,0,0,2','run of 0s after the last 1',$q$
    SELECT string_agg(gray_code_trailing_zeros((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(gray_codes(3)) e $q$),
  ('gray_codes','flip_position over gray_codes(3) in rank order is 0,3,2,3,1,3,2,3','eq','0,3,2,3,1,3,2,3','ruler sequence (bit position, MSB-first); 0 = no predecessor',$q$
    SELECT string_agg(gray_code_flip_position((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(gray_codes(3)) e $q$),
  ('gray_codes','flip_position matches the differing bit index between consecutive codewords in gray_codes(4)','eq','true','independent check via direct adjacent-codeword diff, not the r-recovery derivation',$q$
    SELECT bool_and(
        gray_code_flip_position(cur.w) =
          (SELECT j FROM generate_subscripts(cur.bits, 1) j WHERE cur.bits[j] <> prev.bits[j])
      )::text
    FROM (SELECT ordinality(e) ord, (e).value w, ((e).value).bits bits FROM elements(gray_codes(4)) e) cur
    JOIN (SELECT ordinality(e) ord, ((e).value).bits bits FROM elements(gray_codes(4)) e) prev
      ON prev.ord = cur.ord - 1 $q$),
  ('gray_codes','flip_position distribution over gray_codes(4) is 0:1,1:1,2:2,3:4,4:8 (the ruler sequence)','eq','1,1,2,4,8','value 0 (rank 0, no predecessor) then 1..4 by count',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT gray_code_flip_position((e).value) k, count(*) c FROM elements(gray_codes(4)) e GROUP BY 1) t(k,c) $q$),
  ('gray_codes','empty word (n=0): every stat is 0','eq','0|0|0|0|0|0','edge case, no bits, rank 0 has no predecessor',$q$
    SELECT gray_code_weight((unrank(gray_codes(0),0)).value)::text || '|' ||
           gray_code_runs((unrank(gray_codes(0),0)).value)::text || '|' ||
           gray_code_transitions((unrank(gray_codes(0),0)).value)::text || '|' ||
           gray_code_leading_zeros((unrank(gray_codes(0),0)).value)::text || '|' ||
           gray_code_trailing_zeros((unrank(gray_codes(0),0)).value)::text || '|' ||
           gray_code_flip_position((unrank(gray_codes(0),0)).value)::text $q$);
