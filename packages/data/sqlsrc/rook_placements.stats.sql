-- requires: rook_placements, realizer, utilities
-- rook_placements statistics — rooks (how many rows are occupied) and max_column (the highest column used), read
-- directly off the cols[] carrier (0 = empty row).

-- ── statistics (carrier: rook_placement(cols int[]), 0 = empty row) ────────────────────────────────────
-- rooks: the number of occupied rows (nonzero entries).
CREATE FUNCTION rook_placement_rooks(p rook_placement) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((p).cols) c WHERE c <> 0 $$;
-- max_column: the highest column occupied (0 if the placement is empty).
CREATE FUNCTION rook_placement_max_column(p rook_placement) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(c) FROM unnest((p).cols) c), 0) $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('rook_placements','rooks','rook_placement_rooks','Rooks','natural_numbers'),
  ('rook_placements','max_column','rook_placement_max_column','Maximum column','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- rook_placements(3) anchors (from rook_placements.sql's own example): rank 0 = 0,0,0; rank 3 = 0,0,3; rank 33 = 3,2,1.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('rook_placements','rooks/max_column at R(3) rank 0 (empty board) is 0,0','eq','0|0','no rooks placed',$q$
    SELECT rook_placement_rooks((unrank(rook_placements(3),0)).value)::text || '|' ||
           rook_placement_max_column((unrank(rook_placements(3),0)).value)::text $q$),
  ('rook_placements','rooks/max_column at R(3) rank 3 (0,0,3) is 1,3','eq','1|3','a single rook in column 3',$q$
    SELECT rook_placement_rooks((unrank(rook_placements(3),3)).value)::text || '|' ||
           rook_placement_max_column((unrank(rook_placements(3),3)).value)::text $q$),
  ('rook_placements','rooks/max_column at R(3) rank 33 (3,2,1, the full permutation) is 3,3','eq','3|3','every row occupied',$q$
    SELECT rook_placement_rooks((unrank(rook_placements(3),33)).value)::text || '|' ||
           rook_placement_max_column((unrank(rook_placements(3),33)).value)::text $q$),
  ('rook_placements','rooks never exceeds n, over rook_placements(4)','eq','true','at most n rows can be occupied',$q$
    SELECT bool_and(rook_placement_rooks((e).value) <= 4)::text FROM elements(rook_placements(4)) e $q$),
  ('rook_placements','the n! full permutations (every row occupied) all have rooks = n, over rook_placements(3)','eq','true','no empty rows in a full placement',$q$
    SELECT bool_and(rook_placement_rooks((e).value) = 3)::text
      FROM elements(rook_placements(3)) e WHERE NOT (0 = ANY(((e).value).cols)) $q$);
