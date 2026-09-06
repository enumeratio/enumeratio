-- requires: maps, permutations, standard_tableaux
-- tableaux half of sqlsrc/maps-bijections.sql (#283 phase 3 lane 2 extraction) — moved wholesale, not just the
-- examples: the codomain (standard_tableau_pairs) is this pack's own collection, and examples.catalog_metadata's
-- "every base_map codomain resolves" self-test would otherwise fail loading core alone (same shape as
-- cross-collection-maps' dyck_paths.to_noncrossing_partition move in the trees-graphs lane, #283 phase 3). The
-- forward row stays the collection-scoped RSK bijection relations.sql treats as a floor-count relation, now owned
-- by tableaux instead of core — see relations.tableaux.sql. Types/functions here take only core parameter types
-- (permutation, standard_tableau), so `requires:` is unchanged from the original core file.

-- ── RSK: permutation ↔ (P,Q) pair of standard Young tableaux ─────────────────────────────────────────────
-- The Robinson–Schensted–Knuth correspondence: a bijection permutations(n) ↔ {(P,Q) : a same-shape pair of standard
-- Young tableaux with n cells}. perm_rsk_insertion / perm_rsk_recording (maps.sql) are the two projections onto the
-- insertion tableau P and recording tableau Q; rsk_inverse(P,Q) reverse-bumps the pair back to the permutation. Here
-- RSK is registered as ONE first-class COLLECTION-scoped map by pairing the two tableaux into a single carrier value.
-- The `standard_tableau_pairs` codomain collection now exists (#66), so the pair carrier is hosted; the forward map is
-- registered with is_bijection DECLARED and round-trip-verified through `standard_tableau_pair_to_perm`. The reverse
-- map is registered too (#153) — on standard_tableau_pairs.maps.sql, not here: it needs standard_tableau_pairs'
-- own base_collection row to exist first (FK), and this file is a dependency OF standard_tableau_pairs.sql (it hosts
-- the pair carrier), so the reverse registration can't live here without a cycle. `inverse` on each row pairs them by
-- bare map_id — same convention as the Euler and crossing/nesting pairs (core's maps-bijections.sql).

CREATE TYPE standard_tableau_pair AS (p standard_tableau, q standard_tableau);   -- an RSK (insertion, recording) pair
CREATE FUNCTION notation(x standard_tableau_pair) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || notation((x).p) || ' ; ' || notation((x).q) || ')' $$;
CREATE FUNCTION render_value(x standard_tableau_pair) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT notation(x) $$;

CREATE FUNCTION perm_rsk(p permutation) RETURNS standard_tableau_pair LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(perm_rsk_insertion(p), perm_rsk_recording(p))::standard_tableau_pair $$;   -- forward: w ↦ (P,Q)
-- the closing inverse, as a ONE-argument map on the pair carrier (wraps the two-arg rsk_inverse) — usable as a
-- mapping_fn, the piece that lets RSK be a single map rather than the two separate P/Q projections.
CREATE FUNCTION standard_tableau_pair_to_perm(x standard_tableau_pair) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT rsk_inverse((x).p, (x).q) $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope, inverse, is_bijection) VALUES
  ('permutations','rsk','perm_rsk','standard_tableau_pairs','RSK correspondence: permutation → (P,Q) SYT pair','collection','to_permutation',true);
-- the reverse row (standard_tableau_pairs.to_permutation) is registered in standard_tableau_pairs.maps.sql, NOT here —
-- it must run after standard_tableau_pairs' own base_collection row exists (FK on base_map.collection), and this file
-- is a REQUIRED-BY of standard_tableau_pairs.sql (it defines the pair carrier), so it cannot require it back without
-- a cycle. `inverse` above just names it by map_id (bare text column, no FK) — same forward-declared-pairing
-- convention as the Euler/crossing-nesting pairs.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('maps-bijections','RSK round-trips: pair_to_perm(rsk(w)) = w over permutations(n), n=0..5','eq','true','the bijection closed through the inverse tableau-pair map',$q$
    SELECT bool_and(one_line(standard_tableau_pair_to_perm(perm_rsk((e).value))) = one_line((e).value))::text
    FROM generate_series(0,5) n, LATERAL elements(permutations(n)) e $q$),
  ('maps-bijections','RSK round-trips the other way: rsk(to_perm((P,Q))) = (P,Q) over standard_tableau_pairs(n), n=0..5','eq','true','perm_rsk ∘ standard_tableau_pair_to_perm = id on the pairs',$q$
    SELECT bool_and(perm_rsk(standard_tableau_pair_to_perm((e).value)) = (e).value)::text
    FROM generate_series(0,5) n, LATERAL elements(standard_tableau_pairs(n)) e $q$),
  ('maps-bijections','a worked instance: 2413 ↦ (P,Q) = (1,3/2,4 ; 1,2/3,4) and back to 2413','eq','(1,3/2,4 ; 1,2/3,4)|2413','RSK on one permutation, then rsk_inverse',$q$
    SELECT notation(perm_rsk(ROW(ARRAY[2,4,1,3])::permutation)) || '|' ||
           one_line(standard_tableau_pair_to_perm(perm_rsk(ROW(ARRAY[2,4,1,3])::permutation))) $q$),
  ('maps-bijections','both directions are declared bijections with each other as inverse','eq','rsk:t|to_permutation:t','scope=collection, is_bijection, paired inverses',$q$
    SELECT 'rsk:' || left((is_bijection AND inverse='to_permutation')::text,1) || '|' ||
           'to_permutation:' || left((SELECT (is_bijection AND inverse='rsk')::text FROM base_map WHERE collection='standard_tableau_pairs' AND map_id='to_permutation'),1)
    FROM base_map WHERE collection='permutations' AND map_id='rsk' $q$),
  ('maps-bijections','both base_map rows resolve on their own collection','eq','true|true','base_map_resolved sees rsk on permutations and to_permutation on standard_tableau_pairs, both own',$q$
    SELECT (EXISTS (SELECT 1 FROM base_map_resolved WHERE collection='permutations' AND map_id='rsk' AND own))::text || '|' ||
           (EXISTS (SELECT 1 FROM base_map_resolved WHERE collection='standard_tableau_pairs' AND map_id='to_permutation' AND own))::text $q$),
  ('maps-bijections','collection-scoped: rsk does NOT carrier-inherit onto derangements (shared permutation carrier)','eq','0','scope gating — a collection-scoped map resolves only to its own domain',$q$
    SELECT count(*)::text FROM base_map_resolved WHERE collection='derangements' AND map_id='rsk' $q$);
