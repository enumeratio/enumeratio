// The web's boxes are their own tags (`row-box`), and a TableViewBox is the one that behaves.

import { grid, pane, row, tableView, text } from "@enumeratio/boxes";
import { expect, test } from "vite-plus/test";
import { renderBox } from "../src/box-render.ts";
import { renderingOf } from "../src/symbols.ts";
import { rowSourceExpression } from "../src/row-spec.ts";

test("layout boxes are drawn as their own tags", () => {
  const drawn = renderBox(row([text("a"), grid([[text("b"), text("c")]]), pane(text("d"), { Scrollbars: true })]));
  expect(drawn.tag).toBe("row-box");
  expect(drawn.children?.map((c) => c.tag)).toEqual(["span", "grid-box", "pane-box"]);
});

test("a TableViewBox is its element: the source as written, the headers known, the size fixed", () => {
  const source = rowSourceExpression({ collection: { str: "SymmetricGroup(25)" } as never, columns: ["Descents"] });
  const drawn = renderBox(
    tableView(source, {
      ImageSize: [480, 320],
      TableViewBoxHeaders: ["element", "Descents"],
      ScrollPosition: 40,
      MaxItems: 20,
      Pagination: true,
    }),
  );
  expect(drawn.tag).toBe("table-view-box");
  expect(JSON.parse(drawn.attributes.source!)).toEqual(source);
  expect(drawn.attributes).toMatchObject({
    headers: '["element","Descents"]',
    "scroll-position": "40",
    "max-items": "20",
    pagination: "",
    style: "width: 480px; height: 320px",
  });
});

test("a collection table's collection keeps the name it is declared under, so a reader can retype it", () => {
  const drawn = renderingOf(["CollectionTable", "NonNegativeIntegers"] as never);
  expect(drawn?.attributes.expr).toBe("NonNegativeIntegers");
});
