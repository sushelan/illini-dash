/**
 * Whether the extension actually read a *booked seat* for an exam.
 *
 * V06: the exam board's green tick used to be
 * `source.textContent === "PrairieTest"` — the **name** of a source, which says
 * only that PrairieTest mentioned the exam, never that a seat was taken. So it
 * appeared on the "Not booked" card, whose entire point is that no seat has
 * been taken, and on exams already sat. That is worker rule 3 one layer up: a
 * value this code invented (a tick derived from a label) read downstream as a
 * value the source stated.
 *
 * The evidence is PrairieTest's own. A booked row links to
 * `/pt/student/reservation/{id}` and `src/sources/prairietest.ts` records that
 * id in the member's `extra.reservationId`. No id, no reservation.
 *
 * It lives in `core/` rather than in `views/exams.ts` because it is a
 * *decision*, and a decision belongs where a test can pin and mutate it
 * (worker rule 1). `views/exams.ts` imports `../state.js`, whose module body
 * calls `applyStoredTheme()` and therefore needs a document, so nothing in that
 * file is reachable from a node test.
 */

import type { Item } from "../sources/types.js";
import { nonEmpty } from "./parsing.js";

/** Which of the exam board's three sections `examBoard` put the item in. */
export type ExamPlacement = "unbooked" | "upcoming" | "recent";

export function reservationVerified(item: Item, placedIn: ExamPlacement): boolean {
  // A booking still to be made is by definition not booked, and an exam already
  // sat is not a seat you hold. Only a sitting still ahead can be confirmed.
  if (placedIn !== "upcoming") return false;
  return item.members.some(
    (member) =>
      // PrairieTest is the system that owns a CBTF reservation. Another source
      // carrying a key of the same name is not evidence about a seat.
      member.source === "prairietest" &&
      // House rule 5: `typeof x === "string"` passes `""`, and an empty id is
      // exactly what a half-read row leaves behind.
      nonEmpty(member.extra?.["reservationId"]) !== undefined,
  );
}
