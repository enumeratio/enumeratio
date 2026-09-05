-- requires: hyperbinary_representations, realizer, utilities
-- hyperbinary_representations statistics — digit-count invariants over the widened {0,1,2} alphabet: ones and twos
-- are the two nonzero-digit counts (their sum is nonzero_digits, were that registered separately).

-- ── statistics (carrier: hyperbinary_word(digits int[]) over {0,1,2}) ──────────────────────────────────
-- ones: the number of 1-digits.
CREATE FUNCTION hyperbinary_ones(w hyperbinary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((w).digits) d WHERE d = 1 $$;
-- twos: the number of 2-digits (a "carry" digit — the source of hyperbinary non-uniqueness).
CREATE FUNCTION hyperbinary_twos(w hyperbinary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((w).digits) d WHERE d = 2 $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('hyperbinary_representations','ones','hyperbinary_ones','Ones','natural_numbers'),
  ('hyperbinary_representations','twos','hyperbinary_twos','Twos','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- the 3 hyperbinary numerals of 4 (from hyperbinary_representations.sql's own example): 100,020,012.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('hyperbinary_representations','ones over hyperbinary_representations(4) in order is 1,0,1','eq','1,0,1','100 has one 1; 020 has none; 012 has one',$q$
    SELECT string_agg(hyperbinary_ones((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(hyperbinary_representations(4)) e $q$),
  ('hyperbinary_representations','twos over hyperbinary_representations(4) in order is 0,1,1','eq','0,1,1','100 has none; 020 and 012 each have one',$q$
    SELECT string_agg(hyperbinary_twos((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(hyperbinary_representations(4)) e $q$),
  ('hyperbinary_representations','a numeral''s value determines a linear relation: Σ 2^i·digit = n, distinct from ones+2·twos','eq','true','a widened digit does NOT just double-count — position matters (structural sanity, n=6)',$q$
    SELECT bool_and(
        (SELECT coalesce(sum(x::bigint * (2::bigint ^ (array_length(((e).value).digits,1) - i))::bigint), 0)
           FROM unnest(((e).value).digits) WITH ORDINALITY AS t(x, i)) = 6)::text
      FROM elements(hyperbinary_representations(6)) e $q$),
  ('hyperbinary_representations','ones(1,1,0) = 2, twos(1,1,0) = 0','eq','2|0','the standard binary numeral 110 has no 2-digits',$q$
    SELECT hyperbinary_ones(ROW(ARRAY[1,1,0])::hyperbinary_word)::text || '|' ||
           hyperbinary_twos(ROW(ARRAY[1,1,0])::hyperbinary_word)::text $q$),
  ('hyperbinary_representations','ones(0,2,2) = 0, twos(0,2,2) = 2','eq','0|2','the all-carry numeral',$q$
    SELECT hyperbinary_ones(ROW(ARRAY[0,2,2])::hyperbinary_word)::text || '|' ||
           hyperbinary_twos(ROW(ARRAY[0,2,2])::hyperbinary_word)::text $q$);
