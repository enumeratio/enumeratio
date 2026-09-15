import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import {
  dendrogramSvg,
  graphPlotSvg,
  layeredGraphPlotSvg,
  treePlotSvg,
  type GraphData,
  type TreeNode,
} from "./graph.ts";
import { ensureStyles } from "./styles.ts";

export type GraphType = "tree" | "graph" | "layered" | "dendrogram";

/** Parse a JSON attribute defensively -- an empty/invalid value reads as `undefined`. */
function parseJson(value: string): unknown {
  const text = value.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isId = (v: unknown): v is string | number => typeof v === "string" || typeof v === "number";

/**
 * Coerce raw JSON into a `TreeNode`: `{ label?, height?, children? }`, recursively.
 * A non-object (or an object whose `children` isn't a list) still reads as a
 * valid (possibly childless) node rather than throwing.
 */
function toTree(data: unknown): TreeNode | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const obj = data as Record<string, unknown>;
  const node: TreeNode = {};
  if (typeof obj.label === "string") node.label = obj.label;
  if (typeof obj.height === "number" && Number.isFinite(obj.height)) node.height = obj.height;
  if (Array.isArray(obj.children)) {
    const kids = obj.children.map(toTree).filter((k): k is TreeNode => k !== undefined);
    if (kids.length > 0) node.children = kids;
  }
  return node;
}

/**
 * Coerce raw JSON into `GraphData`: `{ nodes?: [...], edges: [[a,b], ...] }`.
 * Node ids (numbers or strings) are normalized to strings; malformed edges are
 * dropped rather than throwing.
 */
function toGraph(data: unknown): GraphData | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const obj = data as Record<string, unknown>;
  const nodes = Array.isArray(obj.nodes) ? obj.nodes.filter(isId).map(String) : undefined;
  const rawEdges = Array.isArray(obj.edges) ? obj.edges : [];
  const edges = rawEdges
    .filter(
      (e): e is [string | number, string | number] =>
        Array.isArray(e) && e.length === 2 && isId(e[0]) && isId(e[1]),
    )
    .map(([a, b]): [string, string] => [String(a), String(b)]);
  return { nodes, edges };
}

/**
 * `<notatio-graphplot type="tree" data='{"label":"a","children":[...]}'>` -- graph
 * and hierarchical layouts, one element covering several Wolfram forms via
 * `type` (Data Visualization guide):
 *
 * - `tree` -- TreePlot: a rooted tree from nested `{ label?, children }`,
 *   laid out tidily by depth (parent x = mean of children x).
 * - `dendrogram` -- Dendrogram: same nested shape, but merges draw at
 *   `height` (inferred as `1 + max(child height)` when omitted).
 * - `graph` -- GraphPlot: `{ nodes?, edges }`; nodes are inferred from edges
 *   when omitted. A deterministic circular layout (no randomness). The
 *   `directed` attribute draws arrowheads.
 * - `layered` -- LayeredGraphPlot: same shape as `graph`, laid out
 *   top-to-bottom by longest-path layer (always directed).
 *
 * `data` is JSON, parsed defensively -- an empty/invalid value renders an
 * empty placeholder frame rather than throwing. `label` is a title.
 */
export class NotatioGraphPlot extends LitElement {
  static properties = {
    /** Which layout: `tree`, `dendrogram`, `graph` or `layered`. */
    type: { type: String, reflect: true },
    /** The structure, as JSON — `{nodes, edges}` for a graph, a nested node for a tree. */
    data: { type: String },
    /** Draw edges as arrows. */
    directed: { type: Boolean, reflect: true },
    /** Caption drawn above the figure. */
    label: { type: String },
  };

  declare type: GraphType;
  declare data: string;
  declare directed: boolean;
  declare label: string;

  constructor() {
    super();
    this.type = "tree";
    this.data = "";
    this.directed = false;
    this.label = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override shouldUpdate(changed: PropertyValues): boolean {
    return (
      changed.has("type") || changed.has("data") || changed.has("directed") || changed.has("label")
    );
  }

  #markup(): string {
    const data = parseJson(this.data);
    const title = this.label || undefined;
    switch (this.type) {
      case "tree":
        return treePlotSvg(toTree(data), { title });
      case "dendrogram":
        return dendrogramSvg(toTree(data), { title });
      case "graph":
        return graphPlotSvg(toGraph(data), { title, directed: this.directed });
      case "layered":
        return layeredGraphPlotSvg(toGraph(data), { title });
      default:
        return "";
    }
  }

  protected override render(): unknown {
    return html`<span class="notatio-graphplot-box">${unsafeHTML(this.#markup())}</span>`;
  }
}

if (!customElements.get("notatio-graphplot")) {
  customElements.define("notatio-graphplot", NotatioGraphPlot);
}
