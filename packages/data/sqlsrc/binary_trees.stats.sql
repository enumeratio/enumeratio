-- requires: binary_trees, dyck_paths, realizer, utilities
-- binary_trees statistics + a map — tree invariants read off the 1/0 preorder Łukasiewicz word (1 = internal node,
-- 0 = empty subtree, length 2n+1). Leaves = "100" substrings (a node whose two children are both empty); nodes
-- with no left child = "10" substrings (Narayana-/Dyck-peak-distributed); left-spine = the leading run of 1s;
-- height = longest root-to-node path (nodes). The mirror family — right-spine, no-right-child, and root balance
-- — needs actual tree navigation via binary_tree_split (the right child isn't adjacent in preorder the way the
-- left child is). Map to_dyck_path = drop the final leaf, send 1↦U, 0↦D (the classic preorder-word bijection onto
-- Dyck paths of semilength n).

-- ── statistics (carrier binary_tree) ────────────────────────────────────────────────────────────────────
-- number of leaves = internal nodes with two empty children = occurrences of the substring "100".
CREATE FUNCTION binary_trees_leaves(t binary_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((t).shape,1) i
   WHERE (t).shape[i] = 1 AND (t).shape[i+1] = 0 AND (t).shape[i+2] = 0 $$;

-- number of nodes with no left child = a node (1) immediately followed by an empty (0) = substring "10".
-- (Equidistributed with Dyck-path peaks — the Narayana triangle.)
CREATE FUNCTION binary_trees_no_left_child(t binary_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((t).shape,1) i
   WHERE (t).shape[i] = 1 AND (t).shape[i+1] = 0 $$;

-- left-spine length = number of nodes on the leftmost root-to-leaf chain = the leading run of 1s in the word
-- (position of the first 0, minus one).
CREATE FUNCTION binary_trees_left_spine(t binary_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(min(i) - 1, coalesce(array_length((t).shape,1),0))::int
    FROM generate_subscripts((t).shape,1) i WHERE (t).shape[i] = 0 $$;

-- height = number of nodes on the longest root-to-node path (the empty tree has height 0). Preorder DFS via an
-- explicit slot-stack: each slot carries the depth its root would sit at; a node (1) records its depth and opens
-- two child slots one level deeper, an empty (0) closes a slot. Total pops = word length, so w[i] is always in range.
CREATE FUNCTION binary_trees_height(t binary_tree) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE w int[] := (t).shape; stk int[] := ARRAY[1]; d int; i int := 0; mx int := 0;
  BEGIN
    WHILE array_length(stk,1) IS NOT NULL LOOP
      d := stk[array_length(stk,1)];
      stk := stk[1:array_length(stk,1)-1];                 -- pop
      i := i + 1;
      IF w[i] = 1 THEN
        IF d > mx THEN mx := d; END IF;
        stk := stk || (d+1) || (d+1);                      -- open two child slots (same depth ⇒ order irrelevant)
      END IF;
    END LOOP;
    RETURN mx;
  END $$;

-- right-spine length = number of nodes on the rightmost root-to-leaf chain. Unlike the left spine (exactly the
-- leading run of 1s, since preorder emits the left subtree first and adjacently), the right child isn't adjacent
-- in the word — walk it via binary_tree_split, always descending into .rword, until a bare leaf ("0").
CREATE FUNCTION binary_trees_right_spine(t binary_tree) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE w int[] := (t).shape; sp record; cnt int := 0;
  BEGIN
    WHILE coalesce(array_length(w,1),0) > 1 LOOP
      cnt := cnt + 1;
      SELECT * INTO sp FROM binary_tree_split(w);
      w := sp.rword;
    END LOOP;
    RETURN cnt;
  END $$;

-- number of nodes with no right child = right child is a bare leaf ("0"). Mirror of no_left_child (also Narayana-
-- equidistributed, by the left/right reflection symmetry); needs a full tree walk since the right child isn't
-- adjacent in preorder.
CREATE FUNCTION binary_tree_no_right_child_rec(w int[]) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE sp record;
  BEGIN
    IF coalesce(array_length(w,1),0) <= 1 THEN RETURN 0; END IF;         -- a bare leaf has no children to check
    SELECT * INTO sp FROM binary_tree_split(w);
    RETURN (CASE WHEN coalesce(array_length(sp.rword,1),0) = 1 THEN 1 ELSE 0 END)
         + binary_tree_no_right_child_rec(sp.lword) + binary_tree_no_right_child_rec(sp.rword);
  END $$;
CREATE FUNCTION binary_trees_no_right_child(t binary_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT binary_tree_no_right_child_rec((t).shape) $$;

-- root balance = |internal-node-count(left subtree) − internal-node-count(right subtree)|, the classic AVL-style
-- balance factor at the root (0 = perfectly balanced; the single leaf has no root, balance 0).
CREATE FUNCTION binary_trees_balance(t binary_tree) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE w int[] := (t).shape; sp record; lsize int; rsize int;
  BEGIN
    IF coalesce(array_length(w,1),0) <= 1 THEN RETURN 0; END IF;
    SELECT * INTO sp FROM binary_tree_split(w);
    lsize := (coalesce(array_length(sp.lword,1),0) - 1) / 2;
    rsize := (coalesce(array_length(sp.rword,1),0) - 1) / 2;
    RETURN abs(lsize - rsize);
  END $$;

-- ── map to dyck_paths ───────────────────────────────────────────────────────────────────────────────────
-- to_dyck_path: drop the trailing leaf (the word always ends in 0) and send 1↦U(+1), 0↦D(-1). This is a bijection
-- onto Dyck paths of semilength n: the slot invariant (start 1, +1/−1, ≥1 before the last, 0 at the end) becomes
-- the height staying ≥0 and returning to 0.
CREATE FUNCTION binary_trees_to_dyck_path(t binary_tree) RETURNS dyck_path LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT CASE WHEN (t).shape[i] = 1 THEN 1 ELSE -1 END
    FROM generate_subscripts((t).shape,1) i
    WHERE i < coalesce(array_length((t).shape,1),0)        -- drop the final leaf
    ORDER BY i))::dyck_path $$;

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('binary_trees','leaves','binary_trees_leaves','Number of leaves','natural_numbers'),
  ('binary_trees','no_left_child','binary_trees_no_left_child','Nodes with no left child','natural_numbers'),
  ('binary_trees','left_spine','binary_trees_left_spine','Left spine length','natural_numbers'),
  ('binary_trees','height','binary_trees_height','Height','natural_numbers'),
  ('binary_trees','right_spine','binary_trees_right_spine','Right spine length','natural_numbers'),
  ('binary_trees','no_right_child','binary_trees_no_right_child','Nodes with no right child','natural_numbers'),
  ('binary_trees','balance','binary_trees_balance','Root balance','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('binary_trees','to_dyck_path','binary_trees_to_dyck_path','dyck_paths','To Dyck path',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('binary_trees','the registry lists at least the known binary_tree stats (a floor — more may be added)','eq','true','base_stat rows',$q$
    SELECT (array_agg(stat_id) @> ARRAY['balance','height','leaves','left_spine','no_left_child','no_right_child','right_spine'])::text
    FROM base_stat WHERE collection = 'binary_trees' $q$),

  -- leaves ("100"): distribution over binary_trees(5) is 16,24,2 for 1,2,3 leaves; spot 1100100 has 2 leaves.
  ('binary_trees','number of leaves over binary_trees(5): 16 with 1 leaf, 24 with 2, 2 with 3','eq','16,24,2','distribution of "100" (two-empty-children nodes)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT binary_trees_leaves((e).value) k, count(*) c FROM elements(binary_trees(5)) e GROUP BY 1) t(k,c) $q$),
  ('binary_trees','leaves(1100100) = 2','eq','2','the two leaves are the (1,0,0) subtrees',$q$
    SELECT binary_trees_leaves(ROW(ARRAY[1,1,0,0,1,0,0])::binary_tree)::text $q$),

  -- no_left_child ("10"): Narayana N(4,k) = 1,6,6,1; ties out to the Dyck peak sum (=10) at n=3.
  ('binary_trees','nodes with no left child over binary_trees(4) is Narayana 1,6,6,1','eq','1,6,6,1','distribution of "10" (empty left subtree)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT binary_trees_no_left_child((e).value) k, count(*) c FROM elements(binary_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('binary_trees','Σ nodes-with-no-left-child over binary_trees(3) = 10 (= Dyck peak sum)','eq','10','equidistributed with Dyck peaks',$q$
    SELECT sum(binary_trees_no_left_child((e).value))::text FROM elements(binary_trees(3)) e $q$),

  -- left_spine (leading 1s): distribution over binary_trees(4); spot 1110000 has a 3-node left chain.
  ('binary_trees','left-spine length over binary_trees(4): 5,5,3,1 for lengths 1..4','eq','5,5,3,1','distribution of the leading run of 1s',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT binary_trees_left_spine((e).value) k, count(*) c FROM elements(binary_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('binary_trees','left_spine(1110000) = 3','eq','3','three nodes down the leftmost chain',$q$
    SELECT binary_trees_left_spine(ROW(ARRAY[1,1,1,0,0,0,0])::binary_tree)::text $q$),

  -- height (nodes on longest path): distribution over binary_trees(5); spots at n=2,3.
  ('binary_trees','height over binary_trees(5): 6,20,16 for heights 3,4,5','eq','6,20,16','longest root-to-node path (in nodes)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT binary_trees_height((e).value) k, count(*) c FROM elements(binary_trees(5)) e GROUP BY 1) t(k,c) $q$),
  ('binary_trees','height(11000) = 2, height(1101000) = 3','eq','2|3','left-leaning chains',$q$
    SELECT binary_trees_height(ROW(ARRAY[1,1,0,0,0])::binary_tree)::text || '|' ||
           binary_trees_height(ROW(ARRAY[1,1,0,1,0,0,0])::binary_tree)::text $q$),

  -- right_spine: mirror of left_spine — distribution over binary_trees(4) matches left_spine's by the
  -- left/right reflection symmetry; 1110000 is left-leaning so its right spine is trivial (root only).
  ('binary_trees','right-spine length over binary_trees(4): 5,5,3,1 for lengths 1..4 (mirrors left_spine)','eq','5,5,3,1','distribution of the rightmost root-to-leaf chain',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT binary_trees_right_spine((e).value) k, count(*) c FROM elements(binary_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('binary_trees','right_spine(1110000) = 1, right_spine(10100) = 2','eq','1|2','left-leaning tree has a trivial right spine; 10100 leans right',$q$
    SELECT binary_trees_right_spine(ROW(ARRAY[1,1,1,0,0,0,0])::binary_tree)::text || '|' ||
           binary_trees_right_spine(ROW(ARRAY[1,0,1,0,0])::binary_tree)::text $q$),

  -- no_right_child: mirror of no_left_child — same Narayana distribution over binary_trees(4).
  ('binary_trees','nodes with no right child over binary_trees(4) is Narayana 1,6,6,1 (mirrors no_left_child)','eq','1,6,6,1','distribution of "right child is a bare leaf"',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT binary_trees_no_right_child((e).value) k, count(*) c FROM elements(binary_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('binary_trees','no_right_child(1100100) = 2, no_right_child(1010100) = 1','eq','2|1','each internal node whose right child is a leaf',$q$
    SELECT binary_trees_no_right_child(ROW(ARRAY[1,1,0,0,1,0,0])::binary_tree)::text || '|' ||
           binary_trees_no_right_child(ROW(ARRAY[1,0,1,0,1,0,0])::binary_tree)::text $q$),

  -- balance: |left size − right size| at the root; over binary_trees(3), 1100100 is the unique perfectly
  -- balanced tree (0), the other four are maximally skewed (2).
  ('binary_trees','root balance over binary_trees(3): 1 tree balanced (0), 4 skewed (2)','eq','1,4','distribution of |left − right| internal-node counts',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT binary_trees_balance((e).value) k, count(*) c FROM elements(binary_trees(3)) e GROUP BY 1) t(k,c) $q$),
  ('binary_trees','balance(1100100) = 0 (perfectly balanced), balance(1110000) = 2 (fully skewed)','eq','0|2','root splits into equal vs maximally unequal subtrees',$q$
    SELECT binary_trees_balance(ROW(ARRAY[1,1,0,0,1,0,0])::binary_tree)::text || '|' ||
           binary_trees_balance(ROW(ARRAY[1,1,1,0,0,0,0])::binary_tree)::text $q$),

  -- map to_dyck_path: specific images + the whole-fiber bijection onto dyck_paths(3).
  ('binary_trees','to_dyck_path: 10100 ↦ UDUD, 11000 ↦ UUDD','eq','UDUD|UUDD','drop the last leaf, 1↦U 0↦D',$q$
    SELECT notation(binary_trees_to_dyck_path(ROW(ARRAY[1,0,1,0,0])::binary_tree)) || '|' ||
           notation(binary_trees_to_dyck_path(ROW(ARRAY[1,1,0,0,0])::binary_tree)) $q$),
  ('binary_trees','to_dyck_path maps binary_trees(3) bijectively onto the 5 Dyck paths of semilength 3','eq','UDUDUD,UDUUDD,UUDDUD,UUDUDD,UUUDDD','image multiset = all of dyck_paths(3)',$q$
    SELECT string_agg(notation(binary_trees_to_dyck_path((e).value)), ',' ORDER BY notation(binary_trees_to_dyck_path((e).value)))
      FROM elements(binary_trees(3)) e $q$),
  ('binary_trees','to_dyck_path image renders in the CODOMAIN form via render_value','eq','UUDD','render_value on a dyck_path image',$q$
    SELECT render_value(binary_trees_to_dyck_path(ROW(ARRAY[1,1,0,0,0])::binary_tree)) $q$);
