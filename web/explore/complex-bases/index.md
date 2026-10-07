# Complex Bases

Numbers written in a base $\beta$ from the Gaussian or Eisenstein integers, every numeral of at
most $L$ places one tile. Drag the base $\beta$ or a digit, ⌥-click to add or remove a digit, switch
the lattice, take the base off the lattice altogether, roll a random system, or pick a notable
system or a favorite from the caption's menu. The
[guide](/docs/complex-numerals/complex-bases) explains why one digit per residue class makes
every numeral a different point.

<Labeled Variables='[
    _e -> Variable(ComplexBases, "gosper-island"),
    _r -> [Labeled(GaussianIntegers, "ℤ[i]"), Labeled(EisensteinIntegers, "ℤ[ω]")],
    _b -> Variable(_r, (-1, 1)),
    _ds -> Variable(_r, [(1, 0)]),
    _L -> Variable(Integers, 8, Range -> [1, 14]),
    _k -> [Labeled(True, "on the lattice"), Labeled(False, "anywhere in the plane")],
    _s -> Variable(Automatic, [])]'>
<Show Selection="_s" ImageSize="[Automatic, 600]">
<LatticeTiles
      ColorRules='[True -> ColorData("Turbo")(Address), Congruent(Selected) -> Opacity(0.45, White)]'
      ColorMixing='"Screen"'
      BoundaryStyle="[IsDigit -> White, Overlaps -> Directive(Red, AbsoluteThickness(1.5)), Selected -> Directive(White, AbsoluteThickness(2.5))]"
    >
<RadixExpansions Example="_e" OnLattice="_k">_r _b _ds _L</RadixExpansions>
</LatticeTiles>
<Locator Appearance='"β"'>_b</Locator>
<Locator LocatorAutoCreate>_ds</Locator>
</Show>
<StringTemplate>Base $\beta$ = {_b | random} on {_r}, digits 0, {_ds}, kept {_k} ({Setter(_k, True, "snap back to the lattice")}): every numeral of at most {_L} places, colored by where its digits put it: {_e}. Selecting a tile lights every numeral with the same last digit. Start from {Setter(_e, "twindragon", "the twindragon")}, {Setter(_e, "katai-szabo", "base −2 + i")}, {Setter(_e, "quater-imaginary", "the quater-imaginary base")} or {Setter(_e, "Random", "a random one")}. Copy the settings to keep a system, or paste some in: {InputField(Variables)}</StringTemplate>
<Bottom/>
</Labeled>

The favorites in the menu were sent by viewers of
[TheGrayCuber's imaginary-bases page](https://thegraycuber.com/imaginary_bases/), which this
exploration follows; each is credited as submitted there.
