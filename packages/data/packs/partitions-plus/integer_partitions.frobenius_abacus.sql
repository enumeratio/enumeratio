-- requires: integer_partitions, integer_partitions.stats, maps, finsets, realizer, utilities
-- integer_partitions — Frobenius and abacus/beta-set representations (issue #230). The beta-set (first-column hook
-- lengths, from integer_partitions.rank_crank.sql's partition_hook_lengths overload) is registered BOTH as a text
-- repr (the abacus/Maya-diagram bead string) and as a MAP into finsets (base_collection_audit §Statistics: "this is
-- a MAP into finsets, register both").

-- Frobenius notation (a₁,…,a_d | b₁,…,b_d): d = Durfee square size; aᵢ = λᵢ − i (arm of diagonal cell i), bᵢ = λ'ᵢ − i
-- (leg of diagonal cell i, via the conjugate). A partition is self-conjugate iff aᵢ = bᵢ for every i (symmetric
-- Frobenius symbol) — see the worked example below. e.g. 3+2 → (2,0 | 1,0); the empty partition → (|).
CREATE FUNCTION partition_frobenius(p integer_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN partition_durfee_square(p) = 0 THEN '( | )' ELSE
    (SELECT '(' || string_agg(((p).parts[i] - i)::text, ',' ORDER BY i) || ' | ' ||
                    string_agg(((partition_conjugate(p)).parts[i] - i)::text, ',' ORDER BY i) || ')'
     FROM generate_series(1, partition_durfee_square(p)) i)
  END $$;

-- beta-set / Maya diagram: partition_beta_set(p) lives in core's integer_partitions.stats.sql — core's glyph_kinds
-- dispatcher (glyph_svg(integer_partition, 'abacus')) needs it too, so it was hoisted there rather than left a
-- pack-only definition (core/packs §3.3: a helper called from both sides is core machinery, not collection code).

-- the abacus/Maya-diagram bead string over positions 0..max(beta): ● where a beta-number sits, ○ otherwise.
-- e.g. 3+1 (ℓ=2): beta = {3+2-1, 1+2-2} = {4,1} → "○●○○●". Empty partition (empty beta-set) → ∅.
CREATE FUNCTION integer_partition_abacus(p integer_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    (SELECT string_agg(CASE WHEN i = ANY(beta) THEN '●' ELSE '○' END, '' ORDER BY i)
       FROM (SELECT partition_beta_set(p) AS beta) b, LATERAL generate_series(0, (SELECT max(x) FROM unnest(b.beta) x)) i),
    '∅')
$$;

-- the beta-set as a MAP into finsets (ℕ-ground — a beta-set's size varies with the source partition's length, so
-- there is no fixed finite ground to grade against).
CREATE FUNCTION partition_to_beta_set(p integer_partition) RETURNS finset LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(partition_beta_set(p), NULL::int)::finset $$;

-- ── register in base_repr / base_map ─────────────────────────────────────────────────────────────────────
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('integer_partitions','frobenius','partition_frobenius','Frobenius notation',false),
  ('integer_partitions','abacus','integer_partition_abacus','Abacus (Maya diagram) beads',false);

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('integer_partitions','beta_set','partition_to_beta_set','finsets','Beta-set (first-column hook lengths)',NULL);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_partitions','Frobenius notation: 3+2 → (2,0 | 1,0), empty → ( | )','eq','(2,0 | 1,0)|( | )','durfee square 2, arms 2,0 legs 1,0',$q$
    SELECT partition_frobenius(ROW(ARRAY[3,2])::integer_partition) || '|' ||
           partition_frobenius(ROW(ARRAY[]::int[])::integer_partition) $q$),
  ('integer_partitions','Frobenius notation is SYMMETRIC (aᵢ=bᵢ) exactly for a self-conjugate partition: 3+1+1 → (2 | 2)','eq','(2 | 2)','the diagonal symbol of a self-conjugate shape',$q$
    SELECT partition_frobenius(ROW(ARRAY[3,1,1])::integer_partition) $q$),
  ('integer_partitions','Frobenius symmetry holds over every self-conjugate partition of 9: aᵢ=bᵢ for every diagonal cell','eq','true','recomputed from the arm/leg arrays directly, not by re-parsing the rendered string',$q$
    SELECT bool_and(
      (SELECT array_agg(((e).value).parts[i] - i ORDER BY i) FROM generate_series(1, partition_durfee_square((e).value)) i)
      = (SELECT array_agg((partition_conjugate((e).value)).parts[i] - i ORDER BY i) FROM generate_series(1, partition_durfee_square((e).value)) i)
    )::text FROM elements(self_conjugate_partitions(9)) e $q$),
  ('integer_partitions','beta-set of 3+1 (ℓ=2): {1,4}; the empty partition has the empty beta-set','eq','{1,4}|{}','first-column hook lengths as a sorted set',$q$
    SELECT partition_beta_set(ROW(ARRAY[3,1])::integer_partition)::text || '|' ||
           partition_beta_set(ROW(ARRAY[]::int[])::integer_partition)::text $q$),
  ('integer_partitions','beta-set is injective: distinct partitions of 6 give distinct beta-sets','eq','true','no two elements of integer_partitions(6) collide',$q$
    SELECT (count(DISTINCT partition_beta_set((e).value)) = count(*))::text FROM elements(integer_partitions(6)) e $q$),
  ('integer_partitions','abacus bead string for 3+1: beta {1,4} over positions 0..4 → ○●○○●','eq','○●○○●|∅','● at beta positions, ○ elsewhere; empty partition → ∅',$q$
    SELECT integer_partition_abacus(ROW(ARRAY[3,1])::integer_partition) || '|' ||
           integer_partition_abacus(ROW(ARRAY[]::int[])::integer_partition) $q$),
  ('integer_partitions','beta_set map lands in finsets, ℕ-ground: 3+1 renders as the brace set {1,4} via render_value','eq','{1,4}','the map''s image in its CODOMAIN form',$q$
    SELECT render_value(partition_to_beta_set(ROW(ARRAY[3,1])::integer_partition)) $q$),
  ('integer_partitions','the frobenius + abacus reprs and the beta_set map are registered','eq','true|true','base_repr / base_map rows',$q$
    SELECT (SELECT array_agg(repr) @> ARRAY['abacus','frobenius'] FROM base_repr WHERE collection = 'integer_partitions')::text || '|' ||
           (EXISTS (SELECT 1 FROM base_map WHERE collection = 'integer_partitions' AND map_id = 'beta_set' AND codomain = 'finsets'))::text $q$);
