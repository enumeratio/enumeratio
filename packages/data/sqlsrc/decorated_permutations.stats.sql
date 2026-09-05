-- requires: decorated_permutations, permutations, realizer, utilities
-- statistics + maps for decorated_permutations — a decorated permutation is a permutation of [n] whose fixed points
-- carry a sign; word[i]=p(i) with a negative entry marking a decorated (anti-loop) fixed point, |word[i]| = p(i).

-- ── statistics (value_fn takes the carrier) ─────────────────────────────────────────────────────────────
-- fixed points of the underlying permutation: positions with |word[i]| = i (loops AND anti-loops together).
CREATE FUNCTION decorated_permutation_fixed_points(x decorated_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).word,1) i WHERE abs((x).word[i]) = i $$;
-- loops: undecorated (positive) fixed points, word[i] = +i.
CREATE FUNCTION decorated_permutation_loops(x decorated_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).word,1) i WHERE (x).word[i] = i $$;
-- anti-loops: decorated (negative) fixed points, word[i] = -i.
CREATE FUNCTION decorated_permutation_anti_loops(x decorated_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).word,1) i WHERE (x).word[i] = -i $$;
-- excedances: #{ i : |word[i]| > i } (a property of the underlying permutation; fixed points are not excedances).
CREATE FUNCTION decorated_permutation_excedances(x decorated_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).word,1) i WHERE abs((x).word[i]) > i $$;
-- weak exceedances: #{ i : |word[i]| >= i } = excedances + fixed points.
CREATE FUNCTION decorated_permutation_weak_exceedances(x decorated_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).word,1) i WHERE abs((x).word[i]) >= i $$;
-- descents of the underlying permutation: #{ i : |word[i]| > |word[i+1]| }.
CREATE FUNCTION decorated_permutation_descents(x decorated_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).word,1) i
   WHERE i < array_length((x).word,1) AND abs((x).word[i]) > abs((x).word[i+1]) $$;

-- ── maps (mapping_fn takes the carrier, returns a codomain carrier) ──────────────────────────────────────
-- underlying permutation: forget the signs, |word[i]|, landing in permutations.
CREATE FUNCTION decorated_permutation_underlying(x decorated_permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT abs((x).word[i]) FROM generate_subscripts((x).word,1) i ORDER BY i))::permutation $$;

-- ── register in base_stat / base_map ────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('decorated_permutations','fixed_points','decorated_permutation_fixed_points','Fixed points','natural_numbers'),
  ('decorated_permutations','loops','decorated_permutation_loops','Loops','natural_numbers'),
  ('decorated_permutations','anti_loops','decorated_permutation_anti_loops','Anti-loops','natural_numbers'),
  ('decorated_permutations','excedances','decorated_permutation_excedances','Excedances','natural_numbers'),
  ('decorated_permutations','weak_exceedances','decorated_permutation_weak_exceedances','Weak exceedances','natural_numbers'),
  ('decorated_permutations','descents','decorated_permutation_descents','Descents','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('decorated_permutations','underlying_permutation','decorated_permutation_underlying','permutations','Underlying permutation',NULL);

-- ── examples (living assertions; each expected value derived independently) ──────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('decorated_permutations','fixed_points distribution over decorated_permutations(3) is 2,6,8','eq','2,6,8','by fix count: two 3-cycles (fix 0), three transpositions ×2 decorations (fix 1 ⇒ 6), identity ×8 decorations (fix 3 ⇒ 8)',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT decorated_permutation_fixed_points((e).value) v, count(*) c FROM elements(decorated_permutations(3)) e GROUP BY 1) t(v,c) $q$),
  ('decorated_permutations','loops distribution over decorated_permutations(3) is 6,6,3,1','eq','6,6,3,1','#positive fixed points; a perm with f fixed points contributes C(f,k) to k loops — Σ over S_3 gives 6,6,3,1',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT decorated_permutation_loops((e).value) v, count(*) c FROM elements(decorated_permutations(3)) e GROUP BY 1) t(v,c) $q$),
  ('decorated_permutations','anti_loops distribution over decorated_permutations(3) is 6,6,3,1','eq','6,6,3,1','sign-flip symmetry ⇒ anti-loops equidistributed with loops',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT decorated_permutation_anti_loops((e).value) v, count(*) c FROM elements(decorated_permutations(3)) e GROUP BY 1) t(v,c) $q$),
  ('decorated_permutations','excedances distribution over decorated_permutations(3) is 8,7,1','eq','8,7,1','Σ over S_3 of 2^fix at each exc level: exc0=id(8), exc1=three transpositions(2 each)+312(1)=7, exc2=231(1)',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT decorated_permutation_excedances((e).value) v, count(*) c FROM elements(decorated_permutations(3)) e GROUP BY 1) t(v,c) $q$),
  ('decorated_permutations','weak_exceedances distribution over decorated_permutations(3) is 1,7,8','eq','1,7,8','weak exceedance = excedance + fixed point; distribution over the 16 decorated permutations',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT decorated_permutation_weak_exceedances((e).value) v, count(*) c FROM elements(decorated_permutations(3)) e GROUP BY 1) t(v,c) $q$),
  ('decorated_permutations','descents distribution over decorated_permutations(3) is 8,6,2','eq','8,6,2','descents of the underlying permutation, weighted by 2^fix decorations',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT decorated_permutation_descents((e).value) v, count(*) c FROM elements(decorated_permutations(3)) e GROUP BY 1) t(v,c) $q$),
  ('decorated_permutations','all six stats on 1,-2,4,3 are 2|1|1|1|3|1','eq','2|1|1|1|3|1','underlying 1,2,4,3: fix{1,2}=2, loop{1}=1, anti-loop{-2}=1, exc{4>3}=1, wexc adds fixed points=3, descent{4>3}=1',$q$
    SELECT decorated_permutation_fixed_points(ROW(ARRAY[1,-2,4,3])::decorated_permutation)::text || '|' ||
           decorated_permutation_loops(ROW(ARRAY[1,-2,4,3])::decorated_permutation)::text || '|' ||
           decorated_permutation_anti_loops(ROW(ARRAY[1,-2,4,3])::decorated_permutation)::text || '|' ||
           decorated_permutation_excedances(ROW(ARRAY[1,-2,4,3])::decorated_permutation)::text || '|' ||
           decorated_permutation_weak_exceedances(ROW(ARRAY[1,-2,4,3])::decorated_permutation)::text || '|' ||
           decorated_permutation_descents(ROW(ARRAY[1,-2,4,3])::decorated_permutation)::text $q$),
  ('decorated_permutations','underlying_permutation over decorated_permutations(2) is 12,12,12,12,21','eq','12,12,12,12,21','the identity carries 4 sign decorations, the transposition 1 — forgetting signs recovers the 4:1 fiber',$q$
    SELECT string_agg(one_line(decorated_permutation_underlying((e).value)), ',' ORDER BY ordinality(e)) FROM elements(decorated_permutations(2)) e $q$),
  ('decorated_permutations','underlying_permutation of 1,-2,4,3 is 1243','eq','1243','abs of each signed entry',$q$
    SELECT one_line(decorated_permutation_underlying(ROW(ARRAY[1,-2,4,3])::decorated_permutation)) $q$);
