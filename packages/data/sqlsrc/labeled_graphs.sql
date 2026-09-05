-- requires: subsets, realizer, utilities
-- labeled_graphs — simple undirected graphs on the labeled vertex set [n] (issue #228). An edge is an unordered
-- vertex pair {i,j}, i<j; there are C(n,2) possible edges, colex-ordered exactly like subsets.sql's k=2
-- combinatorial number system: 1-indexed edge_index e decodes to its pair via graph_edge_pair (reusing
-- subset_unrank_colex). The carrier is a BITSET over that edge-index domain — the same (k,colex) engine as subsets,
-- re-carried with a vertex count `n` instead of the bare ground: `edges` is the sorted set of PRESENT edge-indices.
-- labeled_graphs(n) is graded by n alone, unfolding over the edge-count internally (mirrors subsets/n); the
-- by-edge-count triangle is the sibling collection `labeled_graphs_by_edges` (own file). Fiber symbol G([n]).
-- Canonical forms for UNLABELED graphs (graph isomorphism classes) are a separate, harder problem — not attempted.

CREATE TYPE labeled_graph AS (n int, edges int[]);   -- edges: sorted 1-indexed edge-indices present, each in [1, C(n,2)]

CREATE FUNCTION graph_edge_count(n int) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT binomial(n, 2)::int $$;   -- C(n,2)
-- the vertex pair {i,j} (i<j) for a 1-indexed edge_index — subsets.sql's k=2 unrank, reused verbatim
CREATE FUNCTION graph_edge_pair(n int, edge_index int) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (subset_unrank_colex(n, 2, edge_index - 1)).members $$;
-- the inverse: the 1-indexed edge_index for pair (i,j) in either order (combinatorial number system, k=2)
CREATE FUNCTION graph_edge_index(n int, i int, j int) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT binomial(greatest(i,j) - 1, 2)::int + least(i,j) $$;
CREATE FUNCTION graph_has_edge(g labeled_graph, i int, j int) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT graph_edge_index((g).n, i, j) = ANY((g).edges) $$;

CREATE FUNCTION notation(g labeled_graph) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- bit register over the C(n,2) edge-indices, colex order (mirrors finset's register)
  SELECT coalesce((SELECT string_agg((i = ANY((g).edges))::int::text, '' ORDER BY i) FROM generate_series(1, graph_edge_count((g).n)) i), '') $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE labeled_graphs_fiber AS (n natural_number);   -- single grade: n (all 2^C(n,2) graphs, not split by edge count)
CREATE FUNCTION fiber_count(f labeled_graphs_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT trunc(2::numeric ^ graph_edge_count((f).n::int)) $$;   -- 2^C(n,2)
CREATE FUNCTION fiber_elements(f labeled_graphs_fiber, element_limit int) RETURNS SETOF labeled_graph LANGUAGE sql STABLE AS $$
  SELECT ROW((f).n::int, (subset_unrank_colex(graph_edge_count((f).n::int), k, ord)).members)::labeled_graph
    FROM generate_series(0, graph_edge_count((f).n::int)) k,
         LATERAL generate_series(0, binomial(graph_edge_count((f).n::int), k)::int - 1) ord
   ORDER BY k, ord LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f labeled_graphs_fiber, g labeled_graph) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- ground-aware: same n, edge-indices ⊆ [1,C(n,2)], distinct sorted
  SELECT (g).n = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((g).edges) e WHERE e < 1 OR e > graph_edge_count((f).n::int))
     AND coalesce((g).edges, '{}') = coalesce((SELECT array_agg(DISTINCT e ORDER BY e) FROM unnest((g).edges) e), '{}') $$;

CREATE FUNCTION fiber_symbol(f labeled_graphs_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'G([' || (f).n::int || '])' $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('labeled_graphs', 'labeled_graph');
INSERT INTO base_grade VALUES ('labeled_graphs', 1, 'n', NULL, NULL);
SELECT base_realize('labeled_graphs');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('labeled_graphs','|labeled_graphs(n)| = 2^C(n,2) for n=0..5: 1,1,2,8,64,1024','eq','1,1,2,8,64,1024','one fiber per n; closed-form accel',$q$
    SELECT string_agg(cardinality(labeled_graphs(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('labeled_graphs','labeled_graphs(3): all 8 graphs on 3 labeled vertices as edge-bit registers, (edge-count, colex) order','eq','000,100,010,001,110,101,011,111','C(3,2)=3 edges — same engine as subsets(3)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(labeled_graphs(3)) e $q$),
  ('labeled_graphs','single grade ⇒ ONE fiber per n','eq','1','graded by n alone, like subsets',$q$
    SELECT count(*)::text FROM fibers(labeled_graphs(3)) f $q$),
  ('labeled_graphs','graph_edge_pair/graph_edge_index round-trip over all C(5,2)=10 edges of [5]','eq','true','the k=2 combinatorial number system is a bijection',$q$
    SELECT bool_and(graph_edge_index(5, p[1], p[2]) = e)
    FROM generate_series(1, graph_edge_count(5)) e, LATERAL (SELECT graph_edge_pair(5, e) p) s $q$),
  ('labeled_graphs','a 4-vertex path 1-2-3-4 has edges at indices {1,3,6} and graph_has_edge agrees','eq','true|false','edge_index(1,2)=1, (2,3)=3, (3,4)=6; (1,3) absent',$q$
    SELECT (graph_has_edge(ROW(4, ARRAY[1,3,6])::labeled_graph, 2, 3))::text || '|' || (graph_has_edge(ROW(4, ARRAY[1,3,6])::labeled_graph, 1, 3))::text $q$),
  ('labeled_graphs','contains via <@: the path graph on [4] ∈ labeled_graphs(4), an out-of-range edge-index graph ∉','eq','true|false','ground-aware containment',$q$
    SELECT (ROW(4, ARRAY[1,3,6])::labeled_graph <@ labeled_graphs(4))::text || '|' || (ROW(4, ARRAY[99])::labeled_graph <@ labeled_graphs(4))::text $q$),
  ('labeled_graphs','set_notation: rank 0 of labeled_graphs(3) (the empty graph) ↦ 000 ∈ G([3])','eq','000 ∈ G([3])','generic <element> ∈ <fiber symbol>',$q$
    SELECT set_notation(unrank(labeled_graphs(3), 0)) $q$);
