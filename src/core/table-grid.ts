/**
 * "Forming a table" — the WHATWG algorithm, as much of it as a parser needs.
 *
 * A `<tr>`'s children are not its columns. `rowspan` on a cell in an earlier row
 * occupies a slot in this one, and `colspan` on a header occupies several, so
 * `cells[2]` is a different column on every row of a table that uses either.
 * House rule 3's cost is recorded as 14 items, and both of the shipped tables
 * that need this are real:
 *
 * - **CS 424's schedule has no header row at all** (its first row is seven
 *   `<td>`s, not `<th>`s) and uses a `rowspan` spacer column to draw unit
 *   headings down the left. Rows carry 7, 6, 5, 4 or 1 children depending on
 *   whether they open a unit block, so `nth-child` is wrong on most of them and
 *   `nth-last-child` is wrong on the rest.
 * - **A `<th colspan="2">` shifts every later column**, so even a table that
 *   *has* headers cannot map a header's position to a cell's position by
 *   counting children.
 *
 * This is the only positional addressing in the project, and it is paired with
 * a loud hit-rate check in `site.ts` for that reason: a slot is a guess about
 * layout, and a wrong one fails silently in exactly the way house rule 3
 * describes.
 */

/** A table laid out as a grid: `cells[row][slot]`, padded to a constant width. */
export interface TableGrid {
  /** One entry per grid row. `undefined` where no cell covers the slot. */
  cells: (Element | undefined)[][];
  /** The grid row a given `<tr>` occupies. */
  index: Map<Element, number>;
  /** The leftmost slot a given cell occupies. */
  slotOf: Map<Element, number>;
}

/** Grids are built once per table and reused across every row of it. */
export type GridCache = Map<Element, TableGrid>;

/** How many slots wide the grid is. Every row is padded to this. */
export function width(grid: TableGrid): number {
  return grid.cells[0]?.length ?? 0;
}

/** The cell covering `slot` on `row`'s grid row, or undefined. */
export function cellAt(grid: TableGrid, row: Element, slot: number): Element | undefined {
  const y = grid.index.get(row);
  return y === undefined ? undefined : grid.cells[y]?.[slot];
}

/** The grid row `row` occupies, or undefined when it is not this table's. */
export function rowIndex(grid: TableGrid, row: Element): number | undefined {
  return grid.index.get(row);
}

/** The leftmost slot `cell` occupies, or undefined when it is not this table's. */
export function columnOf(grid: TableGrid, cell: Element): number | undefined {
  return grid.slotOf.get(cell);
}

/** The grid for the table this row is in, built once and cached. */
export function gridFor(row: Element, cache: GridCache): TableGrid | undefined {
  const table = row.closest("table");
  if (!table) return undefined;
  const cached = cache.get(table);
  if (cached) return cached;
  const grid = formTableGrid(table);
  cache.set(table, grid);
  return grid;
}

/**
 * A span attribute, validated positively.
 *
 * House rule 5, in its `Number("")` form: `Number(cell.getAttribute("colspan"))`
 * is `0` for a missing attribute, `0` for `""` and `NaN` for `"two"`, and each
 * of those silently collapses or explodes the row. Anchored digits only;
 * anything else is the HTML default of 1.
 *
 * The anchoring is load-bearing rather than tidy: a **negative** colspan walks
 * the cursor backwards into slots the `while` below has already skipped, and
 * the two never converge — `formTableGrid` does not return. Remote pages are
 * not the only hostile input here; a course page with `colspan="-1"` in it
 * would hang the service worker's sync. Mutating this line to accept `-?\d+`
 * does not fail the suite, it stops it.
 *
 * `colspan="0"` is not a thing (HTML clamps it to 1). `rowspan="0"` *is*: it
 * means "to the end of this row group", and the caller resolves it because only
 * the caller knows where the group ends.
 */
function spanValue(raw: string | null, max: number): number | undefined {
  if (raw === null) return 1;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return 1;
  const value = Number(trimmed);
  if (value === 0) return undefined; // "0", for the caller to resolve
  return Math.min(value, max);
}

/** `<td>` and `<th>` children of a row — never a nested table's cells. */
function directCells(row: Element): Element[] {
  return [...row.children].filter(
    (child) => child.tagName === "TD" || child.tagName === "TH",
  );
}

/**
 * The table's rows, grouped.
 *
 * Direct children only, at both levels: a `<table>` inside a `<td>` has its own
 * `<tr>`s as *descendants* of this one, and `querySelectorAll("tr")` would fold
 * them into the outer grid — shifting every slot below them. Groups matter only
 * because `rowspan="0"` runs to the end of one.
 */
function rowGroups(table: Element): Element[][] {
  const groups: Element[][] = [];
  let implicit: Element[] | undefined;
  for (const child of [...table.children]) {
    const tag = child.tagName;
    if (tag === "TR") {
      if (!implicit) {
        implicit = [];
        groups.push(implicit);
      }
      implicit.push(child);
      continue;
    }
    if (tag === "THEAD" || tag === "TBODY" || tag === "TFOOT") {
      // A section ends the run of bare `<tr>`s around it, which is what makes
      // `rowspan="0"` in a `<tbody>` stop at that `<tbody>`'s last row.
      implicit = undefined;
      groups.push([...child.children].filter((row) => row.tagName === "TR"));
    }
  }
  return groups;
}

/** HTML's own ceilings, so a hostile page cannot ask for a 10-million-cell grid. */
const MAX_COLSPAN = 1000;
const MAX_ROWSPAN = 65534;

/** Lays a table out as a grid of slots. */
export function formTableGrid(table: Element): TableGrid {
  const groups = rowGroups(table);
  const total = groups.reduce((sum, group) => sum + group.length, 0);
  const cells: (Element | undefined)[][] = Array.from({ length: total }, () => []);
  const index = new Map<Element, number>();
  const slotOf = new Map<Element, number>();

  let y = 0;
  for (const group of groups) {
    const groupStart = y;
    for (const row of group) {
      index.set(row, y);
      let x = 0;
      for (const cell of directCells(row)) {
        // Skip whatever an earlier row's rowspan already put here. The `while`
        // is the reason a rowspan does not just overwrite: the cell moves right
        // instead, which is what a browser draws.
        while (cells[y]![x] !== undefined) x += 1;

        const colspan = spanValue(cell.getAttribute("colspan"), MAX_COLSPAN) ?? 1;
        const declared = spanValue(cell.getAttribute("rowspan"), MAX_ROWSPAN);
        // `rowspan="0"` runs to the end of the row group; anything else is
        // clamped to the table so a cell cannot create rows that have no `<tr>`.
        const toGroupEnd = groupStart + group.length - y;
        const rowspan = Math.min(declared ?? toGroupEnd, total - y);

        slotOf.set(cell, x);
        for (let dy = 0; dy < rowspan; dy += 1) {
          const target = cells[y + dy]!;
          for (let dx = 0; dx < colspan; dx += 1) {
            // First cell keeps the slot. Two overlapping rowspans are a broken
            // table either way, and document order is what a browser resolves
            // it by — a "last wins" rule would make the grid depend on how far
            // down the page you had read.
            if (target[x + dx] === undefined) target[x + dx] = cell;
          }
        }
        /*
         * Unreachable by mutation today, and it stays (mutation house rule 2).
         *
         * `x += 1` passes every test, because the `while` above re-establishes
         * the same cursor: the slots this cell just wrote are occupied, so the
         * next cell skips them anyway. The two mechanisms answer different
         * questions — that one skips a *previous row's* rowspan, this one
         * states how wide *this* cell is — and no input separates them, since
         * a placed cell's slots are occupied by construction. Written the way
         * the WHATWG algorithm writes it rather than left to an invariant a
         * reader would have to derive.
         */
        x += colspan;
      }
      y += 1;
    }
  }

  // One width for the whole grid, so `cellAt` on a short row answers undefined
  // rather than reading past the end of an array of a different length.
  const widest = cells.reduce((most, row) => Math.max(most, row.length), 0);
  for (const row of cells) row.length = widest;

  return { cells, index, slotOf };
}
