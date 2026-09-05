-- requires: words, k_ary_word_classes, integer_compositions, realizer, utilities
-- Issue #233, chunk 2 — the Chen–Fox–Lyndon (standard) factorization: every word w has a UNIQUE decomposition
-- w = w1·w2·…·wk into Lyndon factors with w1 ≥ w2 ≥ … ≥ wk (lexicographically non-increasing). Computed by
-- Duval's algorithm (1983), O(n). Two maps expose it: the factor LENGTHS as a composition of n, and the first
-- (lex-largest) factor as a k_lyndon_words element — the piece that makes Lyndon words the building blocks of
-- every word, the way primes are the building blocks of integers.

-- Duval's scan: returns the factor lengths in order (they sum to n). 1-based direct translation of the classical
-- 0-based pseudocode — i/j/k stay valid array indices throughout, only the loop bounds shift by one.
CREATE FUNCTION word_lyndon_factor_lengths_array(w word) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a int[] := (w).letters; n int := coalesce(array_length(a,1),0);
          i int := 1; j int; k int; lens int[] := '{}';
  BEGIN
    WHILE i <= n LOOP
      j := i + 1; k := i;
      WHILE j <= n AND a[k] <= a[j] LOOP
        IF a[k] < a[j] THEN k := i; ELSE k := k + 1; END IF;
        j := j + 1;
      END LOOP;
      WHILE i <= k LOOP
        lens := lens || (j - k);
        i := i + (j - k);
      END LOOP;
    END LOOP;
    RETURN lens;
  END $$;

CREATE FUNCTION word_lyndon_factor_lengths(w word) RETURNS composition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(word_lyndon_factor_lengths_array(w))::composition $$;
CREATE FUNCTION word_lyndon_first_factor(w word) RETURNS word LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((w).letters[1:coalesce((word_lyndon_factor_lengths_array(w))[1],0)])::word $$;

-- the full factor list (not just the first) — used only by the round-trip/non-increasing examples below.
CREATE FUNCTION word_lyndon_factors(w word) RETURNS word[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE lens int[] := word_lyndon_factor_lengths_array(w); letters int[] := (w).letters;
          i int := 1; result word[] := '{}'; l int;
  BEGIN
    FOREACH l IN ARRAY lens LOOP
      result := result || ROW(letters[i:i+l-1])::word;
      i := i + l;
    END LOOP;
    RETURN result;
  END $$;

-- ── register ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('words','lyndon_factor_lengths','word_lyndon_factor_lengths','integer_compositions','Lyndon factorization (factor lengths)',NULL),
  ('words','lyndon_first_factor','word_lyndon_first_factor','k_lyndon_words','Lyndon factorization (first factor)',NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('words','Lyndon factorization of 2,1,3,1,2 (base 3): factors 2 | 1,3 | 1,2, lengths 1+2+2, first factor 2','eq','1+2+2|2',
   'hand-verified via Duval''s algorithm: w1=(2) ≥ w2=(1,3) ≥ w3=(1,2)',$q$
    SELECT notation(word_lyndon_factor_lengths(ROW(ARRAY[2,1,3,1,2])::word)) || '|' ||
           notation(word_lyndon_first_factor(ROW(ARRAY[2,1,3,1,2])::word)) $q$),
  ('words','Lyndon factorization of 1,2,1,2 (base 2): two equal factors 1,2 | 1,2, lengths 2+2, first factor 1,2','eq','2+2|1,2',
   'a period-2 word factors into two copies of its Lyndon period',$q$
    SELECT notation(word_lyndon_factor_lengths(ROW(ARRAY[1,2,1,2])::word)) || '|' ||
           notation(word_lyndon_first_factor(ROW(ARRAY[1,2,1,2])::word)) $q$),
  ('k_lyndon_words','a Lyndon word is its own factorization: single factor equal to itself, over k_lyndon_words(4,3)','eq','true',
   'the defining property — Lyndon words are exactly the words with a trivial CFL factorization',$q$
    SELECT bool_and(
      word_lyndon_first_factor((e).value) = (e).value AND (word_lyndon_factor_lengths((e).value)).parts = ARRAY[4]
    )::text FROM elements(k_lyndon_words(4,3)) e $q$),
  ('words','Lyndon factorization floor: factor lengths sum to n, and the first factor is Lyndon, over words(5,2)','eq','true',
   'the two structural invariants Duval''s algorithm guarantees',$q$
    SELECT bool_and(
      (SELECT sum(x) FROM unnest(word_lyndon_factor_lengths_array((e).value)) x) = 5
      AND is_word_lyndon(word_lyndon_first_factor((e).value))
    )::text FROM elements(words(5,2)) e $q$),
  ('words','concatenating the Lyndon factors reconstructs the original word, over words(5,2)','eq','true',
   'round-trip: factors are contiguous by construction, but this confirms the boundaries Duval''s algorithm picks are exactly right, not just sum-to-n. NOTE: pglite''s unnest() of an array whose element type is a single-array-field composite (word[]) flattens straight to the underlying int[] — so `f` below IS the letters array, no `.letters` projection needed or even possible',$q$
    SELECT bool_and(
      (SELECT array_agg(l ORDER BY fo, lo) FROM unnest(word_lyndon_factors((e).value)) WITH ORDINALITY t(f, fo),
                                            LATERAL unnest(f) WITH ORDINALITY u(l, lo))
      = ((e).value).letters
    )::text FROM elements(words(5,2)) e $q$),
  ('words','every factor list is lexicographically non-increasing (w1 ≥ w2 ≥ … ≥ wk), over words(6,2)','eq','true',
   'the defining CFL property, checked over ALL factors — not just that the first one is Lyndon',$q$
    SELECT bool_and(
      NOT EXISTS (
        SELECT 1 FROM (
          SELECT f AS cur, lag(f) OVER (ORDER BY fo) AS prev
          FROM unnest(word_lyndon_factors((e).value)) WITH ORDINALITY t(f, fo)
        ) x WHERE prev IS NOT NULL AND cur > prev
      )
    )::text FROM elements(words(6,2)) e $q$);
