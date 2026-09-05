-- requires: weak_compositions_into_k_parts, weak3_compositions, realizer, utilities
-- weak_compositions_into_k_parts / weak3_compositions statistics — both realize the SAME `weak_composition` carrier
-- (weak3_compositions is just the k=3 slice, re-homed under a single grade), so registering these ONCE here makes
-- them available on both collections via base_stat_resolved's carrier inheritance (catalog-resolution.sql).

-- ── statistics (carrier: weak_composition(parts int[])) ────────────────────────────────────────────────
-- zero_parts: the number of parts equal to 0.
CREATE FUNCTION weak_composition_zero_parts(c weak_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((c).parts) p WHERE p = 0 $$;
-- largest_part: the maximum part (0 for the empty composition, the k=0/n=0 case).
CREATE FUNCTION weak_composition_largest_part(c weak_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(p) FROM unnest((c).parts) p), 0) $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('weak_compositions_into_k_parts','zero_parts','weak_composition_zero_parts','Zero parts','natural_numbers'),
  ('weak_compositions_into_k_parts','largest_part','weak_composition_largest_part','Largest part','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('weak_compositions_into_k_parts','zero_parts(0,3,0) = 2, largest_part(0,3,0) = 3','eq','2|3','two zero entries, max is 3',$q$
    SELECT weak_composition_zero_parts(ROW(ARRAY[0,3,0])::weak_composition)::text || '|' ||
           weak_composition_largest_part(ROW(ARRAY[0,3,0])::weak_composition)::text $q$),
  ('weak_compositions_into_k_parts','the fiber [4,3] element 4,0,0 has 2 zero parts, largest 4','eq','2|4','one extreme of the (4,3) fiber',$q$
    SELECT weak_composition_zero_parts(ROW(ARRAY[4,0,0])::weak_composition)::text || '|' ||
           weak_composition_largest_part(ROW(ARRAY[4,0,0])::weak_composition)::text $q$),
  ('weak_compositions_into_k_parts','zero_parts + (parts with a nonzero value) always sums to k, over fiber [5,3]','eq','true','structural: every part is either zero or counted, k=3 fixed',$q$
    SELECT bool_and(weak_composition_zero_parts((e).value) +
             (SELECT count(*) FROM unnest(((e).value).parts) p WHERE p <> 0) = 3)::text
      FROM elements(weak_compositions_into_k_parts(5,3)) e $q$),
  ('weak_compositions_into_k_parts','largest_part never exceeds n, over fiber [5,3]','eq','true','no single part can exceed the total',$q$
    SELECT bool_and(weak_composition_largest_part((e).value) <= 5)::text
      FROM elements(weak_compositions_into_k_parts(5,3)) e $q$),
  ('weak_compositions_into_k_parts','the empty composition (n=0,k=0) has 0 zero_parts and largest_part 0','eq','0|0','vacuous edge case',$q$
    SELECT weak_composition_zero_parts((unrank(weak_compositions_into_k_parts(0,0),0)).value)::text || '|' ||
           weak_composition_largest_part((unrank(weak_compositions_into_k_parts(0,0),0)).value)::text $q$),
  -- weak3_compositions shares the carrier: same functions resolve there too, no separate registration needed.
  ('weak3_compositions','ONE definition on weak_composition ⇒ weak3_compositions inherits it (base_stat_resolved)','eq','true','carrier-keyed inheritance, mirrors subsets.stats.sql''s additive_energy check',$q$
    SELECT (array_agg(stat_id) @> ARRAY['zero_parts','largest_part'])::text
      FROM base_stat_resolved WHERE collection = 'weak3_compositions' $q$),
  ('weak3_compositions','zero_parts(1,2,0) = 1, largest_part(1,2,0) = 2, over weak3_compositions(3)','eq','1|2','the shared carrier functions apply verbatim',$q$
    SELECT weak_composition_zero_parts(ROW(ARRAY[1,2,0])::weak_composition)::text || '|' ||
           weak_composition_largest_part(ROW(ARRAY[1,2,0])::weak_composition)::text $q$),
  ('weak3_compositions','zero_parts + nonzero-count = 3 (always 3 parts), over weak3_compositions(4)','eq','true','every element of weak3_compositions has exactly 3 parts',$q$
    SELECT bool_and(weak_composition_zero_parts((e).value) +
             (SELECT count(*) FROM unnest(((e).value).parts) p WHERE p <> 0) = 3)::text
      FROM elements(weak3_compositions(4)) e $q$);
