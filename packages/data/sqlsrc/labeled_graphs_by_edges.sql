-- requires: labeled_graphs, realizer
-- labeled_graphs_by_edges — the (n, m) triangle refinement of labeled_graphs: graphs on [n] with EXACTLY m edges,
-- C(C(n,2), m) of them (choose which m of the C(n,2) possible edges are present). Same carrier (labeled_graph) and
-- same (k,colex) floor order as labeled_graphs — this just fixes k=m instead of letting the edge count range, the
-- k_subsets-to-subsets relationship transposed one level (k_subsets:subsets :: labeled_graphs_by_edges:labeled_graphs).
CREATE TYPE labeled_graphs_by_edges_fiber AS (n natural_number, m natural_number);   -- typed fiber; axes: n, m (edge count)
CREATE FUNCTION fiber_elements(f labeled_graphs_by_edges_fiber, element_limit int) RETURNS SETOF labeled_graph LANGUAGE sql STABLE AS $$
  SELECT ROW((f).n::int, (subset_unrank_colex(graph_edge_count((f).n::int), (f).m::int, ord)).members)::labeled_graph
  FROM generate_series(0, binomial(graph_edge_count((f).n::int), (f).m::int)::int - 1) ord LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f labeled_graphs_by_edges_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT binomial(graph_edge_count((f).n::int), (f).m::int) $$;
CREATE FUNCTION contains_in_fiber(f labeled_graphs_by_edges_fiber, g labeled_graph) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (g).n = (f).n::int
     AND coalesce(array_length((g).edges,1), 0) = (f).m::int
     AND NOT EXISTS (SELECT 1 FROM unnest((g).edges) e WHERE e < 1 OR e > graph_edge_count((f).n::int))
     AND coalesce((g).edges, '{}') = coalesce((SELECT array_agg(DISTINCT e ORDER BY e) FROM unnest((g).edges) e), '{}') $$;
CREATE FUNCTION fiber_symbol(f labeled_graphs_by_edges_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'G([' || (f).n::int || '],' || (f).m::int || ')' $$;

-- direct unrank (capability layer 3): the combinatorial number system gives the ord-th m-edge graph directly.
CREATE FUNCTION fiber_unrank(f labeled_graphs_by_edges_fiber, rank rank_index) RETURNS labeled_graph LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((f).n::int, (subset_unrank_colex(graph_edge_count((f).n::int), (f).m::int, rank)).members)::labeled_graph $$;

INSERT INTO base_collection VALUES ('labeled_graphs_by_edges', 'labeled_graph');
INSERT INTO base_grade VALUES ('labeled_graphs_by_edges', 1, 'n', NULL, NULL), ('labeled_graphs_by_edges', 2, 'm', '0', 'graph_edge_count(g1::int)');   -- m ranges 0..C(n,2)
SELECT base_realize('labeled_graphs_by_edges');

-- order-isomorphic sibling of labeled_graphs: the identity on the shared carrier (same elements, coarser grading)
CREATE FUNCTION labeled_graph_id(g labeled_graph) RETURNS labeled_graph LANGUAGE sql IMMUTABLE AS $$ SELECT g $$;
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('labeled_graphs_by_edges', 'labeled_graph', 'labeled_graph_id', 'labeled_graphs', 'As a single-graded labeled_graph', NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('labeled_graphs_by_edges','graphs on [4] with exactly 2 edges: C(6,2)=15 of them','eq','15','C(C(4,2),2) = C(6,2)',$q$
    SELECT cardinality(labeled_graphs_by_edges(4,2))::text $q$),
  ('labeled_graphs_by_edges','2-edge graphs of [3] in colex order (bit registers over the 3 possible edges)','eq','110,101,011','C(3,2)=3',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(labeled_graphs_by_edges(3,2)) e $q$),
  ('labeled_graphs_by_edges','multi-grade chain: fiber = (n,m) named axes','eq','4|2','unrank(labeled_graphs_by_edges(4,2), 3).fiber is (n=4,m=2)',$q$
    SELECT (unrank(labeled_graphs_by_edges(4,2), 3)).fiber.n::text || '|' || (unrank(labeled_graphs_by_edges(4,2), 3)).fiber.m::text $q$),
  ('labeled_graphs_by_edges','m RANGE: cardinality(labeled_graphs_by_edges(3)) = 8 = Σ C(3,m) = 2^C(3,2)','eq','8','fibers unfold over m=0..C(3,2)',$q$
    SELECT cardinality(labeled_graphs_by_edges(3))::text $q$),
  ('labeled_graphs_by_edges','fibers(labeled_graphs_by_edges(3)) unfold to m = 0,1,2,3','eq','0,1,2,3','the second grade ranges over 0..C(3,2)',$q$
    SELECT string_agg((f).m::text, ',' ORDER BY (f).m) FROM fibers(labeled_graphs_by_edges(3)) f $q$),
  ('labeled_graphs_by_edges','order-isomorphic to labeled_graphs(3): same elements in the same order','eq','true','shared carrier + (edge-count,colex) order',$q$
    SELECT (ARRAY(SELECT notation((e).value) FROM elements(labeled_graphs_by_edges(3)) e ORDER BY e)
          = ARRAY(SELECT notation((e).value) FROM elements(labeled_graphs(3)) e ORDER BY e))::text $q$),
  ('labeled_graphs_by_edges','direct unrank agrees with the floor at rank 5 of labeled_graphs_by_edges(5,3)','eq','true','fiber_unrank vs elements()',$q$
    SELECT (fiber_unrank(ROW(5,3)::labeled_graphs_by_edges_fiber, 5)
          = (SELECT (e).value FROM elements(labeled_graphs_by_edges(5,3)) e WHERE ordinality(e) = 5))::text $q$);
