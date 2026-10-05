// A notebook as a Jupyter notebook (nbformat 4.5), for a reader to save and open elsewhere.
// There's no Jupyter kernel for Epsil, so the file is for reading. Code cells with `text/latex`
// answers render as a notebook (In/Out, typeset answers) on GitHub as well as in Jupyter and
// VS Code; GitHub's view of Markdown cells prints a code fence's language as a line of code.

/** A cell's answer, in the forms a notebook file can carry. */
export interface IpynbOutput {
  /** StandardForm TeX. */
  readonly latex: string;
  /** InputForm: Epsil you could type back in, and the plain-text fallback. */
  readonly inputform?: string;
  readonly asciimath?: string;
}

export interface IpynbCell {
  readonly source: string;
  /** The source's syntax: `epsil` or `latex`. */
  readonly format: string;
  readonly output?: IpynbOutput;
}

export interface IpynbOptions {
  /** A heading for the notebook's first cell. */
  readonly title?: string;
}

/** nbformat stores text as a list of lines, each but the last ending in its newline. */
const lines = (text: string): string[] =>
  text.split("\n").map((line, i, all) => (i < all.length - 1 ? `${line}\n` : line));

const plain = (output: IpynbOutput): string => output.inputform || output.asciimath || output.latex;

function codeCell(cell: IpynbCell, n: number): Record<string, unknown> {
  const outputs =
    cell.output === undefined || cell.output.latex === ""
      ? []
      : [
          {
            output_type: "execute_result",
            execution_count: n,
            data: {
              "text/latex": lines(`$\\displaystyle ${cell.output.latex}$`),
              "text/plain": lines(plain(cell.output)),
            },
            metadata: {},
          },
        ];
  return {
    cell_type: "code",
    id: `cell-${n}`,
    execution_count: outputs.length > 0 ? n : null,
    metadata: { notatio: { format: cell.format } },
    source: lines(cell.source),
    outputs,
  };
}

/** `cells` as a Jupyter notebook: the JSON object an `.ipynb` file holds. */
export function toIpynb(cells: readonly IpynbCell[], options: IpynbOptions = {}): Record<string, unknown> {
  const body = cells.filter((cell) => cell.source.trim() !== "").map((cell, i) => codeCell(cell, i + 1));
  const title =
    options.title === undefined
      ? []
      : [{ cell_type: "markdown", id: "title", metadata: {}, source: lines(`# ${options.title}`) }];
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { name: "epsil", display_name: "Epsil (notatio)", language: "epsil" },
      language_info: { name: "epsil", file_extension: ".epsil" },
    },
    cells: [...title, ...body],
  };
}
