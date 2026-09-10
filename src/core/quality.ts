/**
 * What the parsers could not read (§0 rule 3, §11).
 *
 * House rule 1 says a bad *value* costs its own field rather than the page, so
 * `parseField` keeps the row and records the unreadable text in
 * `extra.unparsed*`. That half works. The other half never existed: nothing
 * read those keys, and `sectionFor` drops any row without an instant — so a row
 * kept precisely so it would not be lost was then shown nowhere at all.
 *
 * The failure that produces is the one §11 calls catastrophic. Gradescope
 * changes its `datetime` format for one row type, `parseField` dutifully files
 * the raw text under `unparsedDueDate`, the source reports `ok` with a green
 * dot because every other row parsed, and the student's list is quietly missing
 * a deadline. Nothing anywhere says so.
 */

import type { Item, RawItem } from "../sources/types.js";

/**
 * Flags that mean a *date* could not be read, so the row may have no instant.
 *
 * These are the ones that can hide a deadline. Matched exactly, never by
 * prefix: house rule 6, and `unparsedDate` is a prefix of `unparsedDateRange`.
 */
const DATE_FLAGS: Record<string, string> = {
  unparsedDueDate: "due date",
  unparsedDate: "date",
  unparsedLateDate: "late due date",
  unparsedDateRange: "reservation window",
  unparsedSchedule: "credit schedule",
  unparsedCredit: "credit",
};

/** Flags worth showing but which do not cost the row its deadline. */
const SOFT_FLAGS: Record<string, string> = {
  unparsedReleaseDate: "release date",
  unparsedTime: "time of day",
  creditMismatch: "credit cell disagrees with the schedule",
  unknownStatus: "submission status",
  idFallback: "assignment id",
};

export interface QualityFlag {
  /** The `extra` key, e.g. `unparsedDueDate`. */
  key: string;
  /** Which source's row it came from. */
  source: RawItem["source"];
  /** Plain-language name of the field. */
  field: string;
  /** The unreadable text, where the parser kept it. */
  detail?: string;
  /** True when this flag can cost the row its place in the list. */
  blocksDate: boolean;
}

/** Everything any member of this item failed to read. */
export function qualityFlags(item: Item): QualityFlag[] {
  const flags: QualityFlag[] = [];
  for (const member of item.members) {
    const extra = member.extra;
    if (!extra) continue;
    for (const [key, value] of Object.entries(extra)) {
      const dateField = DATE_FLAGS[key];
      if (dateField !== undefined) {
        flags.push({ key, source: member.source, field: dateField, detail: value, blocksDate: true });
        continue;
      }
      const softField = SOFT_FLAGS[key];
      if (softField !== undefined) {
        flags.push({
          key,
          source: member.source,
          field: softField,
          // `idFallback` records that a fallback was used, not an unreadable
          // value, so its "hashed" is not worth showing as if it were one.
          detail: key === "idFallback" ? undefined : value,
          blocksDate: false,
        });
      }
    }
  }
  return flags;
}

/**
 * A row that has no deadline *and* an unreadable date — as opposed to one that
 * genuinely has no date.
 *
 * The distinction is the whole point. Canvas's undated LTI shells and a course
 * page's "TBD" row are legitimately undated and belong nowhere in a list of
 * deadlines. A row whose date was there and could not be read is a deadline
 * this extension is currently hiding, and it has to be visible and loud.
 */
export function unreadableDeadline(item: Item): QualityFlag[] {
  if (item.dueAt !== undefined || item.lateDueAt !== undefined) return [];
  return qualityFlags(item).filter((flag) => flag.blocksDate);
}

/** One line for the row: "Gradescope: due date unreadable". */
export function unreadableSummary(flags: QualityFlag[]): string | undefined {
  if (flags.length === 0) return undefined;
  const first = flags[0]!;
  const more = flags.length > 1 ? ` (+${flags.length - 1} more)` : "";
  return `${first.source}: ${first.field} unreadable${more}`;
}
