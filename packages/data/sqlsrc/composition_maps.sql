-- requires: integer_compositions, integer_compositions.stats
-- composition_maps — classic composition endomorphisms beyond reverse (integer_compositions.stats.sql) and the
-- existing to_partition / to_subset maps (integer_compositions.stats.sql / cross-collection-maps.sql). Two more:
--   complement — the classical composition complement: flip cut/no-cut at every internal position 1..n-1. If
--     S(c) ⊆ [n-1] is c's cut-point set (the same partial-sum set `to_subset` in cross-collection-maps.sql
--     returns, minus the ground-n bookkeeping), then S(complement(c)) = [n-1] \ S(c). An involution.
--   conjugate — the ribbon/Young-diagram TRANSPOSE, reverse ∘ complement. reverse acts on cut positions by
--     i ↦ n-i, complement acts by set-complement in [n-1]; these two operations on subsets of [n-1] commute
--     (same argument as perm_reverse_complement in permutation_maps.sql), so reverse∘complement = complement∘reverse.
--     Also an involution.
-- NOTE: complement and conjugate are NOT the same map — conjugate(c) = reverse(complement(c)), which differs from
-- complement(c) alone whenever reverse(c) ≠ c (e.g. on compositions(3), complement fixes no non-symmetric part but
-- conjugate fixes 1+2 and 2+1 — see the pinned fiber table below). Some casual usage conflates the two under one
-- name; they're kept distinct and both defined here since each is independently classical.

-- ── complement: flip every internal cut ─────────────────────────────────────────────────────────────────
-- cuts[i] tracks whether gap i (between unit cells i and i+1, i = 1..n-1) is cut in c. Mark the cuts implied by
-- c's own partial sums, flip every one, then re-run the same run-length decode integer_compositions.sql's
-- composition_from_mask uses (grow a run; a cut closes it and starts the next).
CREATE FUNCTION composition_complement(c composition) RETURNS composition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    n int := coalesce((SELECT sum(p) FROM unnest((c).parts) p), 0)::int;
    cuts boolean[]; pos int := 0; i int; parts int[] := '{}'; run int := 1;
  BEGIN
    IF n = 0 THEN RETURN ROW('{}'::int[])::composition; END IF;
    cuts := array_fill(false, ARRAY[n-1]);                                    -- n=1 ⇒ empty array, no cuts possible
    FOR i IN 1..coalesce(array_length((c).parts,1),0)-1 LOOP                  -- mark c's own cuts (all but the last part)
      pos := pos + (c).parts[i];
      cuts[pos] := true;
    END LOOP;
    FOR i IN 1..n-1 LOOP cuts[i] := NOT cuts[i]; END LOOP;                    -- complement in [n-1]
    FOR i IN 1..n-1 LOOP
      IF cuts[i] THEN parts := parts || run; run := 1; ELSE run := run + 1; END IF;
    END LOOP;
    RETURN ROW(parts || run)::composition;                                   -- close the final part
  END $$;

-- ── conjugate: the ribbon transpose ──────────────────────────────────────────────────────────────────────
CREATE FUNCTION composition_conjugate(c composition) RETURNS composition LANGUAGE sql IMMUTABLE AS $$
  SELECT composition_reverse(composition_complement(c)) $$;

-- ── register ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('integer_compositions','complement','composition_complement','integer_compositions','Complement (flip every cut)',NULL),
  ('integer_compositions','conjugate','composition_conjugate','integer_compositions','Conjugate (ribbon transpose = reverse ∘ complement)',NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('composition_maps','complement over compositions(3), in mask order: 3,1+2,2+1,1+1+1 ↦ 1+1+1,2+1,1+2,3','eq','1+1+1,2+1,1+2,3','the full n=3 fiber, hand-derived: complementing 0 or 2 cuts swaps with 2 or 0 cuts; complementing either single cut swaps the two single-cut comps',$q$
    SELECT string_agg(notation(composition_complement((e).value)), ',' ORDER BY ordinality(e)) FROM elements(integer_compositions(3)) e $q$),
  ('composition_maps','complement: 1+3 ↦ 2+1+1, 2+1+1 ↦ 1+3 (n=4 spot check)','eq','2+1+1|1+3','a single cut at gap 1 complements to cuts at gaps 2,3',$q$
    SELECT notation(composition_complement(ROW(ARRAY[1,3])::composition)) || '|' ||
           notation(composition_complement(ROW(ARRAY[2,1,1])::composition)) $q$),
  ('composition_maps','complement: the single part (n) ↦ all-ones, and back','eq','1+1+1+1|4','zero cuts complements to every cut, over n=4',$q$
    SELECT notation(composition_complement(ROW(ARRAY[4])::composition)) || '|' ||
           notation(composition_complement(ROW(ARRAY[1,1,1,1])::composition)) $q$),
  ('composition_maps','complement is an involution over compositions(n), n=0..8','eq','true','applied twice = identity',$q$
    SELECT bool_and(composition_complement(composition_complement((e).value)) = (e).value)::text
    FROM generate_series(0,8) n, LATERAL elements(integer_compositions(n)) e $q$),
  ('composition_maps','complement is a bijection on compositions(6): 32 distinct images','eq','32','the image set has full size (2^5)',$q$
    SELECT count(DISTINCT notation(composition_complement((e).value)))::text FROM elements(integer_compositions(6)) e $q$),

  ('composition_maps','conjugate over compositions(3), in mask order: 3,1+2,2+1,1+1+1 ↦ 1+1+1,1+2,2+1,3','eq','1+1+1,1+2,2+1,3','reverse∘complement fixes 1+2 and 2+1 (both palindromic under the composite), swaps 3 with 1+1+1',$q$
    SELECT string_agg(notation(composition_conjugate((e).value)), ',' ORDER BY ordinality(e)) FROM elements(integer_compositions(3)) e $q$),
  ('composition_maps','conjugate = reverse∘complement = complement∘reverse on 1+3 (both orders agree)','eq','1+1+2|1+1+2','the two commuting factors compose to the same map, either order',$q$
    SELECT notation(composition_reverse(composition_complement(ROW(ARRAY[1,3])::composition))) || '|' ||
           notation(composition_complement(composition_reverse(ROW(ARRAY[1,3])::composition))) $q$),
  ('composition_maps','conjugate is an involution over compositions(n), n=0..8','eq','true','applied twice = identity',$q$
    SELECT bool_and(composition_conjugate(composition_conjugate((e).value)) = (e).value)::text
    FROM generate_series(0,8) n, LATERAL elements(integer_compositions(n)) e $q$),
  ('composition_maps','conjugate is a bijection on compositions(6): 32 distinct images','eq','32','the image set has full size (2^5)',$q$
    SELECT count(DISTINCT notation(composition_conjugate((e).value)))::text FROM elements(integer_compositions(6)) e $q$),
  ('composition_maps','complement and conjugate are genuinely different maps: they disagree on compositions(4)','eq','true','conjugate(c) = reverse(complement(c)) ≠ complement(c) whenever reverse(c) ≠ c',$q$
    SELECT bool_or(composition_complement((e).value) <> composition_conjugate((e).value))::text FROM elements(integer_compositions(4)) e $q$);
