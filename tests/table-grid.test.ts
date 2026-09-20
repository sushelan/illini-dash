/**
 * "Forming a table", the part of it a parser needs.
 *
 * Every assertion here is about a table a browser would draw one way and
 * `row.children[n]` reads another. That gap is house rule 3's whole subject —
 * `cells[2]` turning one added column into a page of undated, mis-statused
 * items with no error, at a recorded cost of 14 items — so the arithmetic gets
 * its own file and its own mutations.
 */

import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  cellAt,
  columnOf,
  formTableGrid,
  gridFor,
  rowIndex,
  width,
  type GridCache,
} from "../src/core/table-grid.js";

const doc = (html: string) => parseHTML(html).document as unknown as Document;

/** The grid as a readable picture: one string per row, cell texts by slot. */
function picture(html: string): string[][] {
  const table = doc(html).querySelector("table")!;
  const grid = formTableGrid(table);
  return grid.cells.map((row) =>
    [...Array(width(grid)).keys()].map((slot) => {
      const cell = row[slot];
      return cell ? (cell.textContent ?? "").trim() : "·";
    }),
  );
}

describe("formTableGrid", () => {
  it("lays out a plain table as its children", () => {
    expect(
      picture(`<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>`),
    ).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("carries a rowspan into the next row", () => {
    // CS 424's spacer column, in miniature: the second row has two children and
    // three columns, so `children[1]` is the *third* column there and the
    // second one everywhere else.
    expect(
      picture(`<table>
        <tr><td rowspan="2">unit</td><td>9/16</td><td>HW1 Due</td></tr>
        <tr><td>9/23</td><td>HW2 Due</td></tr>
      </table>`),
    ).toEqual([
      ["unit", "9/16", "HW1 Due"],
      ["unit", "9/23", "HW2 Due"],
    ]);
  });

  it("shifts later columns past a colspan header", () => {
    expect(
      picture(`<table>
        <tr><th colspan="2">Week</th><th>Due Date</th></tr>
        <tr><td>1</td><td>Mon</td><td>09/04</td></tr>
      </table>`),
    ).toEqual([
      ["Week", "Week", "Due Date"],
      ["1", "Mon", "09/04"],
    ]);
  });

  it("runs a rowspan=0 to the end of its row group and no further", () => {
    // The spec's one genuinely surprising rule. Without it the cell occupies
    // one row and every row under it slides left by one.
    expect(
      picture(`<table>
        <tbody><tr><td rowspan="0">all</td><td>a</td></tr><tr><td>b</td></tr><tr><td>c</td></tr></tbody>
        <tbody><tr><td>x</td><td>y</td></tr></tbody>
      </table>`),
    ).toEqual([
      ["all", "a"],
      ["all", "b"],
      ["all", "c"],
      ["x", "y"],
    ]);
  });

  it("treats a bad span as 1 rather than as NaN or 0", () => {
    /*
     * House rule 5 in its `Number("")` form. `Number(getAttribute("colspan"))`
     * is 0 for a missing attribute and NaN for "two", and either silently
     * collapses the row — every column after it reads one cell to the left.
     */
    expect(
      picture(`<table>
        <tr><td colspan="two">a</td><td colspan="">b</td><td colspan="-3">c</td><td rowspan="1.5">d</td></tr>
        <tr><td>w</td><td>x</td><td>y</td><td>z</td></tr>
      </table>`),
    ).toEqual([
      ["a", "b", "c", "d"],
      ["w", "x", "y", "z"],
    ]);
  });

  it("clamps colspan=0 to one column, as HTML does", () => {
    expect(
      picture(`<table><tr><td colspan="0">a</td><td>b</td></tr></table>`),
    ).toEqual([["a", "b"]]);
  });

  it("pushes a cell right past a slot a rowspan already holds", () => {
    // Not an overlap: the cell moves, which is what a browser draws. The test
    // below is the overlap, where it cannot move.
    expect(
      picture(`<table>
        <tr><td rowspan="3">first</td><td>a</td></tr>
        <tr><td rowspan="2">second</td></tr>
        <tr><td>c</td></tr>
      </table>`),
    ).toEqual([
      ["first", "a", "·"],
      ["first", "second", "·"],
      ["first", "second", "c"],
    ]);
  });

  it("gives an overlapped slot to the first cell in document order", () => {
    /*
     * A colspan reaching into a slot a rowspan already holds is a broken table
     * whatever you do, and a browser resolves it in document order. A "last
     * wins" rule would put "c" in slot 1 here — and would make the grid depend
     * on how far down the page you had read, which is the kind of answer that
     * changes under an unrelated edit.
     */
    expect(
      picture(`<table>
        <tr><td>a</td><td rowspan="2">b</td></tr>
        <tr><td colspan="2">c</td></tr>
      </table>`),
    ).toEqual([
      ["a", "b"],
      ["c", "b"],
    ]);
  });

  it("clamps a rowspan that runs past the table", () => {
    // Otherwise the grid grows rows no `<tr>` corresponds to, and `cellAt`
    // would answer for rows that are not on the page.
    const table = doc(
      `<table><tr><td rowspan="99">a</td><td>b</td></tr><tr><td>c</td></tr></table>`,
    ).querySelector("table")!;
    expect(formTableGrid(table).cells).toHaveLength(2);
  });

  it("answers undefined past the end of a short row", () => {
    const table = doc(
      `<table><tr><td>a</td><td>b</td><td>c</td></tr><tr><td>d</td></tr></table>`,
    ).querySelector("table")!;
    const grid = formTableGrid(table);
    const rows = [...table.querySelectorAll("tr")];
    expect(cellAt(grid, rows[1]!, 0)!.textContent).toBe("d");
    expect(cellAt(grid, rows[1]!, 1)).toBeUndefined();
    expect(cellAt(grid, rows[1]!, 9)).toBeUndefined();
    expect(width(grid)).toBe(3);
  });

  it("does not fold a nested table's cells into the outer row", () => {
    /*
     * DELIBERATELY UNREALISTIC (parser rule 10): no captured course page nests
     * a table inside a date column, and with a realistic one a `querySelectorAll`
     * reading and a direct-children reading are indistinguishable. Written this
     * way because the difference is catastrophic and invisible — the inner
     * cells would land in the outer row's slots and push the real date column
     * three places right, on that row only.
     */
    const html = `<table>
      <tr><td>9/16</td><td><table><tr><td>x</td><td>y</td><td>z</td></tr></table></td><td>HW1 Due</td></tr>
    </table>`;
    expect(picture(html)).toEqual([["9/16", "xyz", "HW1 Due"]]);

    // And the inner table has a grid of its own, not shared with the outer one.
    const outer = doc(html).querySelector("table")!;
    const inner = outer.querySelector("table")!;
    expect(width(formTableGrid(inner))).toBe(3);
  });

  it("does not fold a nested table's rows into the outer grid either", () => {
    const outer = doc(
      `<table><tr><td><table><tr><td>x</td></tr><tr><td>y</td></tr></table></td></tr></table>`,
    ).querySelector("table")!;
    // One outer `<tr>`, whatever `querySelectorAll("tr")` would have said.
    expect(formTableGrid(outer).cells).toHaveLength(1);
  });

  it("does not fold them in through a <tbody> either", () => {
    /*
     * The same rule on the other branch of `rowGroups`, and the one a mutation
     * found unpinned: the test above uses bare `<tr>` children, so it never
     * reaches the `<thead>`/`<tbody>`/`<tfoot>` path — where a
     * `querySelectorAll("tr")` would pull the inner table's rows into the outer
     * group and give the outer table three grid rows for one `<tr>`, pushing
     * every later row's index down by two.
     */
    const outer = doc(`<table><tbody>
      <tr><td>9/16</td><td><table><tr><td>x</td></tr><tr><td>y</td></tr></table></td></tr>
    </tbody></table>`).querySelector("table")!;
    const grid = formTableGrid(outer);
    expect(grid.cells).toHaveLength(1);
    expect(rowIndex(grid, outer.querySelector("tbody > tr")!)).toBe(0);
  });

  it("knows which grid row a <tr> is, and which slot a cell starts at", () => {
    const table = doc(`<table>
      <tr><td rowspan="2">unit</td><td>a</td><td>b</td></tr>
      <tr><td>c</td><td>d</td></tr>
    </table>`).querySelector("table")!;
    const grid = formTableGrid(table);
    const rows = [...table.querySelectorAll("tr")];
    expect(rowIndex(grid, rows[0]!)).toBe(0);
    expect(rowIndex(grid, rows[1]!)).toBe(1);
    expect(rowIndex(grid, table)).toBeUndefined();
    expect(columnOf(grid, rows[1]!.children[0]!)).toBe(1);
    expect(columnOf(grid, rows[0]!.children[0]!)).toBe(0);
  });

  it("answers an empty grid for a table with no rows", () => {
    const table = doc(`<table></table>`).querySelector("table")!;
    const grid = formTableGrid(table);
    expect(grid.cells).toEqual([]);
    expect(width(grid)).toBe(0);
  });
});

describe("gridFor", () => {
  it("builds one grid per table and reuses it", () => {
    const table = doc(`<table><tr><td>a</td></tr><tr><td>b</td></tr></table>`).querySelector(
      "table",
    )!;
    const rows = [...table.querySelectorAll("tr")];
    const cache: GridCache = new Map();
    const first = gridFor(rows[0]!, cache);
    const second = gridFor(rows[1]!, cache);
    // Identity, not equality: `formTableGrid` walks every cell of the table,
    // and the runner calls this several times per row.
    expect(second).toBe(first);
    expect(cache.size).toBe(1);
  });

  it("has nothing to say about an element outside a table", () => {
    const li = doc(`<ul><li>x</li></ul>`).querySelector("li")!;
    expect(gridFor(li, new Map())).toBeUndefined();
  });

  it("gives a nested table's row the inner grid, not the outer one", () => {
    const outer = doc(
      `<table><tr><td>a</td><td><table><tr><td>x</td><td>y</td></tr></table></td></tr></table>`,
    ).querySelector("table")!;
    const innerRow = outer.querySelector("table tr")!;
    const cache: GridCache = new Map();
    expect(width(gridFor(innerRow, cache)!)).toBe(2);
  });
});
