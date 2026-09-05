-- requires: labeled_trees, prufer_sequences, realizer, utilities
-- labeled_trees statistics — classic Prüfer-sequence invariants, computed DIRECTLY from the sequence (no need to
-- reconstruct the tree): for a Prüfer word a of a tree on n labeled vertices, degree(v) = 1 + #{i : a[i] = v}.
-- `leaves` already exists (prufer_sequences.sql) and — since labeled_trees shares the labeled_tree carrier with
-- prufer_sequences — already resolves here too via base_stat_resolved's carrier inheritance; not repeated. This
-- file adds the two remaining classic degree invariants: internal (non-leaf) vertex count and max degree. n is
-- recovered as length(a)+2 — this collapses n=1 and n=2 to the same empty sequence (labeled_trees.sql already
-- treats them as one carrier value, '()' for both), so these stats are only meaningful for n≥2 (documented, not
-- fixed here — a pre-existing carrier ambiguity, not introduced by this file). FindStat: this Prüfer-code
-- labeled-tree collection has no confirmed St-number — left NULL.

-- number of distinct labels appearing in the word — the tree's internal (non-leaf) vertices.
CREATE FUNCTION prufer_internal_vertices(t labeled_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(DISTINCT x) FROM unnest((t).prufer) x), 0) $$;

-- max degree: 1 + the highest per-label occurrence count (0 for a label absent from the word, hence the
-- coalesce to 0 giving degree 1 when the word is empty — every vertex is then a leaf, e.g. n=2's single edge).
CREATE FUNCTION prufer_max_degree(t labeled_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT 1 + coalesce((SELECT max(c) FROM (SELECT count(*) c FROM unnest((t).prufer) v GROUP BY v) q), 0) $$;

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('labeled_trees','internal_vertices','prufer_internal_vertices','Number of internal (non-leaf) vertices','natural_numbers'),
  ('labeled_trees','max_degree','prufer_max_degree','Maximum vertex degree','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('labeled_trees','the leaves stat resolves here too (carrier inheritance from prufer_sequences, not a new registration)','eq','true','base_stat_resolved sees leaves on labeled_trees without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'labeled_trees' AND stat_id = 'leaves' AND NOT own)::text $q$),
  ('labeled_trees','leaves + internal_vertices = n always, over labeled_trees(6)','eq','true','every vertex is either a leaf or internal, by definition',$q$
    SELECT bool_and(prufer_leaves((e).value) + prufer_internal_vertices((e).value) = 6)::text FROM elements(labeled_trees(6)) e $q$),
  ('labeled_trees','max_degree ≥ 1 and ≤ n-1 always, over labeled_trees(6)','eq','true','a tree vertex has degree between 1 (leaf) and n-1 (a star center)',$q$
    SELECT bool_and(prufer_max_degree((e).value) >= 1 AND prufer_max_degree((e).value) <= 5)::text FROM elements(labeled_trees(6)) e $q$),
  ('labeled_trees','spot check on prufer (1,1), n=4: label 1 appears twice ⇒ degree 3, labels 2,3,4 are leaves','eq','1|3','internal={1} (1), max_degree=3 (leaves=3 already covered in prufer_sequences.sql)',$q$
    SELECT prufer_internal_vertices(ROW(ARRAY[1,1])::labeled_tree)::text || '|' ||
           prufer_max_degree(ROW(ARRAY[1,1])::labeled_tree)::text $q$),
  ('labeled_trees','spot check on prufer (2,3), n=4: a path — labels 1,4 are leaves, 2,3 both degree 2','eq','2|2','internal={2,3} (2), max_degree=2 (a path graph)',$q$
    SELECT prufer_internal_vertices(ROW(ARRAY[2,3])::labeled_tree)::text || '|' ||
           prufer_max_degree(ROW(ARRAY[2,3])::labeled_tree)::text $q$),
  ('labeled_trees','n=2 (the single edge, empty Prüfer word): both vertices are leaves, max_degree 1','eq','0|1','the degenerate empty-word case',$q$
    SELECT prufer_internal_vertices((unrank(labeled_trees(2), 0)).value)::text || '|' ||
           prufer_max_degree((unrank(labeled_trees(2), 0)).value)::text $q$),
  ('labeled_trees','the star on 5 vertices (prufer 1,1,1) has one internal vertex, max_degree 4','eq','1|4','the center label appears n-2=3 times ⇒ degree n-1=4',$q$
    SELECT prufer_internal_vertices(ROW(ARRAY[1,1,1])::labeled_tree)::text || '|' ||
           prufer_max_degree(ROW(ARRAY[1,1,1])::labeled_tree)::text $q$);
