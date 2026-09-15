# Output

`<notatio-out>` — read-only typeset rendering of a compute-engine expression.
Accepts LaTeX (the default — it renders an encoding it is handed, and a cell hands it
the editor's LaTeX), MathJSON or notatio, optionally evaluates first, and offers the
textual **display forms** through its In/Out menu (hover the label). compute-engine
loads only when MathJSON or notatio, evaluation, or an assertion is requested.

<Story
  title="Evaluated LaTeX">
<notatio-out value="\sqrt{16}+2^3" format="latex" evaluate />
</Story>

<Story
  title="MathJSON input">
<notatio-out value='["Add", ["Power", "x", 2], 1]' format="mathjson" />
</Story>

<Story
  title="notatio input">
<notatio-out value="Sqrt(16) + 2^3" format="notatio" evaluate />
<notatio-out value="Binomial(n, k) + $\frac{1}{2}$" format="notatio" />
</Story>

<Story
  title="Display forms (hover the label)">
<template #description>
The In/Out label shows the current form and opens a menu of forms —
StandardForm, TraditionalForm, MatrixForm, TreeForm, FullForm, TeXForm, WolframFullForm,
PythonForm, GPUShaderForm — plus copy. The source-shaped forms (Full/TeX/Wolfram/Python) render
in a <code>&lt;notatio-code&gt;</code> box.
</template>
<notatio-out value="\binom{n}{k}" label="Out" />
</Story>

<Story
  title="TreeForm (raw)">
<template #description>
The expression as a tree of heads, opened one level at a time — the way to read a
definition down to the heads it bottoms out in. A closed node shows its arguments as
one line of InputForm. <code>raw</code> boxes without canonicalising, so the tree is
the expression as authored (<code>Subtract</code> stays a <code>Subtract</code>,
<code>Greater</code> is not flipped into a <code>Less</code>); drop it, or evaluate,
and the tree is the canonical form. Given a <code>resolveHead</code> property (a
reference page supplies one from its entries) heads link to their pages, a head with
a reference definition can be unfolded in place with <code>≝</code>, and a head on
the primitive frontier carries its reason.
</template>
<notatio-out value='["Sum",["Filter",["Range",1,["Subtract",["Length","p"],1]],["Function",["Greater",["At","p","i"],["At","p",["Add","i",1]]],"i"]]]' format="mathjson" form="tree" raw label="Def" />
</Story>

<Story
  title="GPUShaderForm">
<template #description>
The whole shader a GPU path here would run: a real expression in one or two unknowns
gives the plot grid's compute shader; a single unknown that emits as a complex expression
gives the phase portrait's fragment shader instead (try <code>\zeta(s)</code>).
</template>
<notatio-out value="\sin(x) + y^2" form="gpushader" label="Out" />
</Story>

<Story
  title="MatrixForm (hover the label, pick MatrixForm)">
<template #description>
A list of lists renders as an actual bracketed matrix (via compute-engine's
<code>Matrix</code> head, under the hood in TeX). Pick TeXForm to read the
underlying <code>\begin{pmatrix}…</code> string.
</template>
<notatio-out value='["List",["List",1,2],["List",3,4]]' format="mathjson" label="Out" />
</Story>

<Story
  title="WolframFullForm">
<template #description>
The expression transpiled to Wolfram Language full form (<code>Binomial[n, k]</code>)
via <code>@enumeratio/wolfram</code> — the same serializer the reference
validation loop uses. Shown in a <code>&lt;notatio-code&gt;</code> box.
</template>
<notatio-out value='["Binomial","n","k"]' format="mathjson" form="wolfram" label="Out" />
</Story>

<Story
  title="PythonForm (NumPy)">
<template #description>
compute-engine's Python target emits NumPy source (<code>x ** 2 + np.sin(x)</code>).
Non-numeric results (lists, comparisons) have no NumPy form.
</template>
<notatio-out value='["Add",["Sin","x"],["Power","x",2]]' format="mathjson" form="python" label="Out" />
</Story>

<Story
  title="Snapshot assertion">
<template #description>
Set <code>expect</code> to a MathJSON value: the evaluated result is compared
live and a mismatch or error shows inline. This one passes (silent); change
the expectation to see the diagnostic.
</template>
<notatio-out value='["Add",2,2]' format="mathjson" evaluate expect="4" />
</Story>
