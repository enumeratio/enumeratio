-- requires: labeled_graphs, realizer, integer_partitions
-- labeled_graphs — degree / component / triangle statistics, and the degree sequence as a MAP into
-- integer_partitions (its kernel groups graphs by degree sequence — a graded refinement, for free).

-- ── statistics (carrier: labeled_graph) ─────────────────────────────────────────────────────────────────
CREATE FUNCTION number_of_edges(g labeled_graph) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((g).edges, 1), 0) $$;

CREATE FUNCTION graph_degree(g labeled_graph, v int) RETURNS int LANGUAGE sql IMMUTABLE AS $$   -- # edges of g incident to vertex v
  SELECT count(*)::int FROM unnest((g).edges) e WHERE v = ANY(graph_edge_pair((g).n, e)) $$;

CREATE FUNCTION maximum_degree(g labeled_graph) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(graph_degree(g, v)), 0) FROM generate_series(1, (g).n) v $$;
CREATE FUNCTION minimum_degree(g labeled_graph) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(min(graph_degree(g, v)), 0) FROM generate_series(1, (g).n) v $$;
CREATE FUNCTION number_of_isolated_vertices(g labeled_graph) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_series(1, (g).n) v WHERE graph_degree(g, v) = 0 $$;

-- the connected component containing `start` — a recursive walk that follows present edges outward from it.
CREATE FUNCTION graph_component_of(g labeled_graph, start int) RETURNS SETOF int LANGUAGE sql IMMUTABLE AS $$
  WITH RECURSIVE reach(v) AS (
    SELECT start
    UNION
    SELECT CASE WHEN p.pr[1] = r.v THEN p.pr[2] ELSE p.pr[1] END
    FROM reach r, unnest((g).edges) e, LATERAL (SELECT graph_edge_pair((g).n, e) AS pr) p
    WHERE p.pr[1] = r.v OR p.pr[2] = r.v
  )
  SELECT DISTINCT v FROM reach $$;

-- component count: walk vertices 1..n, each still-unvisited one starts a new component and claims its reach.
CREATE FUNCTION number_of_components(g labeled_graph) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE visited int[] := '{}'; comps int := 0; v int;
  BEGIN
    FOR v IN 1..(g).n LOOP
      IF NOT (v = ANY(visited)) THEN
        comps := comps + 1;
        visited := visited || ARRAY(SELECT * FROM graph_component_of(g, v));
      END IF;
    END LOOP;
    RETURN comps;
  END $$;

CREATE FUNCTION number_of_triangles(g labeled_graph) RETURNS int LANGUAGE sql IMMUTABLE AS $$   -- brute-force over ordered triples i<j<k
  SELECT count(*)::int
  FROM generate_series(1, (g).n) i, generate_series(1, (g).n) j, generate_series(1, (g).n) k
  WHERE i < j AND j < k
    AND graph_has_edge(g, i, j) AND graph_has_edge(g, j, k) AND graph_has_edge(g, i, k) $$;

-- the degree sequence, largest-first, ISOLATED (zero-degree) vertices dropped — a genuine integer_partition of
-- 2·|E| (handshake lemma), not the raw length-n degree list.
CREATE FUNCTION degree_sequence(g labeled_graph) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT graph_degree(g, v) FROM generate_series(1, (g).n) v
                    WHERE graph_degree(g, v) > 0 ORDER BY graph_degree(g, v) DESC))::integer_partition $$;

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('labeled_graphs', 'number_of_edges',              'number_of_edges',              'Number of edges',                 'natural_numbers'),
  ('labeled_graphs', 'maximum_degree',                'maximum_degree',                'Maximum degree',                  'natural_numbers'),
  ('labeled_graphs', 'minimum_degree',                'minimum_degree',                'Minimum degree',                  'natural_numbers'),
  ('labeled_graphs', 'number_of_isolated_vertices',   'number_of_isolated_vertices',   'Number of isolated vertices',     'natural_numbers'),
  ('labeled_graphs', 'number_of_components',          'number_of_components',          'Number of connected components',  'natural_numbers'),
  ('labeled_graphs', 'number_of_triangles',           'number_of_triangles',           'Number of triangles',             'natural_numbers');
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('labeled_graphs', 'degree_sequence', 'degree_sequence', 'integer_partitions', 'Degree sequence (isolated vertices dropped)', NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('labeled_graphs','the path 1-2-3-4 (edges {1,3,6}): 3 edges, degrees max 2 / min 1, 0 isolated, 1 component, 0 triangles','eq','3|2|1|0|1|0','a connected acyclic graph',$q$
    SELECT number_of_edges(g)::text || '|' || maximum_degree(g)::text || '|' || minimum_degree(g)::text || '|' ||
           number_of_isolated_vertices(g)::text || '|' || number_of_components(g)::text || '|' || number_of_triangles(g)::text
    FROM (SELECT ROW(4, ARRAY[1,3,6])::labeled_graph g) s $q$),
  ('labeled_graphs','the empty graph on [3]: 0 edges, all-isolated, 3 components, no triangles','eq','0|0|0|3|3|0','no edges at all',$q$
    SELECT number_of_edges(g)::text || '|' || maximum_degree(g)::text || '|' || minimum_degree(g)::text || '|' ||
           number_of_isolated_vertices(g)::text || '|' || number_of_components(g)::text || '|' || number_of_triangles(g)::text
    FROM (SELECT ROW(3, ARRAY[]::int[])::labeled_graph g) s $q$),
  ('labeled_graphs','the complete graph K3 (all 3 edges present): 1 triangle, every degree 2, 1 component','eq','3|2|2|0|1|1','K3 = the full 2-simplex 1-skeleton',$q$
    SELECT number_of_edges(g)::text || '|' || maximum_degree(g)::text || '|' || minimum_degree(g)::text || '|' ||
           number_of_isolated_vertices(g)::text || '|' || number_of_components(g)::text || '|' || number_of_triangles(g)::text
    FROM (SELECT ROW(3, ARRAY[1,2,3])::labeled_graph g) s $q$),
  ('labeled_graphs','two disjoint edges on [4] (a perfect matching): 2 components, no isolated vertices','eq','2|0','edges {1,2} and {3,4} — indices 1 and 6',$q$
    SELECT number_of_components(ROW(4, ARRAY[1,6])::labeled_graph)::text || '|' || number_of_isolated_vertices(ROW(4, ARRAY[1,6])::labeled_graph)::text $q$),
  ('labeled_graphs','degree_sequence: the path 1-2-3-4 ↦ 2+2+1+1; the empty graph on [3] ↦ 0 (isolated vertices dropped)','eq','2+2+1+1|0','a partition of 2|E|',$q$
    SELECT notation(degree_sequence(ROW(4, ARRAY[1,3,6])::labeled_graph)) || '|' || notation(degree_sequence(ROW(3, ARRAY[]::int[])::labeled_graph)) $q$),
  ('labeled_graphs','edge-count distribution over labeled_graphs(3) is 1,3,3,1 (m=0..3) — binomial(3,m)','eq','1,3,3,1','matches labeled_graphs_by_edges(3,m) cardinalities',$q$
    SELECT string_agg(c::text, ',' ORDER BY m) FROM (SELECT number_of_edges((e).value) m, count(*) c FROM elements(labeled_graphs(3)) e GROUP BY 1) t(m,c) $q$),
  ('labeled_graphs','triangle-count distribution over labeled_graphs(3) is 7,1 (0 or 1 triangle; K3 alone has one)','eq','7,1','only the all-edges graph forms a triangle',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT number_of_triangles((e).value) k, count(*) c FROM elements(labeled_graphs(3)) e GROUP BY 1) t(k,c) $q$),
  ('labeled_graphs','component-count distribution over labeled_graphs(3) is 4,3,1 (1,2,3 components)','eq','4,3,1','1 comp: connected (4 graphs, incl K3); 2 comps: one edge (3); 3 comps: empty (1)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT number_of_components((e).value) k, count(*) c FROM elements(labeled_graphs(3)) e GROUP BY 1) t(k,c) $q$);
