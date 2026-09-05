-- requires: dyck_paths, realizer
-- binary_trees — full binary trees with n internal nodes (each internal node has exactly 2 children),
-- counted by Catalan(n). Encoded as the PREORDER Lukasiewicz word: 1 for an internal node, 0 for a leaf.
-- Single grade [n]. Provides the floor (words in ASCENDING lex order of the shape array) + a Catalan count
-- accel + a contains engine; base_realize generates handle/fiber/element + constructor (incl. the (lo,hi)
-- range form) + the full surface.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE binary_tree AS (shape int[]);                             -- 1/0 preorder word, length 2n+1
CREATE FUNCTION notation(t binary_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(s::text, '' ORDER BY o), '')
  FROM unnest((t).shape) WITH ORDINALITY AS x(s, o) $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: every full binary tree with n internal nodes, emitted in ASCENDING lex order of the shape array
-- (0 < 1, so a leaf sorts before an internal node at the first differing position). Grow all valid
-- prefixes tracking the running "open slots" count: start at 1 (the root's single open slot); a 1
-- (internal node) consumes one slot and opens two (slots += 1, net); a 0 (leaf) consumes one (slots -= 1).
-- A prefix can only be extended while its slots are still open (slots >= 1) — once slots hits 0 the word
-- is complete and cannot grow further, which is exactly the "stays >= 1 before the last symbol, hits 0
-- at the end" invariant: a state can only reach the target length with slots = 0 if it got there on the
-- very last symbol (any earlier 0-slots state is a dead branch, since it can't be extended).
CREATE TYPE binary_trees_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f binary_trees_fiber, element_limit int) RETURNS SETOF binary_tree LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(shape, slots, ones, len) AS (
      SELECT ARRAY[]::int[], 1, 0, 0
    UNION ALL
      SELECT g.shape || c.sym, g.slots + CASE WHEN c.sym = 1 THEN 1 ELSE -1 END,
             g.ones + CASE WHEN c.sym = 1 THEN 1 ELSE 0 END, g.len + 1
      FROM gen g CROSS JOIN (VALUES (1), (0)) AS c(sym)
      WHERE g.len < 2 * (f).n::int + 1
        AND g.slots >= 1                                     -- only an still-open prefix may extend
        AND (c.sym = 0 OR g.ones < (f).n::int)              -- cap internal-node count at n
  )
  SELECT ROW(shape)::binary_tree FROM gen
  WHERE len = 2 * (f).n::int + 1 AND slots = 0
  ORDER BY shape ASC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f binary_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT catalan((f).n::int) $$;

-- contains: v is a full-binary preorder word of n internal nodes iff length 2n+1, every symbol 0/1,
-- the running "open slots" count (start 1, +1 per 1, -1 per 0) stays >= 1 at every position before the
-- last, and lands on exactly 0 at the last position.
CREATE FUNCTION contains_in_fiber(f binary_trees_fiber, v binary_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  WITH steps AS (
    SELECT s, o, 1 + sum(CASE WHEN s = 1 THEN 1 ELSE -1 END) OVER (ORDER BY o) AS slots_after
    FROM unnest((v).shape) WITH ORDINALITY AS t(s, o)
  )
  SELECT coalesce(array_length((v).shape, 1), 0) = 2 * (f).n::int + 1
     AND NOT EXISTS (SELECT 1 FROM steps WHERE s NOT IN (0, 1))
     AND coalesce((SELECT slots_after FROM steps ORDER BY o DESC LIMIT 1), -1) = 0
     AND coalesce((SELECT min(slots_after) FROM steps WHERE o < coalesce(array_length((v).shape, 1), 0)), 1) >= 1 $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('binary_trees', 'binary_tree');
INSERT INTO base_grade VALUES ('binary_trees', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f binary_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'BT(' || (f).n::int || ')' $$;   -- corpus symbol
-- direct unrank: the preorder word, minus its FORCED final leaf (slots always hits exactly 0 there), is exactly a
-- Dyck path of semilength n (1↦U, 0↦D) — same non-negativity + n-ups/n-downs structure, just re-lettered. The floor's
-- ASCENDING order (0 before 1, i.e. D before U) is the MIRROR of dyck_paths' own U-before-D convention, so reuse
-- dyck_completions (requires: dyck_paths) but prefer D first at each of the first 2n steps, then append the fixed
-- trailing leaf.
CREATE FUNCTION fiber_unrank(f binary_trees_fiber, rank rank_index) RETURNS binary_tree LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE n int := (f).n::int; shape int[] := '{}'; ru int := n; rd int := n; h int := 0; r numeric := rank;
          cd numeric; i int; BEGIN
    IF n = 0 THEN RETURN ROW(ARRAY[0])::binary_tree; END IF;
    FOR i IN 1..2 * n LOOP
      cd := CASE WHEN rd > 0 AND h - 1 >= 0 THEN dyck_completions(ru, rd - 1, h - 1) ELSE 0 END;
      IF rd > 0 AND h - 1 >= 0 AND r < cd THEN
        shape := shape || 0; rd := rd - 1; h := h - 1;
      ELSE
        IF rd > 0 AND h - 1 >= 0 THEN r := r - cd; END IF;
        shape := shape || 1; ru := ru - 1; h := h + 1;
      END IF;
    END LOOP;
    shape := shape || 0;   -- the forced trailing leaf (slots always lands at exactly 0 here)
    RETURN ROW(shape)::binary_tree;
  END $fu$;
SELECT base_realize('binary_trees');

-- ── associahedron realization ────────────────────────────────────────────────────────────────────────
-- Binary trees are the VERTICES of the associahedron; Loday's realization places each at integer coordinates
-- a_i = (#leaves left)·(#leaves right) per internal node, in infix order, on the hyperplane Σ = C(#leaves, 2).
-- Recurse over the preorder Łukasiewicz word: a leaf (0) has one leaf and no coordinate; an internal node (1)
-- takes its left subtree's coords, then its own left·right leaf product, then its right subtree's coords.
CREATE FUNCTION binary_tree_loday_rec(w int[], pos int, OUT leaves int, OUT nextpos int, OUT coords int[]) LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE lr record; rr record;
  BEGIN
    IF w[pos] = 0 THEN
      leaves := 1; nextpos := pos + 1; coords := '{}'::int[];
    ELSE
      SELECT * INTO lr FROM binary_tree_loday_rec(w, pos + 1);
      SELECT * INTO rr FROM binary_tree_loday_rec(w, lr.nextpos);
      leaves := lr.leaves + rr.leaves; nextpos := rr.nextpos;
      coords := lr.coords || (lr.leaves * rr.leaves) || rr.coords;
    END IF;
  END $$;
CREATE FUNCTION binary_tree_loday_point(t binary_tree) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (binary_tree_loday_rec((t).shape, 1)).coords $$;
CREATE FUNCTION binary_tree_loday(t binary_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- the point, for humans/-R
  SELECT '(' || coalesce(array_to_string(binary_tree_loday_point(t), ','), '') || ')' $$;

-- split a subtree's Łukasiewicz word "1"·L·R into its two child words L and R, via the first-return balance
-- (+1 per internal, −1 per leaf; a complete subtree returns the running balance to −1).
CREATE FUNCTION binary_tree_split(w int[], OUT lword int[], OUT rword int[]) LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m int := coalesce(array_length(w,1),0); bal int := 0; i int; lend int := 1;
  BEGIN
    FOR i IN 2..m LOOP
      bal := bal + CASE WHEN w[i] = 1 THEN 1 ELSE -1 END;
      IF bal = -1 THEN lend := i; EXIT; END IF;
    END LOOP;
    lword := w[2:lend]; rword := w[lend+1:m];
  END $$;
-- the single-rotation neighbours (the associahedron edges through this vertex): a left rotation on each internal
-- right child ([a,[b0,b1]] → [[a,b0],b1]) and a right rotation on each internal left child ([[a0,a1],b] → [a0,[a1,b]]),
-- everywhere in the tree. A tree with L leaves has L−2 of them.
CREATE FUNCTION binary_tree_flip_words(w int[]) RETURNS SETOF int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE sp record; rsp record; lsp record; fl int[];
  BEGIN
    IF coalesce(array_length(w,1),0) <= 1 THEN RETURN; END IF;                       -- leaf: no flips
    SELECT * INTO sp FROM binary_tree_split(w);
    IF array_length(sp.rword,1) > 1 THEN                                             -- left rotation
      SELECT * INTO rsp FROM binary_tree_split(sp.rword);
      RETURN NEXT ARRAY[1] || (ARRAY[1] || sp.lword || rsp.lword) || rsp.rword;
    END IF;
    IF array_length(sp.lword,1) > 1 THEN                                             -- right rotation
      SELECT * INTO lsp FROM binary_tree_split(sp.lword);
      RETURN NEXT ARRAY[1] || lsp.lword || (ARRAY[1] || lsp.rword || sp.rword);
    END IF;
    FOR fl IN SELECT * FROM binary_tree_flip_words(sp.lword) LOOP RETURN NEXT ARRAY[1] || fl || sp.rword; END LOOP;
    FOR fl IN SELECT * FROM binary_tree_flip_words(sp.rword) LOOP RETURN NEXT ARRAY[1] || sp.lword || fl; END LOOP;
  END $$;
CREATE FUNCTION binary_tree_flips(t binary_tree) RETURNS SETOF binary_tree LANGUAGE sql STABLE AS $$
  SELECT ROW(w)::binary_tree FROM binary_tree_flip_words((t).shape) w $$;

INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('binary_trees','loday','binary_tree_loday','Loday coordinate (associahedron)',false);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('binary_trees','cardinality anchor = Catalan for n=0..5 (accel)','eq','1,1,2,5,14,42','number of internal nodes -> Catalan(n)',$q$
    SELECT string_agg(cardinality(binary_trees(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('binary_trees','n=0 => the single leaf','eq','1|0','Catalan(0)=1, the bare leaf word',$q$
    SELECT count(*)::text || '|' || notation((unrank(binary_trees(0), 0)).value) FROM elements(binary_trees(0)) e $q$),
  ('binary_trees','n=1 => one tree','eq','100','root with two leaf children',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(binary_trees(1)) e $q$),
  ('binary_trees','n=2 in ascending shape order','eq','10100,11000','the two trees',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(binary_trees(2)) e $q$),
  ('binary_trees','n=3 in ascending shape order','eq','1010100,1011000,1100100,1101000,1110000','the five trees',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(binary_trees(3)) e $q$),
  ('binary_trees','floor generates 14 trees at n=4 (cardinality via counting)','eq','14','independent of the Catalan accel',$q$
    SELECT count(*)::text FROM elements(binary_trees(4)) e $q$),
  ('binary_trees','floor generates 42 trees at n=5','eq','42','the floor, counted',$q$
    SELECT count(*)::text FROM elements(binary_trees(5)) e $q$),
  ('binary_trees','every generated word satisfies the slot invariant (n=4)','eq','true','structural check, no contains fn',$q$
    SELECT bool_and(
        (SELECT count(*) FROM unnest(((e).value).shape) s WHERE s = 1) = 4
        AND (SELECT 1 + sum(CASE WHEN s = 1 THEN 1 ELSE -1 END) FROM unnest(((e).value).shape) s) = 0
        AND coalesce((SELECT min(slots) FROM (
              SELECT o, 1 + sum(CASE WHEN s = 1 THEN 1 ELSE -1 END) OVER (ORDER BY o) AS slots
              FROM unnest(((e).value).shape) WITH ORDINALITY AS t(s, o)) q
            WHERE q.o < array_length(((e).value).shape, 1)), 1) >= 1
      )::text FROM elements(binary_trees(4)) e $q$),
  ('binary_trees','cardinality(binary_trees(5)) = 42 (accel)','eq','42','closed-form Catalan',$q$
    SELECT cardinality(binary_trees(5))::text $q$),
  ('binary_trees','range handle: cardinality(binary_trees(0,3)) = 9','eq','9','C0+C1+C2+C3 summed over fibers',$q$
    SELECT cardinality(binary_trees(0,3))::text $q$),
  ('binary_trees','fibers(binary_trees(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade ranges',$q$
    SELECT string_agg(((f).n)::text, ',' ORDER BY (f).n) FROM fibers(binary_trees(0,3)) f $q$),
  ('binary_trees','unrank first/last of n=3','eq','1010100|1110000','ranks 0 and 4',$q$
    SELECT notation((unrank(binary_trees(3), 0)).value) || '|' ||
           notation((unrank(binary_trees(3), 4)).value) $q$),
  ('binary_trees','element carries a TYPED point fiber + ordinality','eq','3|1','unrank(binary_trees(3),1)',$q$
    SELECT (unrank(binary_trees(3), 1)).fiber.n::text || '|' || ordinality(unrank(binary_trees(3), 1))::text $q$),
  ('binary_trees','global order across fibers = (n, ordinality): binary_trees(1,2)','eq','100|10100|11000','n ascending, shape-lex within',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY e) FROM elements(binary_trees(1,2)) e $q$),
  ('binary_trees','contains: 100 in binary_trees(1), 001 not in (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[1,0,0])::binary_tree <@ binary_trees(1))::text || '|' ||
           (ROW(ARRAY[0,0,1])::binary_tree <@ binary_trees(1))::text $q$),
  ('binary_trees','Loday coordinates: 11000 ↦ (1,2), 10100 ↦ (2,1) (left·right leaves per internal node, infix)','eq','(1,2)|(2,1)','the associahedron realization',$q$
    SELECT binary_tree_loday(ROW(ARRAY[1,1,0,0,0])::binary_tree) || '|' || binary_tree_loday(ROW(ARRAY[1,0,1,0,0])::binary_tree) $q$),
  ('binary_trees','Loday points lie on the hyperplane Σ = C(#leaves,2): over binary_trees(3) every point sums to 6','eq','true','4 leaves ⇒ Σ = C(4,2) = 6',$q$
    SELECT bool_and((SELECT sum(x) FROM unnest(binary_tree_loday_point((e).value)) x) = 6)::text FROM elements(binary_trees(3)) e $q$),
  ('binary_trees','flips: the two n=2 trees are a single rotation apart','eq','10100','the one flip of 11000',$q$
    SELECT notation(f) FROM binary_tree_flips(ROW(ARRAY[1,1,0,0,0])::binary_tree) f $q$),
  ('binary_trees','the associahedron K_4 is a pentagon: binary_trees(3) has 5 vertices, each with 2 flips, so 5 edges','eq','5|2|5','vertices | flips-per-vertex | edges',$q$
    SELECT cardinality(binary_trees(3))::text || '|' ||
           (SELECT count(*) FROM binary_tree_flips((unrank(binary_trees(3),0)).value))::text || '|' ||
           (SELECT (count(*)/2)::text FROM elements(binary_trees(3)) e, binary_tree_flips((e).value) f) $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('binary_trees','fiber_unrank(binary_trees(4), 0..13) are all members (accel floor)','eq','true','Dyck-completions unrank lands inside the Catalan(4)=14 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(binary_trees(4)) f), ord::rank_index) <@ binary_trees(4))::text
      FROM generate_series(0, cardinality(binary_trees(4))::int - 1) ord $q$);
