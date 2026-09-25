# Notebook

The notebook is the other kind of sheet: a **transcript**. Where a
[worksheet](/worksheet/) is a set of definitions recomputed whenever one changes, a
notebook is a record of what you asked and what came back, in order — `In[n]` and
`Out[n]`, prose and headings between them, and results you can refer back to by number.
It is the Wolfram and Jupyter shape, for working something out and leaving the working.

|                   | worksheet                         | notebook                           |
| ----------------- | --------------------------------- | ---------------------------------- |
| a cell is         | a definition                      | something you asked                |
| order means       | nothing — cells run by dependency | time                               |
| refer to a result | by name                           | by name, or `Out(n)`               |
| saved as          | its definitions                   | its inputs _and_ what they gave    |
| good for          | turning a thing over by hand      | working it out, and keeping a copy |

::: info Not built yet
The notebook element is still to come; so is saving either kind in your browser. The
transcript itself already exists — below is the [REPL](/docs/cli/repl), the real
evaluation core, keeping its history the way the notebook will.
:::

<notatio-terminal></notatio-terminal>

Try `Binomial(10, 3)`, then `Out(1) + 1`, then `In(1)`.
