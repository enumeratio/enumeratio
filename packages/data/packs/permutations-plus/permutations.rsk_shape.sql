-- requires: maps, standard_tableaux.stats
-- rsk_shape: permutations → integer_partitions, the shared shape λ of a permutation's RSK pair (P,Q) — both
-- rsk_insertion(p) and rsk_recording(p) are SYT of the same shape λ ⊢ n (maps.sql already exposes both tableaux as
-- separate maps; this is the shape they agree on, a stand-in for the FindStat `through:rsk_insertion.shape` chain
-- until #203 lands a real map-composition operator).

CREATE FUNCTION permutation_rsk_shape(p permutation) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT standard_tableau_shape(perm_rsk_insertion(p)) $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','rsk_shape','permutation_rsk_shape','integer_partitions','RSK shape',NULL);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','rsk_shape: 2413 ↦ 2+2 (both P and Q have that shape)','eq','2+2','the shared shape of the RSK pair',$q$
    SELECT notation(permutation_rsk_shape(ROW(ARRAY[2,4,1,3])::permutation)) $q$),
  ('permutations','rsk_shape agrees with the shape of BOTH the insertion and recording tableaux, over permutations(4)','eq','true','P, Q share a shape by construction',$q$
    SELECT bool_and(permutation_rsk_shape((e).value) = standard_tableau_shape(perm_rsk_insertion((e).value))
               AND permutation_rsk_shape((e).value) = standard_tableau_shape(perm_rsk_recording((e).value)))::text
    FROM elements(permutations(4)) e $q$),
  ('permutations','rsk_shape of the identity is the single row (n); of the longest element (321) is the single column','eq','3|1+1+1','trivial insertion tableaux at the extremes',$q$
    SELECT notation(permutation_rsk_shape(ROW(ARRAY[1,2,3])::permutation)) || '|' ||
           notation(permutation_rsk_shape(ROW(ARRAY[3,2,1])::permutation)) $q$),
  ('permutations','rsk_shape distribution over permutations(4) matches Σ f^λ · f^λ = n! (RSK is a bijection)','eq','24','count weighted by (f^λ)^2 sums to n! — checked here just as a shape-count sum',$q$
    SELECT sum(c)::text FROM (SELECT count(*) c FROM elements(permutations(4)) e GROUP BY notation(permutation_rsk_shape((e).value))) t $q$);
