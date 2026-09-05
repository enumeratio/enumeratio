-- requires: standard_tableaux.stats, permutations, integer_compositions
-- Two more maps off standard_tableaux: the (row) reading word, into permutations, and the descent composition,
-- into integer_compositions — the composition-carrier sibling of the existing descents/major_index stats.

-- reading_word: read the tableau's rows bottom-to-top, each row left-to-right (the standard "row reading word";
-- Fulton's convention for the lattice-word / LR-coefficient test). Since a SYT's entries are already a permutation
-- of 1..n, the word IS the one-line notation of a permutation — no shape parameter needed to invert the cell order.
CREATE FUNCTION standard_tableau_reading_word(x standard_tableau) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT i FROM generate_subscripts((x).row_word,1) i ORDER BY (x).row_word[i] DESC, i ASC))::permutation $$;

-- descent_composition: the composition of n whose partial sums are the tableau's descent set — same "gaps of
-- [0, descents…, n]" construction as permutation_descent_composition (cross-collection-maps.sql), one carrier over.
CREATE FUNCTION standard_tableau_descent_composition(x standard_tableau) RETURNS composition LANGUAGE sql IMMUTABLE AS $$
  WITH nn AS (SELECT coalesce(array_length((x).row_word,1),0) AS n),
  cuts AS (
    SELECT 0 AS c
    UNION SELECT i FROM generate_subscripts((x).row_word,1) i, nn WHERE i < nn.n AND (x).row_word[i+1] > (x).row_word[i]
    UNION SELECT n FROM nn
  ),
  diffs AS (SELECT c - lag(c) OVER (ORDER BY c) AS part FROM cuts)
  SELECT ROW(ARRAY(SELECT part FROM diffs WHERE part IS NOT NULL))::composition $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('standard_tableaux','reading_word','standard_tableau_reading_word','permutations','Reading word',NULL),
  ('standard_tableaux','descent_composition','standard_tableau_descent_composition','integer_compositions','Descent composition',NULL);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableaux','reading_word: 1,3/2 reads bottom row then top row: 213','eq','213','row 1 (entry 2) before row 0 (entries 1,3)',$q$
    SELECT one_line(standard_tableau_reading_word(ROW(ARRAY[0,1,0])::standard_tableau)) $q$),
  ('standard_tableaux','reading_word of a single row is the identity; of a single column is the reverse','eq','123|321','bottom-to-top vs the row itself',$q$
    SELECT one_line(standard_tableau_reading_word(ROW(ARRAY[0,0,0])::standard_tableau)) || '|' ||
           one_line(standard_tableau_reading_word(ROW(ARRAY[0,1,2])::standard_tableau)) $q$),
  ('standard_tableaux','reading_word always lands in permutations(n), over standard_tableaux(4)','eq','true','a rearrangement of 1..n',$q$
    SELECT bool_and(standard_tableau_reading_word((e).value) <@ permutations(4))::text FROM elements(standard_tableaux(4)) e $q$),
  ('standard_tableaux','descent_composition: 1,3/2 ↦ 1+2 (descent at 1), the row 1,2,3 ↦ 3 (no descent)','eq','1+2|3','gaps of [0, descents…, n]',$q$
    SELECT notation(standard_tableau_descent_composition(ROW(ARRAY[0,1,0])::standard_tableau)) || '|' ||
           notation(standard_tableau_descent_composition(ROW(ARRAY[0,0,0])::standard_tableau)) $q$),
  ('standard_tableaux','descent_composition and descents agree: descents(t) = #parts(descent_composition(t)) − 1, over standard_tableaux(4)','eq','true','same descent set, two carriers',$q$
    SELECT bool_and(standard_tableau_descents((e).value) =
                     coalesce(array_length((standard_tableau_descent_composition((e).value)).parts,1),1) - 1)::text
    FROM elements(standard_tableaux(4)) e $q$),
  ('standard_tableaux','the registry now lists reading_word and descent_composition','eq','true|true','base_map rows',$q$
    SELECT (SELECT count(*) > 0 FROM base_map WHERE collection='standard_tableaux' AND map_id='reading_word')::text || '|' ||
           (SELECT count(*) > 0 FROM base_map WHERE collection='standard_tableaux' AND map_id='descent_composition')::text $q$);
