-- requires: rational_numbers, calkin_wilf_paths, stern_brocot_paths, realizer
-- The two binary-word trees walk ALL of ℚ⁺ (not just [0,1] — Calkin-Wilf/Stern-Brocot include values > 1, so the
-- natural codomain is rational_numbers, not the [0,1]-restricted farey_sequences): each length-n path lands on one
-- positive rational, already in lowest terms — a bijection into rational_number's carrier.
CREATE FUNCTION calkin_wilf_to_rational_number(w binary_word) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT rational_number(f[1]::int, f[2]::int) FROM calkin_wilf_fraction((w).bits) f) $$;
CREATE FUNCTION stern_brocot_to_rational_number(w binary_word) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT rational_number(f[1]::int, f[2]::int) FROM stern_brocot_fraction((w).bits) f) $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('calkin_wilf_paths', 'rational_number', 'calkin_wilf_to_rational_number', 'rational_numbers', 'To rational number', NULL),
  ('stern_brocot_paths', 'rational_number', 'stern_brocot_to_rational_number', 'rational_numbers', 'To rational number', NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('farey_sequences','calkin_wilf_paths(2) images are all reduced, positive rationals (∈ rational_numbers)','eq','true','every path lands in ℚ⁺, in lowest terms',$q$
    SELECT bool_and(calkin_wilf_to_rational_number((e).value) <@ rational_numbers()) FROM elements(calkin_wilf_paths(2)) e $q$),
  ('farey_sequences','calkin_wilf and stern_brocot paths of length 2 reach the same SET of rationals','eq','true','same tree vertices, different descent/order',$q$
    SELECT (
      (SELECT array_agg(notation(calkin_wilf_to_rational_number((e).value)) ORDER BY notation(calkin_wilf_to_rational_number((e).value))) FROM elements(calkin_wilf_paths(2)) e)
      = (SELECT array_agg(notation(stern_brocot_to_rational_number((e).value)) ORDER BY notation(stern_brocot_to_rational_number((e).value))) FROM elements(stern_brocot_paths(2)) e)
    )::text $q$),
  ('farey_sequences','the two [0,1] images at n=2 (1/3, 2/3) are also valid farey_sequences(3) members','eq','true','the fragment that DOES land in [0,1] respects the Farey invariant',$q$
    SELECT bool_and(contains_in_fiber(ROW(3)::farey_sequences_fiber, calkin_wilf_to_rational_number((e).value)))
      FROM elements(calkin_wilf_paths(2)) e
     WHERE (calkin_wilf_to_rational_number((e).value)).numerator <= (calkin_wilf_to_rational_number((e).value)).denominator $q$);
