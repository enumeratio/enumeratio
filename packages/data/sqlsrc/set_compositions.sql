-- requires: realizer, permutations
-- set_compositions — ordered set partitions of [n] (a SEQUENCE of nonempty disjoint blocks whose union is [n];
-- block ORDER matters). Represented as a word (labels int[]) of length n where labels[i] is the 1-based index
-- of the block containing i; the used labels must be exactly {1..k} for some k (a surjection [n] ↠ [k]) — unlike
-- a restricted growth string, first-occurrence order is NOT constrained, since the blocks are already ordered
-- 1..k by construction. Single grade [n]. cardinality = the Fubini / ordered-Bell number, a(n) = Σ_k C(n,k) a(n-k).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE set_composition AS (labels int[]);                         -- {1,2} = block1={1}, block2={2}; {1,1} = block1={1,2}
CREATE FUNCTION notation(c set_composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(blk, '|' ORDER BY lbl), '') FROM (
    SELECT (c).labels[i] AS lbl, string_agg(i::text, ',' ORDER BY i) AS blk
    FROM generate_subscripts((c).labels, 1) i GROUP BY (c).labels[i]) s $$;

CREATE FUNCTION fubini(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$   -- a(n) via Pascal's triangle built alongside
  DECLARE a numeric[] := ARRAY[1::numeric]; pas numeric[] := ARRAY[1::numeric]; newpas numeric[]; m int; i int; s numeric;
  BEGIN
    FOR m IN 1..n LOOP
      newpas := ARRAY[1::numeric];                                     -- C(m,0)
      FOR i IN 2..m LOOP newpas := newpas || (pas[i-1] + pas[i]); END LOOP;  -- C(m,i-1) = C(m-1,i-2)+C(m-1,i-1)
      newpas := newpas || 1::numeric;                                  -- C(m,m)
      pas := newpas;
      s := 0;
      FOR i IN 1..m LOOP s := s + pas[i+1] * a[m-i+1]; END LOOP;        -- Σ_{k=1}^{m} C(m,k) a(m-k)
      a := a || s;
    END LOOP;
    RETURN a[n+1];
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- all surjections [n] ↠ [k] (words over 1..k using every label at least once), built by a recursive prefix
-- grow tracking the used-label bitmask, filtered to full coverage at depth n, in lex order.
CREATE FUNCTION set_composition_surjections(n int, k int) RETURNS SETOF int[] LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(labels, used, depth) AS (
    SELECT ARRAY[]::int[], 0::bigint, 0
    UNION ALL
    SELECT gen.labels || lbl, gen.used | (1::bigint << (lbl-1)), gen.depth + 1
    FROM gen, generate_series(1, k) lbl
    WHERE gen.depth < n)
  SELECT labels FROM gen WHERE depth = n AND used = (1::bigint << k) - 1 ORDER BY labels $$;

CREATE TYPE set_compositions_fiber AS (n natural_number);   -- typed fiber; axis: n
-- the FLOOR: k ascending (1..n blocks), lex order within each k; n=0 ⇒ the single empty composition
CREATE FUNCTION fiber_elements(f set_compositions_fiber, element_limit int) RETURNS SETOF set_composition LANGUAGE sql STABLE AS $$
  SELECT ROW(labels)::set_composition FROM (
    SELECT 0 AS k, ARRAY[]::int[] AS labels WHERE (f).n::int = 0
    UNION ALL
    SELECT k, labels FROM generate_series(1, (f).n::int) k, LATERAL set_composition_surjections((f).n::int, k) AS g(labels)
    WHERE (f).n::int > 0
  ) t ORDER BY k, labels LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f set_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fubini((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f set_compositions_fiber, v set_composition) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE lbls int[] := (v).labels; n int := coalesce(array_length(lbls,1), 0); distinct_lbls int[]; k int;
  BEGIN
    IF n <> (f).n::int THEN RETURN false; END IF;
    IF n = 0 THEN RETURN true; END IF;
    SELECT array_agg(DISTINCT x ORDER BY x) INTO distinct_lbls FROM unnest(lbls) x;
    k := array_length(distinct_lbls, 1);
    RETURN distinct_lbls = ARRAY(SELECT generate_series(1, k));                -- exactly {1..k} used, no gaps/negatives
  END $$;

-- ── permutahedron realization ────────────────────────────────────────────────────────────────────────
-- A set composition of [n] IS a face of the order-n permutahedron (whose vertices are the n! permutations).
-- Its exact coordinate is the BARYCENTRE of the permutations it spans: element x, in block b, sits at
-- pre_b + (|b|+1)/2 where pre_b = the total size of the earlier blocks. Doubled (2×) this is always an integer,
-- so the coordinate stays EXACT in the core — the viewer halves it and projects to the screen. An all-singletons
-- composition (a permutation) lands on an integer vertex; the single-block composition sits at the centre.
CREATE FUNCTION set_composition_permutahedron_point(c set_composition) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY(
    SELECT (2 * (SELECT count(*) FROM unnest((c).labels) l WHERE l < (c).labels[x])
              + (SELECT count(*) FROM unnest((c).labels) l WHERE l = (c).labels[x]) + 1)::int
    FROM generate_subscripts((c).labels, 1) x ORDER BY x) $$;
-- the same point rendered for humans: halve, writing an odd doubled value p as p/2 (e.g. a 2-block face → "3/2")
CREATE FUNCTION set_composition_permutahedron_coords(c set_composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || string_agg(CASE WHEN p % 2 = 0 THEN (p / 2)::text ELSE p || '/2' END, ',' ORDER BY i) || ')'
  FROM unnest(set_composition_permutahedron_point(c)) WITH ORDINALITY AS t(p, i) $$;
-- the dimension of the face = n − (number of blocks): a permutation (all singletons) is a vertex (dim 0), the
-- single block is the whole body (dim n−1).
CREATE FUNCTION set_composition_face_dim(c set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (coalesce(array_length((c).labels, 1), 0) - coalesce((SELECT max(l) FROM unnest((c).labels) l), 0))::int $$;

-- vertex incidence: permutation p is a VERTEX of the face c iff each element's value p[x] lies inside its block's
-- value-range (block b occupies the consecutive values (pre_b, pre_b+|b|], pre_b = the size of the earlier blocks).
-- The vertices of a face are exactly the permutations refining it; the whole permutahedron's vertices ARE the n!
-- permutations, and the dim-1 faces (one 2-block) each span the 2 permutations of an edge.
CREATE FUNCTION set_composition_has_vertex(c set_composition, p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(
           (p).image[x] >  (SELECT count(*) FROM unnest((c).labels) l WHERE l <  (c).labels[x])
       AND (p).image[x] <= (SELECT count(*) FROM unnest((c).labels) l WHERE l <= (c).labels[x])), true)
  FROM generate_subscripts((c).labels, 1) x $$;
-- face-poset containment for the generic polytope viewer: face `big` contains the (dim-0) vertex face `small`
-- iff small's linear order (its labels read as a permutation) refines big.
CREATE FUNCTION set_composition_face_contains(big set_composition, small set_composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT set_composition_has_vertex(big, ROW((small).labels)::permutation) $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('set_compositions', 'set_composition');
INSERT INTO base_grade VALUES ('set_compositions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f set_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'OΠ([' || (f).n::int || '])' $$;   -- corpus symbol
SELECT base_realize('set_compositions');

INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('set_compositions','permutahedron','set_composition_permutahedron_coords','Permutahedron barycentre',false);
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('set_compositions','face_dim','set_composition_face_dim','Permutahedron face dimension','natural_numbers');
-- the polytope realization is carried by the SEPARATE `permutahedron` collection (polytope-collections.sql), an
-- order-isomorphic sibling on this carrier — so the geometric object and the combinatorial object stay distinct.

-- the vertices ↔ permutations bijection as a map: a permutation IS the all-singletons face — its image, read as
-- block labels, is the 0-face sitting at the integer vertex p. (permutations is loaded first; see -- requires.)
CREATE FUNCTION permutation_to_permutahedron_vertex(p permutation) RETURNS set_composition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((p).image)::set_composition $$;
-- collection-scoped: this vertex map belongs to `permutations` itself, not the shared carrier — otherwise it leaks
-- via base_map_resolved to the 23 other permutation-carrier collections.
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat, scope) VALUES
  ('permutations','permutahedron_vertex','permutation_to_permutahedron_vertex','set_compositions','Permutahedron vertex',NULL,'collection');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_compositions','set_compositions(2) enumerated','eq','1,2|1|2|2|1','k=1 (one block), then k=2 lex: {1,2},{2,1}',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(set_compositions(2)) e $q$),
  ('set_compositions','COUNT anchor: Fubini(n) for n=0..5','eq','1,1,3,13,75,541','cardinality per fiber (accel)',$q$
    SELECT string_agg(cardinality(set_compositions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('set_compositions','cardinality(set_compositions(3)) = 13','eq','13','the closed-form count accel',$q$
    SELECT cardinality(set_compositions(3))::text $q$),
  ('set_compositions','set_compositions(0) is the single empty composition','eq','1|','count=1, notation=empty',$q$
    SELECT cardinality(set_compositions(0))::text || '|' || notation((unrank(set_compositions(0), 0)).value) $q$),
  ('set_compositions','set_compositions(3) enumerated in full','eq','1,2,3,1,2|3,1,3|2,1|2,3,2,3|1,2|1,3,3|1,2,1|2|3,1|3|2,2|1|3,3|1|2,2|3|1,3|2|1','k=1,2,3 in order, lex within k',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(set_compositions(3)) e $q$),
  ('set_compositions','element carries a TYPED point fiber (address [n])','eq','3','unrank(set_compositions(3),0).fiber.n',$q$
    SELECT (unrank(set_compositions(3), 0)).fiber.n::text $q$),
  ('set_compositions','unrank crosses k inside the fiber (rank 1 of set_compositions(2) = {1,2})','eq','1|2','rank 0 is k=1 ({1,2} one block); rank 1 is first k=2',$q$
    SELECT notation((unrank(set_compositions(2), 1)).value) $q$),
  ('set_compositions','range constructor set_compositions(2,4): fibers unfold to n = 2,3,4','eq','2,3,4','the (lo,hi) grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(set_compositions(2,4)) f $q$),
  ('set_compositions','range handle cardinality = 3+13+75 = 91','eq','91','summed over fibers n=2,3,4',$q$
    SELECT cardinality(set_compositions(2,4))::text $q$),
  ('set_compositions','contains: {1,2} ∈ set_compositions(2); {2,2} ∉ (label 1 unused); {1,1,2} ∉ (wrong length)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT contains(set_compositions(2), ROW(ARRAY[1,2])::set_composition)::text || '|' ||
           contains(set_compositions(2), ROW(ARRAY[2,2])::set_composition)::text || '|' ||
           contains(set_compositions(2), ROW(ARRAY[1,1,2])::set_composition)::text $q$),
  ('set_compositions','the <@ operator: {2,1} <@ set_compositions(2)','eq','true','operator wrapper over contains',$q$
    SELECT (ROW(ARRAY[2,1])::set_composition <@ set_compositions(2))::text $q$),
  ('set_compositions','permutahedron: the permutation 1|2|3 is the integer vertex, {1,2,3} the centre, {1,2}|{3} a mid-edge','eq','(1,2,3)|(2,2,2)|(3/2,3/2,3)','the barycentre coordinate of a vertex / body / 2-block face',$q$
    SELECT set_composition_permutahedron_coords(ROW(ARRAY[1,2,3])::set_composition) || '|' ||
           set_composition_permutahedron_coords(ROW(ARRAY[1,1,1])::set_composition) || '|' ||
           set_composition_permutahedron_coords(ROW(ARRAY[1,1,2])::set_composition) $q$),
  ('set_compositions','face dimension = n − #blocks: vertex 0, mid-edge 1, whole body n−1','eq','0|1|2','dims of a permutation / a 2-block face / the single block',$q$
    SELECT set_composition_face_dim(ROW(ARRAY[1,2,3])::set_composition)::text || '|' ||
           set_composition_face_dim(ROW(ARRAY[1,1,2])::set_composition)::text || '|' ||
           set_composition_face_dim(ROW(ARRAY[1,1,1])::set_composition)::text $q$),
  ('set_compositions','over set_compositions(3) the face dims tally 6 vertices, 6 edges, 1 body','eq','6,6,1','the f-vector of the hexagon (permutahedron of order 3)',$q$
    SELECT string_agg(cnt::text, ',' ORDER BY d) FROM (
      SELECT set_composition_face_dim((e).value) d, count(*) cnt FROM elements(set_compositions(3)) e GROUP BY 1) t(d, cnt) $q$),
  ('set_compositions','vertex incidence: the edge {1,2}|{3} is spanned by 123 and 213, not 132','eq','true|true|false','a dim-1 face refines to exactly two permutations',$q$
    SELECT set_composition_has_vertex(ROW(ARRAY[1,1,2])::set_composition, ROW(ARRAY[1,2,3])::permutation)::text || '|' ||
           set_composition_has_vertex(ROW(ARRAY[1,1,2])::set_composition, ROW(ARRAY[2,1,3])::permutation)::text || '|' ||
           set_composition_has_vertex(ROW(ARRAY[1,1,2])::set_composition, ROW(ARRAY[1,3,2])::permutation)::text $q$),
  ('set_compositions','the whole body is spanned by all 6 vertices; a 0-face by exactly one','eq','6|1','#refining permutations = ∏|block|! (body 3!, vertex 1)',$q$
    SELECT (SELECT count(*) FROM elements(permutations(3)) e WHERE set_composition_has_vertex(ROW(ARRAY[1,1,1])::set_composition, (e).value))::text || '|' ||
           (SELECT count(*) FROM elements(permutations(3)) e WHERE set_composition_has_vertex(ROW(ARRAY[1,2,3])::set_composition, (e).value))::text $q$),
  ('set_compositions','permutahedron_vertex map: 231 embeds as the all-singletons face 3|1|2 at the vertex (2,3,1)','eq','3|1|2|(2,3,1)','the vertices ↔ permutations bijection',$q$
    SELECT notation(permutation_to_permutahedron_vertex(ROW(ARRAY[2,3,1])::permutation)) || '|' ||
           set_composition_permutahedron_coords(permutation_to_permutahedron_vertex(ROW(ARRAY[2,3,1])::permutation)) $q$);
