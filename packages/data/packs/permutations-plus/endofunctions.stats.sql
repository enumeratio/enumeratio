-- requires: endofunctions, realizer, utilities
-- endofunctions — the first statistics (endofunctions had none). Classic functional-graph invariants read
-- straight off the images array: f(i) = images[i]. cyclic_points/components need a short walk of the orbit of
-- each i — since the domain has only n points, any orbit i, f(i), f(f(i)), ... either returns to i (i is on a
-- cycle) or never does (i is transient/leads into a cycle it isn't part of), and either way that's decided
-- within n steps by pigeonhole.

-- ── statistics (carrier: endofunction(images int[])) ───────────────────────────────────────────────────────
-- image size: |f([n])| = #distinct values hit. n itself for a bijection (permutation), 1 for a constant map.
CREATE FUNCTION endofunction_image_size(x endofunction) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(DISTINCT v)::int FROM unnest((x).images) v $$;

-- fixed points: #{ i : f(i) = i }.
CREATE FUNCTION endofunction_fixed_points(x endofunction) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).images,1) i WHERE (x).images[i] = i $$;

-- max preimage: max_j #{ i : f(i) = j } — the largest fiber of f, i.e. max in-degree of the functional graph.
CREATE FUNCTION endofunction_max_preimage(x endofunction) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(c), 0)::int FROM (SELECT count(*) c FROM unnest((x).images) v GROUP BY v) t $$;

-- cyclic points: #{ i : i lies on a cycle of f }, i.e. f^k(i) = i for some 1 <= k <= n. A transient i never
-- returns to itself (it feeds into a cycle it doesn't belong to), so n steps is always enough to decide it.
CREATE FUNCTION endofunction_cyclic_points(x endofunction) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((x).images,1), 0); i int; j int; cur int; cnt int := 0;
  BEGIN
    FOR i IN 1..n LOOP
      cur := i;
      FOR j IN 1..n LOOP
        cur := (x).images[cur];
        EXIT WHEN cur = i;
      END LOOP;
      IF cur = i THEN cnt := cnt + 1; END IF;
    END LOOP;
    RETURN cnt;
  END $$;

-- transient points: the complement of cyclic_points — #{ i : i never returns to itself under iteration }.
CREATE FUNCTION endofunction_transient_points(x endofunction) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((x).images,1), 0) - endofunction_cyclic_points(x) $$;

-- components: #weakly-connected components of the functional graph = #distinct cycles (every component of a
-- functional graph has exactly one cycle, with trees feeding into it). For each cyclic i, walk its cycle and
-- take the min label as that cycle's canonical id; count the distinct ids.
CREATE FUNCTION endofunction_components(x endofunction) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((x).images,1), 0); i int; j int; cur int; cyc_min int;
          reps int[] := ARRAY[]::int[];
  BEGIN
    FOR i IN 1..n LOOP
      cur := i;
      FOR j IN 1..n LOOP
        cur := (x).images[cur];
        EXIT WHEN cur = i;
      END LOOP;
      IF cur = i THEN                             -- i is cyclic: walk its cycle, canonical id = min member
        cyc_min := i; cur := i;
        FOR j IN 1..n LOOP
          cur := (x).images[cur];
          EXIT WHEN cur = i;
          IF cur < cyc_min THEN cyc_min := cur; END IF;
        END LOOP;
        IF NOT (cyc_min = ANY(reps)) THEN reps := reps || cyc_min; END IF;
      END IF;
    END LOOP;
    RETURN coalesce(array_length(reps,1), 0);
  END $$;

-- ── register in base_stat ───────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('endofunctions','image_size','endofunction_image_size','Image size','natural_numbers'),
  ('endofunctions','fixed_points','endofunction_fixed_points','Fixed points','natural_numbers'),
  ('endofunctions','max_preimage','endofunction_max_preimage','Max preimage size','natural_numbers'),
  ('endofunctions','cyclic_points','endofunction_cyclic_points','Cyclic points','natural_numbers'),
  ('endofunctions','transient_points','endofunction_transient_points','Transient points','natural_numbers'),
  ('endofunctions','components','endofunction_components','Components','natural_numbers');

-- ── examples (hand-computed on endofunctions(2)=4 and endofunctions(3)=27, rank order = lex order of images) ─
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('endofunctions','all six stats over endofunctions(2), in rank order 11,12,21,22','eq',
   '1,2,2,1|1,2,0,1|2,1,1,2|1,2,2,1|1,0,0,1|1,2,1,1',
   'image_size|fixed_points|max_preimage|cyclic_points|transient_points|components, one column per stat',$q$
    SELECT string_agg(endofunction_image_size((e).value)::text, ',' ORDER BY ordinality(e)) || '|' ||
           string_agg(endofunction_fixed_points((e).value)::text, ',' ORDER BY ordinality(e)) || '|' ||
           string_agg(endofunction_max_preimage((e).value)::text, ',' ORDER BY ordinality(e)) || '|' ||
           string_agg(endofunction_cyclic_points((e).value)::text, ',' ORDER BY ordinality(e)) || '|' ||
           string_agg(endofunction_transient_points((e).value)::text, ',' ORDER BY ordinality(e)) || '|' ||
           string_agg(endofunction_components((e).value)::text, ',' ORDER BY ordinality(e))
      FROM elements(endofunctions(2)) e $q$),
  ('endofunctions','image_size distribution over endofunctions(3) is 3,18,6 (sizes 1,2,3) — C(3,k)*k!*S(3,k)','eq','3,18,6',
   '3 constants + 18 with 2 distinct values + 3!=6 bijections; sums to 27',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT endofunction_image_size((e).value) k, count(*) c
      FROM elements(endofunctions(3)) e GROUP BY 1) t(k,c) $q$),
  ('endofunctions','fixed_points distribution over endofunctions(3) is 8,12,6,1 (k=0..3) — C(3,k)*(3-1)^(3-k)','eq','8,12,6,1',
   'sums to 3^3=27; average 1 fixed point per function',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT endofunction_fixed_points((e).value) k, count(*) c
      FROM elements(endofunctions(3)) e GROUP BY 1) t(k,c) $q$),
  ('endofunctions','max_preimage distribution over endofunctions(3) is 6,18,3 (max=1,2,3)','eq','6,18,3',
   'max=1 <=> bijection (3!=6); max=3 <=> constant (3 of them); the rest split 2-1 (18, = the image_size=2 count)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT endofunction_max_preimage((e).value) k, count(*) c
      FROM elements(endofunctions(3)) e GROUP BY 1) t(k,c) $q$),
  ('endofunctions','cyclic_points distribution over endofunctions(3) is 9,12,6 (k=1,2,3); k=3 count = 3!','eq','9,12,6',
   'k=3 (every point cyclic) <=> bijection, count 6; sums to 27',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT endofunction_cyclic_points((e).value) k, count(*) c
      FROM elements(endofunctions(3)) e GROUP BY 1) t(k,c) $q$),
  ('endofunctions','transient_points distribution over endofunctions(3) is 6,12,9 (t=0,1,2) — mirror of cyclic_points','eq','6,12,9',
   't = n - cyclic_points',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT endofunction_transient_points((e).value) k, count(*) c
      FROM elements(endofunctions(3)) e GROUP BY 1) t(k,c) $q$),
  ('endofunctions','components distribution over endofunctions(3) is 17,9,1 (m=1,2,3); m=3 <=> the identity only','eq','17,9,1',
   'm cycles, weighted by unsigned Stirling-1 c(k,m) over the k cyclic points; sums to 27',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT endofunction_components((e).value) k, count(*) c
      FROM elements(endofunctions(3)) e GROUP BY 1) t(k,c) $q$),
  ('endofunctions','rank 15 of endofunctions(3) is the 3-cycle 2,3,1: 0 fixed points but 1 component','eq','231|3|0|3|1|1',
   'notation|image_size|fixed_points|cyclic_points|max_preimage|components — all 3 points on one cycle',$q$
    SELECT notation((unrank(endofunctions(3), 15)).value) || '|' ||
           endofunction_image_size((unrank(endofunctions(3), 15)).value)::text || '|' ||
           endofunction_fixed_points((unrank(endofunctions(3), 15)).value)::text || '|' ||
           endofunction_cyclic_points((unrank(endofunctions(3), 15)).value)::text || '|' ||
           endofunction_max_preimage((unrank(endofunctions(3), 15)).value)::text || '|' ||
           endofunction_components((unrank(endofunctions(3), 15)).value)::text $q$),
  ('endofunctions','rank 5 of endofunctions(3) is the identity 1,2,3: 3 fixed points AND 3 separate components','eq','123|3|3|3|1|3',
   'notation|image_size|fixed_points|cyclic_points|max_preimage|components — contrast with rank 15 (same image_size/cyclic_points/max_preimage, different fixed_points/components)',$q$
    SELECT notation((unrank(endofunctions(3), 5)).value) || '|' ||
           endofunction_image_size((unrank(endofunctions(3), 5)).value)::text || '|' ||
           endofunction_fixed_points((unrank(endofunctions(3), 5)).value)::text || '|' ||
           endofunction_cyclic_points((unrank(endofunctions(3), 5)).value)::text || '|' ||
           endofunction_max_preimage((unrank(endofunctions(3), 5)).value)::text || '|' ||
           endofunction_components((unrank(endofunctions(3), 5)).value)::text $q$),
  ('endofunctions','n=0: the single empty function has 0 of every stat','eq','0,0,0,0,0,0',
   'image_size,fixed_points,max_preimage,cyclic_points,transient_points,components on the empty images array',$q$
    SELECT endofunction_image_size((unrank(endofunctions(0), 0)).value)::text || ',' ||
           endofunction_fixed_points((unrank(endofunctions(0), 0)).value)::text || ',' ||
           endofunction_max_preimage((unrank(endofunctions(0), 0)).value)::text || ',' ||
           endofunction_cyclic_points((unrank(endofunctions(0), 0)).value)::text || ',' ||
           endofunction_transient_points((unrank(endofunctions(0), 0)).value)::text || ',' ||
           endofunction_components((unrank(endofunctions(0), 0)).value)::text $q$),
  ('endofunctions','n=1: the single function 1 is a fixed point, cyclic, its own component','eq','1,1,1,1,0,1',
   'image_size,fixed_points,max_preimage,cyclic_points,transient_points,components on endofunction images=[1]',$q$
    SELECT endofunction_image_size(ROW(ARRAY[1])::endofunction)::text || ',' ||
           endofunction_fixed_points(ROW(ARRAY[1])::endofunction)::text || ',' ||
           endofunction_max_preimage(ROW(ARRAY[1])::endofunction)::text || ',' ||
           endofunction_cyclic_points(ROW(ARRAY[1])::endofunction)::text || ',' ||
           endofunction_transient_points(ROW(ARRAY[1])::endofunction)::text || ',' ||
           endofunction_components(ROW(ARRAY[1])::endofunction)::text $q$),
  ('endofunctions','the registry lists the six new endofunctions stats','eq',
   'components,cyclic_points,fixed_points,image_size,max_preimage,transient_points','base_stat rows',$q$
    SELECT string_agg(stat_id, ',' ORDER BY stat_id) FROM base_stat WHERE collection = 'endofunctions' $q$);
