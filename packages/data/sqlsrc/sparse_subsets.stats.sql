-- requires: sparse_subsets, binary_words, realizer, utilities
-- sparse_subsets statistics — cardinality is the size of the chosen (no-two-adjacent) subset; min_gap is the
-- smallest distance between consecutive chosen positions (always ≥ 2 by the no-adjacency invariant, when defined —
-- 0 for the vacuous case of fewer than two chosen positions, so the stat stays a plain int, never NULL). #236:
-- sparse_subsets now shares the binary_word carrier (core), but binary_words' OWN stats (number_of_ones, …) live
-- in the words-plus PACK — this file stays core-self-contained, so `cardinality` is kept as its own registration
-- (it happens to duplicate the pack's `number_of_ones` under a different name whenever that pack is loaded too).

-- ── statistics (carrier: binary_word(bits int[])) ─────────────────────────────────────────────────────
-- cardinality: the number of chosen (1) positions.
CREATE FUNCTION sparse_subset_cardinality(x binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((x).bits) b WHERE b = 1 $$;
-- min_gap: the smallest distance between consecutive chosen positions (0 if fewer than two are chosen).
CREATE FUNCTION sparse_subset_min_gap(x binary_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(min(o - prev_o), 0)::int FROM (
    SELECT o, lag(o) OVER (ORDER BY o) AS prev_o
    FROM unnest((x).bits) WITH ORDINALITY AS t(b, o) WHERE b = 1
  ) q WHERE prev_o IS NOT NULL $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('sparse_subsets','cardinality','sparse_subset_cardinality','Cardinality','natural_numbers'),
  ('sparse_subsets','min_gap','sparse_subset_min_gap','Minimum gap','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- sparse_subsets(4) in ascending order (from sparse_subsets.sql's own example):
--   0000,0001,0010,0100,0101,1000,1001,1010
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sparse_subsets','cardinality over sparse_subsets(4) in order is 0,1,1,1,2,1,2,2','eq','0,1,1,1,2,1,2,2','count of chosen positions per word',$q$
    SELECT string_agg(sparse_subset_cardinality((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(sparse_subsets(4)) e $q$),
  ('sparse_subsets','min_gap over sparse_subsets(4) in order is 0,0,0,0,2,0,3,2','eq','0,0,0,0,2,0,3,2','0 when fewer than two 1s, else the tightest spacing',$q$
    SELECT string_agg(sparse_subset_min_gap((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(sparse_subsets(4)) e $q$),
  ('sparse_subsets','min_gap is always ≥ 2 whenever cardinality ≥ 2 (the no-adjacency invariant), n=6','eq','true','structural check over every element with 2+ chosen positions',$q$
    SELECT bool_and(sparse_subset_min_gap((e).value) >= 2)::text
      FROM elements(sparse_subsets(6)) e WHERE sparse_subset_cardinality((e).value) >= 2 $q$),
  ('sparse_subsets','cardinality(1010) = 2, min_gap(1010) = 2','eq','2|2','positions 1 and 3',$q$
    SELECT sparse_subset_cardinality(ROW(ARRAY[1,0,1,0])::binary_word)::text || '|' ||
           sparse_subset_min_gap(ROW(ARRAY[1,0,1,0])::binary_word)::text $q$),
  ('sparse_subsets','empty word (n=0): cardinality=0, min_gap=0','eq','0|0','edge case, no bits',$q$
    SELECT sparse_subset_cardinality((unrank(sparse_subsets(0),0)).value)::text || '|' ||
           sparse_subset_min_gap((unrank(sparse_subsets(0),0)).value)::text $q$);
