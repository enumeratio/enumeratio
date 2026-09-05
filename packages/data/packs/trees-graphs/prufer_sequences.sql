-- requires: labeled_trees, realizer, utilities
-- prufer_sequences — the Prüfer sequences on n vertices: words of length n-2 over {1..n}, nⁿ⁻² of them (Cayley),
-- the single empty sequence for n≤2. This is the SAME carrier + data as labeled_trees (whose carrier already stores
-- the tree AS its Prüfer array) — prufer_sequences is the NOTATION SIBLING that presents the code itself (⟨…⟩) rather
-- than the tree it decodes to. Borrows the labeled_trees floor + count + contains verbatim (odometer order, mixed
-- radix base n, MSD first); rank = the sequence as a base-n number.

-- ── the sequence-facing readings ───────────────────────────────────────────────────────────────────────
CREATE FUNCTION prufer_notation(t labeled_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- ⟨a,b,…⟩ (empty ⟨⟩)
  SELECT '⟨' || array_to_string((t).prufer, ',') || '⟩' $$;
CREATE FUNCTION prufer_length(t labeled_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(array_length((t).prufer, 1), 0) $$;
CREATE FUNCTION prufer_leaves(t labeled_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$   -- vertices absent from the code (degree 1); n = len+2
  SELECT (coalesce(array_length((t).prufer, 1), 0) + 2) - coalesce((SELECT count(DISTINCT x) FROM unnest((t).prufer) x), 0)::int $$;

-- ── borrow the labeled_trees engines verbatim (same nⁿ⁻² sequences, same order) ─────────────────────────
CREATE TYPE prufer_sequences_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows labeled_trees' floor)
CREATE FUNCTION fiber_elements(f prufer_sequences_fiber, element_limit int) RETURNS SETOF labeled_tree LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::labeled_trees_fiber, element_limit) v LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f prufer_sequences_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fiber_count(ROW((f).n)::labeled_trees_fiber) $$;
CREATE FUNCTION contains_in_fiber(f prufer_sequences_fiber, v labeled_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::labeled_trees_fiber, v) $$;

INSERT INTO base_collection VALUES ('prufer_sequences', 'labeled_tree');
INSERT INTO base_grade VALUES ('prufer_sequences', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f prufer_sequences_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '[' || (f).n::int || ']^{' || (f).n::int || '-2}' $$;   -- corpus symbol
-- direct unrank: same elements/order as labeled_trees(n) (the Prüfer bijection) — delegate.
CREATE FUNCTION fiber_unrank(f prufer_sequences_fiber, rank rank_index) RETURNS labeled_tree LANGUAGE sql IMMUTABLE AS $fu$
  SELECT fiber_unrank(ROW((f).n)::labeled_trees_fiber, rank) $fu$;
SELECT base_realize('prufer_sequences');

INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('prufer_sequences','tuple','notation','Tuple (a,b,…)',true),        -- matches the shared carrier ::text cast
  ('prufer_sequences','sequence','prufer_notation','Prüfer sequence ⟨a,b,…⟩',false);
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('prufer_sequences','length','prufer_length','Length (n-2)','natural_numbers'),
  ('prufer_sequences','leaves','prufer_leaves','Leaves of the encoded tree','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('prufer_sequences','count = nⁿ⁻² (Cayley) for n=1..5: 1,1,3,16,125','eq','1,1,3,16,125','borrowed from labeled_trees',$q$
    SELECT string_agg(cardinality(prufer_sequences(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n $q$),
  ('prufer_sequences','n≤2 ⇒ the single empty sequence ⟨⟩','eq','⟨⟩|⟨⟩','the lone vertex / single edge',$q$
    SELECT prufer_notation((unrank(prufer_sequences(1), 0)).value) || '|' || prufer_notation((unrank(prufer_sequences(2), 0)).value) $q$),
  ('prufer_sequences','prufer_sequences(3) = the 3 length-1 codes over {1,2,3}','eq','⟨1⟩,⟨2⟩,⟨3⟩','nⁿ⁻² = 3',$q$
    SELECT string_agg(prufer_notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(prufer_sequences(3)) e $q$),
  ('prufer_sequences','n=4 odometer order, first five of 16','eq','⟨1,1⟩,⟨1,2⟩,⟨1,3⟩,⟨1,4⟩,⟨2,1⟩','mixed-radix base 4, MSD first',$q$
    SELECT string_agg(prufer_notation(v), ',' ORDER BY rk) FROM (
      SELECT (e).value v, row_number() OVER (ORDER BY e) rk FROM elements(prufer_sequences(4)) e) s WHERE rk <= 5 $q$),
  ('prufer_sequences','leaves stat: ⟨1,1⟩ encodes the star at 1 (3 leaves), ⟨1,2⟩ a path (2 leaves)','eq','3|2','leaves = vertices absent from the code',$q$
    SELECT prufer_leaves(ROW(ARRAY[1,1])::labeled_tree)::text || '|' || prufer_leaves(ROW(ARRAY[1,2])::labeled_tree)::text $q$),
  ('prufer_sequences','same objects as labeled_trees, rank-for-rank (a pure notation sibling)','eq','true','borrowed floor ⇒ identical enumeration',$q$
    SELECT bool_and((a).value = (b).value) FROM elements(prufer_sequences(4)) a JOIN elements(labeled_trees(4)) b ON ordinality(a) = ordinality(b) $q$),
  ('prufer_sequences','contains via <@: ⟨2,2⟩ ∈ prufer_sequences(4), ⟨2,5⟩ ∉ (5 out of range)','eq','true|false','borrowed contains engine',$q$
    SELECT (ROW(ARRAY[2,2])::labeled_tree <@ prufer_sequences(4))::text || '|' || (ROW(ARRAY[2,5])::labeled_tree <@ prufer_sequences(4))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('prufer_sequences','fiber_unrank(prufer_sequences(4), 0..15) are all members (accel floor)','eq','true','delegated labeled_trees unrank lands inside the n^(n-2)=16 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(prufer_sequences(4)) f), ord::rank_index) <@ prufer_sequences(4))::text
      FROM generate_series(0, cardinality(prufer_sequences(4))::int - 1) ord $q$);
