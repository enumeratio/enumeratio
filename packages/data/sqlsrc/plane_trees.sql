-- requires: dyck_paths, realizer
-- plane_trees — rooted PLANE (ordered) trees on n NODES, carried by their PRE-ORDER CHILD-COUNT sequence (the
-- Łukasiewicz word): degrees[i] = number of children of the i-th node visited in depth-first pre-order. Length n,
-- sum = n-1 (edges). Single grade [n] = node count; |plane_trees(n)| = Catalan(n-1). This is a DISTINCT carrier from
-- ordered_trees (the ±1 DFS parenthesis word) — a degree word is not a step word — so it is its own collection,
-- order-isomorphic to dyck_paths of semilength n-1 via the DFS bijection (child-count ↔ U/D). It BORROWS the Dyck
-- floor: each Dyck path of semilength n-1 decodes to one plane tree, in the same order.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE plane_tree AS (degrees int[]);                             -- pre-order child counts; e.g. {2,0,0} = root + 2 leaves
CREATE FUNCTION notation(t plane_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_to_string((t).degrees, ','), '') $$;

-- Dyck ±1 word → pre-order child-count word. DFS with a stack of open nodes: an up-step '(' descends into a fresh
-- child of the current node (bump its degree, push the child); a down-step ')' returns to the parent (pop). Nodes
-- are numbered in creation (= pre-order) order, so degrees[] comes out already in pre-order.
CREATE FUNCTION plane_tree_from_dyck(p dyck_path) RETURNS plane_tree LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE degrees int[] := ARRAY[0]; stack int[] := ARRAY[1]; created int := 1; s int; top int;
  BEGIN
    FOREACH s IN ARRAY (p).steps LOOP
      IF s = 1 THEN                                        -- '(' : descend into a new child
        top := stack[array_length(stack, 1)];
        degrees[top] := degrees[top] + 1;                 -- the parent gains a child
        created := created + 1;
        degrees := degrees || 0;                          -- the new node, no children yet
        stack := stack || created;                        -- push it
      ELSE                                                 -- ')' : return to parent
        stack := stack[1 : array_length(stack, 1) - 1];
      END IF;
    END LOOP;
    RETURN ROW(degrees)::plane_tree;
  END $$;

-- inverse (the manifest bijection, registered as a map): pre-order child-count word → Dyck ±1 word. Walk the nodes
-- in pre-order; a stack holds each open ancestor's remaining unopened children. Open the next child (emit +1) until a
-- node's children are exhausted, then return (emit −1, except at the root).
CREATE FUNCTION dyck_from_plane_tree(t plane_tree) RETURNS dyck_path LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE steps int[] := '{}'; remaining int[]; i int := 1; top int;
  BEGIN
    remaining := ARRAY[(t).degrees[1]];                    -- the root's child count
    WHILE array_length(remaining, 1) > 0 LOOP
      top := array_length(remaining, 1);
      IF remaining[top] > 0 THEN                           -- open the next child of the current node
        remaining[top] := remaining[top] - 1;
        i := i + 1;
        steps := steps || 1;                               -- descend: '('
        remaining := remaining || (t).degrees[i];          -- the child's own child count
      ELSE                                                  -- done here: pop, and close unless it is the root
        remaining := remaining[1 : top - 1];
        IF array_length(remaining, 1) > 0 THEN steps := steps || -1; END IF;   -- return: ')'
      END IF;
    END LOOP;
    RETURN ROW(steps)::dyck_path;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE plane_trees_fiber AS (n natural_number);   -- typed fiber; axis: n = node count
-- FLOOR: borrow dyck_paths' ordered floor at semilength n-1 and decode each path to its plane tree. `d` is a bare
-- whole-row alias (keeps the composite from expanding into columns); the Dyck emission order carries through, so the
-- in-fiber rank matches dyck_paths exactly.
CREATE FUNCTION fiber_elements(f plane_trees_fiber, element_limit int) RETURNS SETOF plane_tree LANGUAGE sql STABLE AS $$
  SELECT plane_tree_from_dyck(d)
    FROM fiber_elements(ROW((f).n::int - 1)::dyck_paths_fiber, element_limit) d LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f plane_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT catalan((f).n::int - 1) $$;                       -- n nodes ⇒ n-1 edges ⇒ Catalan(n-1)
-- contains: v is a valid pre-order degree word (Łukasiewicz word) of a tree on n nodes iff it has length n, every
-- degree ≥ 0, sums to n-1, and every PROPER prefix of Σ(degree_i − 1) stays ≥ 0 (the total lands at −1).
CREATE FUNCTION contains_in_fiber(f plane_trees_fiber, v plane_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).degrees, 1), 0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).degrees) d WHERE d < 0)
     AND coalesce((SELECT sum(d) FROM unnest((v).degrees) d), 0) = (f).n::int - 1
     AND NOT EXISTS (
       SELECT 1 FROM (
         SELECT sum(d - 1) OVER (ORDER BY o) AS s, o, count(*) OVER () AS len
           FROM unnest((v).degrees) WITH ORDINALITY AS t(d, o)) q
        WHERE o < len AND s < 0) $$;

INSERT INTO base_collection VALUES ('plane_trees', 'plane_tree');
INSERT INTO base_grade VALUES ('plane_trees', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f plane_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'PT(' || (f).n::int || ')' $$;   -- corpus symbol
-- direct unrank: same borrow-the-Dyck-floor trick as fiber_elements above — unrank the semilength-(n-1) Dyck path
-- at this rank (dyck_paths' own ballot/reflection-principle accel) and decode it to its plane tree.
CREATE FUNCTION fiber_unrank(f plane_trees_fiber, rank rank_index) RETURNS plane_tree LANGUAGE sql IMMUTABLE AS $fu$
  SELECT plane_tree_from_dyck(fiber_unrank(ROW((f).n::int - 1)::dyck_paths_fiber, rank)) $fu$;
SELECT base_realize('plane_trees');

-- the manifest bijection to dyck_paths (DFS pre-order child-count ↔ U/D word)
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('plane_trees', 'dyck', 'dyck_from_plane_tree', 'dyck_paths', 'The DFS Dyck word of the tree', NULL);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('plane_trees','cardinality = Catalan(n-1) for n=1..6 nodes','eq','1,1,2,5,14,42','Catalan shifted by the node/edge offset [[OEIS:A000108]]',$q$
    SELECT string_agg(cardinality(plane_trees(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('plane_trees','n=1 ⇒ the single root-leaf tree ⟨0⟩','eq','1|0','Catalan(0)=1',$q$
    SELECT count(*)::text || '|' || notation((unrank(plane_trees(1), 0)).value) FROM elements(plane_trees(1)) e $q$),
  ('plane_trees','plane_trees(3) in Dyck order: chain then star','eq','1,1,0|2,0,0','ranks 0,1 (borrowed from dyck_paths(2))',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(plane_trees(3)) e $q$),
  ('plane_trees','plane_trees(4): the 5 pre-order degree words','eq','1,1,1,0|1,2,0,0|2,1,0,0|2,0,1,0|3,0,0,0','Catalan(3)=5, in dyck_paths(3) order',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(plane_trees(4)) e $q$),
  ('plane_trees','rank 0 of n=4 = the chain 1,1,1,0; rank 4 = the star 3,0,0,0','eq','1,1,1,0|3,0,0,0','anchors the two extremes',$q$
    SELECT notation((unrank(plane_trees(4), 0)).value) || '|' ||
           notation((unrank(plane_trees(4), 4)).value) $q$),
  ('plane_trees','every element has n degrees summing to n-1 (edges), n=5','eq','true','the Łukasiewicz invariant across the fiber',$q$
    SELECT bool_and(array_length(((e).value).degrees,1) = 5
                AND (SELECT sum(d) FROM unnest(((e).value).degrees) d) = 4)::text
      FROM elements(plane_trees(5)) e $q$),
  ('plane_trees','floor counts n=1..6 match Catalan (independent of the accel)','eq','1,1,2,5,14,42','the generated floor, counted',$q$
    SELECT string_agg((SELECT count(*) FROM elements(plane_trees(n)))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('plane_trees','element carries a TYPED point fiber + ordinality','eq','5|3','unrank(plane_trees(5),3)',$q$
    SELECT (unrank(plane_trees(5), 3)).fiber.n::text || '|' || ordinality(unrank(plane_trees(5), 3))::text $q$),
  ('plane_trees','range handle: cardinality(plane_trees(1,4)) = 9','eq','9','C0+C1+C2+C3 over n=1..4',$q$
    SELECT cardinality(plane_trees(1,4))::text $q$),
  ('plane_trees','the dyck bijection round-trips: decode∘encode = identity on plane_trees(4)','eq','true','dyck_from_plane_tree is the inverse of the floor decode',$q$
    SELECT bool_and(plane_tree_from_dyck(dyck_from_plane_tree((e).value)) = (e).value)::text FROM elements(plane_trees(4)) e $q$),
  ('plane_trees','the map lands on the matching dyck word: star 2,0,0 ↦ UDUD','eq','UDUD','base_map plane_trees→dyck_paths',$q$
    SELECT notation(dyck_from_plane_tree(ROW(ARRAY[2,0,0])::plane_tree)) $q$),
  ('plane_trees','contains via <@: 2,0,0 ∈ plane_trees(3), 0,2,0 ∉ (prefix dips), 1,1,0 ∈','eq','true|false|true','generated from the Łukasiewicz predicate',$q$
    SELECT (ROW(ARRAY[2,0,0])::plane_tree <@ plane_trees(3))::text || '|' ||
           (ROW(ARRAY[0,2,0])::plane_tree <@ plane_trees(3))::text || '|' ||
           (ROW(ARRAY[1,1,0])::plane_tree <@ plane_trees(3))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('plane_trees','fiber_unrank(plane_trees(5), 0..13) are all members (accel floor)','eq','true','dyck-borrowed unrank lands inside the Catalan(4)=14 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(plane_trees(5)) f), ord::rank_index) <@ plane_trees(5))::text
      FROM generate_series(0, cardinality(plane_trees(5))::int - 1) ord $q$);
