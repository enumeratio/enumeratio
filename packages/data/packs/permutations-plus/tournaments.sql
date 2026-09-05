-- requires: labeled_graphs, realizer
-- tournaments — orientations of the complete graph on [n] (issue #228): for every pair {i,j}, i<j, choose i→j or
-- j→i. Same underlying bitset-over-C(n,2) engine as labeled_graphs (reuses graph_edge_count/graph_edge_pair from
-- that file), but a DIFFERENT carrier: `reversed` marks which edge-indices point the "wrong" way (j→i) rather than
-- which edges exist — every pair is always present here, only its direction varies. Count 2^C(n,2), same closed
-- form as labeled_graphs. Fiber symbol T([n]).
CREATE TYPE tournament AS (n int, reversed int[]);   -- sorted 1-indexed edge-indices oriented j→i (else i→j)

CREATE FUNCTION notation(t tournament) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT string_agg(
    CASE WHEN e = ANY((t).reversed)
      THEN (graph_edge_pair((t).n, e))[2] || '→' || (graph_edge_pair((t).n, e))[1]
      ELSE (graph_edge_pair((t).n, e))[1] || '→' || (graph_edge_pair((t).n, e))[2]
    END, ',' ORDER BY e) FROM generate_series(1, graph_edge_count((t).n)) e), '') $$;

-- ── the engines a collection provides (identical shape to labeled_graphs — same bitset, different semantics) ──
CREATE TYPE tournaments_fiber AS (n natural_number);
CREATE FUNCTION fiber_count(f tournaments_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT trunc(2::numeric ^ graph_edge_count((f).n::int)) $$;   -- 2^C(n,2)
CREATE FUNCTION fiber_elements(f tournaments_fiber, element_limit int) RETURNS SETOF tournament LANGUAGE sql STABLE AS $$
  SELECT ROW((f).n::int, (subset_unrank_colex(graph_edge_count((f).n::int), k, ord)).members)::tournament
    FROM generate_series(0, graph_edge_count((f).n::int)) k,
         LATERAL generate_series(0, binomial(graph_edge_count((f).n::int), k)::int - 1) ord
   ORDER BY k, ord LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f tournaments_fiber, t tournament) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (t).n = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((t).reversed) e WHERE e < 1 OR e > graph_edge_count((f).n::int))
     AND coalesce((t).reversed, '{}') = coalesce((SELECT array_agg(DISTINCT e ORDER BY e) FROM unnest((t).reversed) e), '{}') $$;
CREATE FUNCTION fiber_symbol(f tournaments_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'T([' || (f).n::int || '])' $$;

INSERT INTO base_collection VALUES ('tournaments', 'tournament');
INSERT INTO base_grade VALUES ('tournaments', 1, 'n', NULL, NULL);
-- direct unrank: a tournament on [n] is a choice of orientation (a subset of the C(n,2) edge slots to reverse); the
-- fiber is that powerset in (k ascending, colex within) order, so unrank the reversed-edge set via subsets' powerset unrank.
CREATE FUNCTION fiber_unrank(f tournaments_fiber, rank rank_index) RETURNS tournament LANGUAGE sql IMMUTABLE AS $fu$
  SELECT ROW((f).n::int, (powerset_unrank(graph_edge_count((f).n::int), rank::bigint)).members)::tournament $fu$;
SELECT base_realize('tournaments');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('tournaments','|tournaments(n)| = 2^C(n,2) for n=0..5: 1,1,2,8,64,1024','eq','1,1,2,8,64,1024','same closed form as labeled_graphs — orientation, not presence',$q$
    SELECT string_agg(cardinality(tournaments(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('tournaments','the 2 tournaments on [2]: 1→2 and 2→1','eq','1→2,2→1','C(2,2)=1 pair, oriented either way',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(tournaments(2)) e $q$),
  ('tournaments','the "no reversals" tournament on [3] orients every pair i→j (i<j)','eq','1→2,1→3,2→3','reversed = {} — the identity orientation',$q$
    SELECT notation(ROW(3, ARRAY[]::int[])::tournament) $q$),
  ('tournaments','reversing edge-index 2 ({1,3}) flips only that pair','eq','1→2,3→1,2→3','reversed = {2}',$q$
    SELECT notation(ROW(3, ARRAY[2])::tournament) $q$),
  ('tournaments','contains via <@: reversed={2} ∈ tournaments(3), an out-of-range edge-index ∉','eq','true|false','ground-aware containment',$q$
    SELECT (ROW(3, ARRAY[2])::tournament <@ tournaments(3))::text || '|' || (ROW(3, ARRAY[99])::tournament <@ tournaments(3))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('tournaments','fiber_unrank(tournaments(4), 0..63) are all members (accel floor)','eq','true','orientation powerset unrank lands inside the 2^C(4,2)=64 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(tournaments(4)) f), ord::rank_index) <@ tournaments(4))::text
      FROM generate_series(0, cardinality(tournaments(4))::int - 1) ord $q$);
