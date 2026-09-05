-- requires: labeled_graphs.stats, realizer
-- connected_labeled_graphs — connected simple graphs on [n] (A001187), realized as a base_restrict of
-- labeled_graphs by "1 connected component" (issue #228). The accel count_fn is the SPECIES/log identity: writing
-- g(n) = |labeled_graphs(n)| = 2^C(n,2) and c(n) = |connected_labeled_graphs(n)|, the exponential-formula relation
-- "every graph decomposes uniquely into connected pieces" (G = exp(C) on EGFs) gives, for n≥1, rooting at the
-- component containing vertex 1:
--   g(n) = Σ_{k=1}^{n} C(n-1,k-1) · c(k) · g(n-k)                      (choose the OTHER k-1 vertices of vertex 1's
-- component, count it as connected, and the rest as an arbitrary graph on the remaining n-k vertices), so
--   c(n) = g(n) − Σ_{k=1}^{n-1} C(n-1,k-1) · c(k) · g(n-k).
-- Verified against A001187 (1,1,1,4,38,728,26704,…) — our c(0)=0 rather than the OEIS a(0)=1 convention (a graph on
-- 0 vertices has 0 components under number_of_components, not 1, so it fails our own is_connected_graph predicate;
-- selfcert requires the accel and the floor-filter to agree at every n, so we match our predicate, not the
-- species-vacuous convention, at n=0).

CREATE FUNCTION is_connected_graph(g labeled_graph) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (g).n > 0 AND number_of_components(g) = 1 $$;

CREATE FUNCTION connected_graph_count(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE c numeric[]; g numeric[]; k int; j int; total numeric;
  BEGIN
    IF n < 0 THEN RETURN 0; END IF;
    c := array_fill(0::numeric, ARRAY[n+1]);   -- c[k+1] = # connected labeled graphs on k vertices, k=0..n; c[1] (k=0) stays 0
    g := array_fill(0::numeric, ARRAY[n+1]);   -- g[k+1] = 2^C(k,2), the parent's own closed form
    FOR k IN 0..n LOOP g[k+1] := trunc(2::numeric ^ graph_edge_count(k)); END LOOP;
    FOR k IN 1..n LOOP
      total := g[k+1];
      FOR j IN 1..k-1 LOOP total := total - binomial(k-1, j-1) * c[j+1] * g[k-j+1]; END LOOP;
      c[k+1] := total;
    END LOOP;
    RETURN c[n+1];
  END $$;

-- accel hook (#89): count_fn is on the PARENT (labeled_graphs) fiber.
CREATE FUNCTION connected_labeled_graph_count(f labeled_graphs_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT connected_graph_count((f).n::int) $$;

SELECT base_restrict('connected_labeled_graphs', 'labeled_graphs', 'is_connected_graph', count_fn => 'connected_labeled_graph_count');

CREATE FUNCTION fiber_symbol(f connected_labeled_graphs_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Gc([' || (f).n::int || '])' $$;

SELECT wire_set_notation('connected_labeled_graphs');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('connected_labeled_graphs','A001187 anchor for n=0..6: 0,1,1,4,38,728,26704 (n=0 is 0, not OEIS''s vacuous 1 — see header)','eq','0,1,1,4,38,728,26704','the count_fn accel (species/log identity), not a floor scan',$q$
    SELECT string_agg(cardinality(connected_labeled_graphs(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('connected_labeled_graphs','accel hook is HONORED: the count_fn synthesized connected_labeled_graphs'' own fiber_count','eq','true','base_restrict wired the closed-form recurrence',$q$
    SELECT (to_regprocedure('fiber_count(connected_labeled_graphs_fiber)') IS NOT NULL)::text $q$),
  ('connected_labeled_graphs','floor count agrees with accel at n=4: 38, counted off the filtered floor','eq','38','enumerate labeled_graphs(4) and count the connected ones',$q$
    SELECT count(*)::text FROM elements(labeled_graphs(4), 1000) e WHERE is_connected_graph((e).value) $q$),
  ('connected_labeled_graphs','every element of connected_labeled_graphs(4) is genuinely connected (1 component)','eq','true','the defining invariant, checked over the floor',$q$
    SELECT bool_and(number_of_components((e).value) = 1) FROM elements(connected_labeled_graphs(4)) e $q$),
  ('connected_labeled_graphs','contains: the path 1-2-3-4 ∈ connected_labeled_graphs(4); the empty graph on [4] ∉','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT contains(connected_labeled_graphs(4), ROW(4, ARRAY[1,3,6])::labeled_graph)::text || '|' ||
           contains(connected_labeled_graphs(4), ROW(4, ARRAY[]::int[])::labeled_graph)::text $q$);
