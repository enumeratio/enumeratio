-- requires: integer_compositions, integer_partitions, realizer, utilities
-- integer_compositions statistics + a map — more per-element stats (descents, ascents, smallest part, number of
-- parts equal to 1) plus a to_partition map into integer_partitions. Expected values derived independently in sage
-- (sage.all.Compositions) over the whole fiber; distributions grouped by value are enumeration-order-independent.

-- ── statistics (carrier: composition(parts int[])) ─────────────────────────────────────────────────────
CREATE FUNCTION composition_descents(c composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((c).parts,1) i
   WHERE i < array_length((c).parts,1) AND (c).parts[i] > (c).parts[i+1] $$;         -- i with part_i > part_{i+1}
CREATE FUNCTION composition_ascents(c composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((c).parts,1) i
   WHERE i < array_length((c).parts,1) AND (c).parts[i] < (c).parts[i+1] $$;         -- i with part_i < part_{i+1}
CREATE FUNCTION composition_smallest_part(c composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT min(x) FROM unnest((c).parts) x), 0)::int $$;              -- 0 for the empty composition
CREATE FUNCTION composition_parts_equal_one(c composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((c).parts) x WHERE x = 1 $$;

-- ── map: to_partition — sort the parts non-increasing (forget the order) → integer_partition ────────────
CREATE FUNCTION composition_to_partition(c composition) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT x FROM unnest((c).parts) x ORDER BY x DESC))::integer_partition $$;

-- ── register ───────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('integer_compositions','descents','composition_descents','Descents','natural_numbers'),
  ('integer_compositions','ascents','composition_ascents','Ascents','natural_numbers'),
  ('integer_compositions','smallest_part','composition_smallest_part','Smallest part','natural_numbers'),
  ('integer_compositions','parts_equal_one','composition_parts_equal_one','Number of parts equal to 1','natural_numbers');

-- reverse: read the composition right-to-left (a length-preserving involution on compositions of n).
CREATE FUNCTION composition_reverse(c composition) RETURNS composition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT (c).parts[i] FROM generate_subscripts((c).parts, 1) i ORDER BY i DESC))::composition $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('integer_compositions','to_partition','composition_to_partition','integer_partitions','To partition',NULL),
  ('integer_compositions','reverse','composition_reverse','integer_compositions','Reverse',NULL);

-- ── examples (expected derived in sage over Compositions(n)) ────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_compositions','descents distribution over compositions(4) is 5,3 (k=0,1)','eq','5,3','sage: #{i: c_i>c_{i+1}} over the 8 comps of 4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT composition_descents((e).value) k, count(*) c FROM elements(integer_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('integer_compositions','ascents distribution over compositions(4) is 5,3 (k=0,1)','eq','5,3','sage: #{i: c_i<c_{i+1}} over the 8 comps of 4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT composition_ascents((e).value) k, count(*) c FROM elements(integer_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('integer_compositions','ascents distribution over compositions(5) is 7,9 (k=0,1)','eq','7,9','sage: ascents over the 16 comps of 5',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT composition_ascents((e).value) k, count(*) c FROM elements(integer_compositions(5)) e GROUP BY 1) t(k,c) $q$),
  ('integer_compositions','smallest_part distribution over compositions(4) is 6,1,1 (k=1,2,4)','eq','6,1,1','sage: min(parts); k-values 1,2,4 (no comp of 4 has smallest part 3)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT composition_smallest_part((e).value) k, count(*) c FROM elements(integer_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('integer_compositions','parts_equal_one distribution over compositions(4) is 2,2,3,1 (k=0,1,2,4)','eq','2,2,3,1','sage: #{parts = 1}; k-values 0,1,2,4 (none has exactly three 1s)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT composition_parts_equal_one((e).value) k, count(*) c FROM elements(integer_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('integer_compositions','spot: 1+2+1 has 1 descent, 1 ascent, smallest part 1, two 1s','eq','1|1|1|2','the composition 1+2+1',$q$
    SELECT composition_descents(ROW(ARRAY[1,2,1])::composition)::text || '|' ||
           composition_ascents(ROW(ARRAY[1,2,1])::composition)::text || '|' ||
           composition_smallest_part(ROW(ARRAY[1,2,1])::composition)::text || '|' ||
           composition_parts_equal_one(ROW(ARRAY[1,2,1])::composition)::text $q$),
  ('integer_compositions','smallest_part of the empty composition (n=0) is 0','eq','0','the empty-parts edge case',$q$
    SELECT composition_smallest_part((unrank(integer_compositions(0), 0)).value)::text $q$),
  ('integer_compositions','to_partition over compositions(3) in mask order','eq','3,2+1,2+1,1+1+1','each comp of 3 (3,1+2,2+1,1+1+1) sorted non-increasing, rendered as a partition',$q$
    SELECT string_agg(render_value(composition_to_partition((e).value)), ',' ORDER BY ordinality(e)) FROM elements(integer_compositions(3)) e $q$),
  ('integer_compositions','to_partition: 1+3 ↦ 3+1, 2+1+1 ↦ 2+1+1','eq','3+1|2+1+1','forget order, sort non-increasing',$q$
    SELECT render_value(composition_to_partition(ROW(ARRAY[1,3])::composition)) || '|' ||
           render_value(composition_to_partition(ROW(ARRAY[2,1,1])::composition)) $q$),
  ('integer_compositions','to_partition preserves the part sum: image of each comp of 5 sums to 5','eq','true','the map lands in the same graded fiber of integer_partitions',$q$
    SELECT bool_and((SELECT coalesce(sum(p),0) FROM unnest((composition_to_partition((e).value)).parts) p) = 5)::text FROM elements(integer_compositions(5)) e $q$),
  ('integer_compositions','reverse: 1+2+1 ↦ 1+2+1 (palindrome), 1+3 ↦ 3+1, and it is an involution','eq','1+2+1|3+1|1+3','read the parts right-to-left',$q$
    SELECT notation(composition_reverse(ROW(ARRAY[1,2,1])::composition)) || '|' ||
           notation(composition_reverse(ROW(ARRAY[1,3])::composition)) || '|' ||
           notation(composition_reverse(composition_reverse(ROW(ARRAY[1,3])::composition))) $q$);
