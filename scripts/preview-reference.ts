/** Illustrative ZIP titles, with coherent 2026 dates. Never shipped or parsed.
 * The export mixes Sep 2024 dates with Tuesday Sep 22; don't copy that error.
 */
import type { Item, RawItem, Source } from "../src/sources/types.js";

export function referenceItems(now: number): Item[] {
  const at = (day: number, hour = 23, minute = 59): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + day);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const row = (id: string, course: string, title: string, source: Source,
    patch: Partial<Item> = {}, extra?: Record<string, string>): Item => {
    const origins: Partial<Record<Source, string>> = {
      canvas: "https://canvas.illinois.edu/", gradescope: "https://www.gradescope.com/courses/1",
      prairielearn: "https://us.prairielearn.com/pl/", prairietest: "https://us.prairietest.com/",
      smartphysics: "https://www.smartphysics.com/",
    };
    const raw: RawItem = {
      source, sourceId: `reference-${id}`, courseRaw: course, courseCode: course,
      title, kind: patch.kind ?? "assignment", status: patch.status ?? "not_submitted",
      dueAt: patch.dueAt, url: origins[source] ?? "https://illinois.edu/",
      fetchedAt: new Date(now).toISOString(), extra,
    };
    return { id: raw.sourceId, courseLabel: course, courseCode: course, title,
      kind: raw.kind, status: raw.status, url: raw.url, members: [raw],
      hidden: false, done: false, notified: {}, ...patch };
  };
  return [
    row("late", "PHYS212", "Discussion Quiz 3: Electric Potential", "smartphysics", { dueAt: at(-1) }),
    row("eod", "CS225", "Daily Memory Checkpoint & Survey", "prairielearn", { dueAt: at(0), timeAssumed: true }, { timeAssumed: "true" }),
    row("homework", "MATH257", "Homework 5: Orthogonality & Gram-Schmidt", "gradescope", { dueAt: at(0) }, { points: "50" }),
    row("practice", "CS225", "PrairieLearn Practice Quiz", "prairielearn", { dueAt: at(0), status: "graded" }),
    row("lab", "CS225", "Lab 04: Trees & Traversals", "prairielearn", { dueAt: at(1, 17, 0) }),
    row("prelecture", "PHYS212", "Unit 6 Prelecture", "smartphysics", { dueAt: at(1, 8, 0) }),
    row("capacitors", "PHYS212", "Lab 4: Capacitance", "canvas", { dueAt: at(2), timeAssumed: true }, { timeAssumed: "true" }),
    row("discussion", "MATH257", "Discussion Quiz 4", "gradescope", { dueAt: at(3, 11, 59) }),
    row("mp", "CS225", "MP 2: Image Processing", "gradescope", { dueAt: at(3) }),
    row("proposal", "CS225", "Final Project Proposal & Team Contract", "prairielearn"),
    row("extra", "MATH257", "Extra Credit Linear Algebra Exploration", "canvas"),
    row("formula", "PHYS212", "Formula Sheet & Reference Guide Review", "smartphysics"),
    row("ambiguous", "CS225", "Honor Code Affirmation", "prairielearn", {}, { unparsedDueDate: "Due before Midterm 1 window closes" }),
    row("booking", "CS225", "Midterm 1: Memory & Pointers", "prairietest", { kind: "booking" }, { windowStart: at(-2, 0, 0), windowEnd: at(6), location: "CBTF Grainger" }),
    // `reservationId` is what a booked PrairieTest row carries (its link is
    // `/pt/student/reservation/{id}`), and it is the only evidence the Exams
    // tab accepts for the mock's filled check_circle beside "PrairieTest".
    // The sample id is shaped like a real one and is not a real one.
    row("exam", "PHYS212", "Hour Exam 1: Electrostatics", "prairietest", { kind: "exam", dueAt: at(16, 19, 0) }, { location: "1404 Siebel Center", duration: "90min", reservationId: "418271" }),
    row("midterm", "MATH257", "Midterm Exam 1: Systems & Matrix Inverses", "canvas", { kind: "exam", dueAt: at(14, 19, 0) }, { location: "Foellinger Auditorium" }),
    row("recent", "CS225", "Pre-semester Placement Assessment", "prairielearn", { kind: "exam", dueAt: at(-3, 14, 0), status: "graded" }),
  ];
}
