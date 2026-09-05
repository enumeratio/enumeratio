-- requires: element_relations, subsets
-- subsets — element relations (issue #237, group 4): the Boolean lattice on subsets(n), the inclusion order, kind
-- cover: covers add exactly one element. subsets(n)'s Hasse diagram is the hypercube graph Q_n, graded by
-- cardinality. Design: docs/design/element-relations.md.

-- ── cover: subsets, the Boolean lattice (inclusion order) ────────────────────────────────────────────────────────
-- Up-covers of s: for each ground element i not already a member, add it. Re-sorted (unnest + ORDER BY) so the
-- result stays canonical — subsets.sql's contains_in_fiber requires a sorted-ascending members array.
CREATE FUNCTION finset_boolean_lattice_covers(s finset) RETURNS SETOF finset LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT unnest((s).members || i) ORDER BY 1), (s).n)::finset
    FROM generate_series(1, (s).n) i
   WHERE NOT (i = ANY((s).members)) $$;

-- ── the registry row ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_element_relation (collection, rel_id, kind, forward_fn, title, findstat) VALUES
  ('subsets', 'inclusion', 'cover', 'finset_boolean_lattice_covers',
   'the Boolean lattice 2^[n] — inclusion order, covers add one element', NULL);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('subsets_relations', 'the inclusion relation is registered under kind cover on subsets',
   'eq', 'subsets/inclusion', 'the new row',$q$
    SELECT collection || '/' || rel_id FROM base_element_relation WHERE collection = 'subsets' $q$),

  ('subsets_relations', 'inclusion covers of {} in subsets(3) = the three atoms {1},{2},{3}',
   'eq', '001,010,100', 'up-covers of the empty set (bit-register notation)',$q$
    SELECT string_agg(notation(c), ',' ORDER BY notation(c)) FROM finset_boolean_lattice_covers(ROW(ARRAY[]::int[], 3)::finset) c $q$),
  ('subsets_relations', 'every inclusion cover adds exactly one element (cardinality +1, graded), subsets(n) n=1..4',
   'eq', 'true', 'the poset is graded by cardinality',$q$
    SELECT bool_and(coalesce(array_length((c).members,1),0) = coalesce(array_length(((e).value).members,1),0) + 1)::text
      FROM generate_series(1,4) n, LATERAL elements(subsets(n)) e, LATERAL finset_boolean_lattice_covers((e).value) c $q$),
  ('subsets_relations', 'total inclusion covers on subsets(n) = n·2^(n−1) (the n-cube edge count), n=1..4',
   'eq', 'true', 'verified by enumeration against the closed form',$q$
    SELECT bool_and(t.edges = (t.gn::numeric * (2::numeric ^ (t.gn - 1)))::bigint)::text FROM (
      SELECT gn, count(*) edges FROM generate_series(1,4) gn, LATERAL elements(subsets(gn)) e,
             LATERAL finset_boolean_lattice_covers((e).value) c GROUP BY gn) t $q$),
  ('subsets_relations', 'the inclusion relation has a UNIQUE maximum: exactly one subset of [n] has no up-cover ([n] itself), n=1..4',
   'eq', 'true', 'lattice top is unique',$q$
    SELECT bool_and(tops = 1)::text FROM (
      SELECT n, count(*) tops FROM generate_series(1,4) n, LATERAL elements(subsets(n)) e
       WHERE NOT EXISTS (SELECT 1 FROM finset_boolean_lattice_covers((e).value)) GROUP BY n) t $q$),
  ('subsets_relations', 'the inclusion relation has a UNIQUE minimum: exactly one subset of [n] is covered by nothing ({} itself), n=1..4',
   'eq', 'true', 'lattice bottom is unique',$q$
    SELECT bool_and(bottoms = 1)::text FROM (
      SELECT n, count(*) bottoms FROM generate_series(1,4) n, LATERAL elements(subsets(n)) e
       WHERE NOT EXISTS (SELECT 1 FROM elements(subsets(n)) u
                          WHERE (e).value IN (SELECT c FROM finset_boolean_lattice_covers((u).value) c))
       GROUP BY n) t $q$),
  -- crux (c) echo (docs/design/element-relations.md): the undirected cover graph IS a polytope's 1-skeleton —
  -- here the hypercube Q_n, n-regular at every vertex (up-degree + down-degree = (n−|s|) + |s| = n).
  ('subsets_relations', 'the undirected inclusion cover graph on subsets(n) is n-regular = the hypercube Q_n, n=2..4',
   'eq', 'true', 'up-degree + down-degree = (n−|s|) + |s| = n at every vertex',$q$
    SELECT bool_and(deg = n)::text FROM (
      SELECT n, (e).value v,
             (SELECT count(*) FROM finset_boolean_lattice_covers((e).value))
           + (SELECT count(*) FROM elements(subsets(n)) u
               WHERE (e).value IN (SELECT c FROM finset_boolean_lattice_covers((u).value) c)) deg
        FROM generate_series(2,4) n, LATERAL elements(subsets(n)) e) t $q$),
  ('subsets_relations', 'inclusion rank-GF over subsets(4) = the Pascal row 1,4,6,4,1 (cardinality distribution)',
   'eq', '1,4,6,4,1', 'GROUP BY rank(inclusion) is the #203 distribution kernel; rank = |members|',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT coalesce(array_length(((e).value).members,1),0) k, count(*) c FROM elements(subsets(4)) e GROUP BY 1) t $q$);
