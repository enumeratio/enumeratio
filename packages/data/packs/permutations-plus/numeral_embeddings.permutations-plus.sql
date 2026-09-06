-- requires: lehmer_codes, subexcedant_seqs, factoradic_numerals
-- Numeral embeddings (#300, §2c) — Lehmer codes and subexcedant sequences EMBED into the factoradic numerals; the
-- embedding is declared as a base_map of kind='embedding' (injective, not surjective — bijective-WITH the fixed-width
-- factoradics of n places, but NOT the same representation as factoradic_numerals' canonical minimal-width words).
-- This states the #293 verdict as data: Lehmer = the factoradic digits d_{n-1}…d_1 with place 0 DROPPED; dropping it
-- on the factoradic side would be wrong (the schedule continues past the point), so the trailing-zero rule is a
-- property of the MAP. factoradic_numerals lives in core, so these rows (collection = a permutations-plus carrier)
-- live here, not core.

-- Lehmer ↪ factoradic: append the implied trailing place-0 zero. The body is literally #293's `(v).code || 0`.
CREATE FUNCTION lehmer_to_factoradic(v permutation_inversion) RETURNS factoradic_numeral LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((v).code || 0)::factoradic_numeral $$;
-- Subexcedant ↪ factoradic: a different PRINTING of the same schedule — LSB-first, 1-based, so digit d_{i-1} = aᵢ − 1
-- (place i−1, radix i); reverse to MSB-first. Keeps the degenerate place 0 (a₁ = 1 always ⇒ d₀ = 0).
CREATE FUNCTION subexcedant_to_factoradic(s subexcedant_seq) RETURNS factoradic_numeral LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT (s).terms[i] - 1 FROM generate_subscripts((s).terms, 1) g(i) ORDER BY i DESC))::factoradic_numeral $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope, is_bijection, kind) VALUES
  ('lehmer_codes',     'to_factoradic', 'lehmer_to_factoradic',      'factoradic_numerals', 'To factoradic', 'collection', false, 'embedding'),
  ('subexcedant_seqs', 'to_factoradic', 'subexcedant_to_factoradic', 'factoradic_numerals', 'To factoradic', 'collection', false, 'embedding');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('lehmer_codes','to_factoradic appends the trailing 0: code {2,1} ↦ 210','eq','210','the #293 embedding, as data',$q$
    SELECT notation(lehmer_to_factoradic(ROW(ARRAY[2,1])::permutation_inversion)) $q$),
  ('lehmer_codes','embedding value = the permutation''s lex rank, over lehmer_codes(4)','ok',NULL,'Lehmer↪factoradic carries the rank as its factorial-base value',$q$
    SELECT bool_and(factoradic_value((lehmer_to_factoradic((e).value)).digits) = ordinality(e) - 1) FROM elements(lehmer_codes(4)) e $q$),
  ('lehmer_codes','round-trip: to_permutation ∘ (drop place 0) ∘ to_factoradic = to_permutation, over lehmer_codes(4)','ok',NULL,'#300: the embedding is invertible onto the integer factoradics of n places',$q$
    SELECT bool_and(
      to_permutation(ROW((lehmer_to_factoradic((e).value)).digits[1 : cardinality((lehmer_to_factoradic((e).value)).digits) - 1])::permutation_inversion)
      = to_permutation((e).value)) FROM elements(lehmer_codes(4)) e $q$),
  ('lehmer_codes','base_map records kind=embedding (injective, not a bijection)','eq','embedding|false','D6: kind refines the map shape',$q$
    SELECT kind || '|' || is_bijection::text FROM base_map WHERE collection='lehmer_codes' AND map_id='to_factoradic' $q$),
  ('subexcedant_seqs','to_factoradic is a different printing: (1,2,3) ↦ digits 2,1,0','eq','210','dᵢ₋₁ = aᵢ − 1, reversed to MSB-first',$q$
    SELECT notation(subexcedant_to_factoradic(ROW(ARRAY[1,2,3])::subexcedant_seq)) $q$),
  ('subexcedant_seqs','to_factoradic is injective over subexcedant_seqs(4) — 24 distinct factoradic words','eq','24','the embedding, not a collapse',$q$
    SELECT count(DISTINCT notation(subexcedant_to_factoradic((e).value)))::text FROM elements(subexcedant_seqs(4)) e $q$);
