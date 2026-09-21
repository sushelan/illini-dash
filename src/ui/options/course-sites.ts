/**
 * "Course websites", one row per course.
 *
 * Sushi, 2026-09-21, looking at the list this replaces: *"its in rows and its
 * hard to really read through everything… when theres more adapters for
 * students, they shouldnt be able to see courses that they havent selected.
 * also i hate the fact that theres duplicates and also courses that have more
 * than one source are filling up new rows instead of along the row, which can
 * save space. see how ece411 has course site and exams in two rows instead of
 * along the same row with a slider for each"*.
 *
 * So: **one row per course, and every page of it is a switch along that row.**
 * ECE 411 was a heading plus two rows — four lines for two pages, with the
 * course code and the hostname written twice; it is one line now. And only the
 * student's own courses are drawn: `courseGroupsForYou` still computes the
 * catalogue, and this module throws it away (see the note on that function for
 * what that costs).
 *
 * The module exists at all because of worker rule 1 and the rule above it: the
 * decisions here — how many rows, which switch carries a name, whether the host
 * is said once — were unreachable by any test while they lived inside
 * `renderOptions`, which needs a worker, `chrome.*` and a document. Nothing in
 * here touches `chrome.*` or the network; every action is a callback the page
 * hands in, so `tests/options-dom.test.ts` can render the real list over a
 * linkedom document and assert what a student would see.
 */

import { displayCourseLabel } from "../../core/names.js";
import {
  courseGroupsForYou,
  coursePagesLayout,
  groupHasCourse,
  type CourseGroup,
} from "../../core/registry.js";
import type { Response } from "../../messages.js";
import { el, stateChip } from "./dom.js";

/** One entry of the `get-adapters` answer, as this page sees it. */
export type AdapterEntry = Extract<Response, { type: "adapters" }>["adapters"][number];

/*
 * Every class this module writes and every selector anything reads it by, in
 * one place (UI house rule 7). Three redraw guards asked for `.menu` while the
 * element's class was `menu-surface` and were dead from the day they were
 * written; a shared constant makes the wrong answer unspellable, and the DOM
 * test reads these rather than a second copy of the spelling.
 */
export const COURSE_ROW_CLASS = "crow";
export const COURSE_NAME_CLASS = "crow--name";
export const COURSE_HOST_CLASS = "crow--host";
export const PAGES_CLASS = "crow--pages";
export const PAGE_CLASS = "crow--page";
export const PAGE_NAME_CLASS = "crow--page-name";
export const PAGE_HOST_CLASS = "crow--page-host";
export const SWITCH_CLASS = "crow--switch";
export const ALLOW_CLASS = "crow--allow";
export const REMOVE_CLASS = "crow--remove";
export const NOTE_CLASS = "crow--note";
/** The "Removed … · Undo" line, which the page builds and the row places. */
export const UNDO_CLASS = "agroup--undo";

/**
 * Whether the student added this one themselves.
 *
 * `local` is not on the `adapters` response type — the worker sets it — so it
 * is read defensively rather than declared (worker rule 8: a message is data
 * from another build). An older worker omits it, and `undefined !== true`
 * leaves the Remove button off, which is the harmless direction: a published
 * adapter has nothing to remove.
 */
export function isLocalAdapter(adapter: AdapterEntry): boolean {
  return (adapter as { local?: unknown }).local === true;
}

/** A path segment that names the term rather than the page: `fa2026`, `sp26`. */
const TERM_SEGMENT = /^(?:fa|sp|su|wi)\d{2,4}$/i;

/**
 * The page an adapter reads, named by its address: `assignments.html`.
 *
 * It was the adapter's *label* with the course code stripped off the front,
 * and the labels do not agree with each other: the registry writes
 * `CS/ECE 374 A course site` for a `CS374` entry and `CS 425 course site` for
 * a `CS425/ECE428` one, so neither prefix matched and the whole label came
 * through. One row then read "course site · Remove · CS/ECE 374 A course site"
 * — three restatements of the course beside a course name, and nothing saying
 * which switch reads which page (2026-09-21, and Sushi's word for it was "ew").
 *
 * The address is the one thing that differs and the one thing the student can
 * check against the site: `gps.html` beside `homeworks.html`. A URL that ends
 * in a directory has no page to name, so the term segment or an empty one
 * falls back to the label with the course taken off, which is what a hand-
 * written entry calls itself (`exams`).
 */
export function adapterPageName(adapter: AdapterEntry): string {
  const segment = pagePathSegment(adapter.url);
  if (segment !== undefined) return segment;
  for (const prefix of [displayCourseLabel(adapter.courseCode), adapter.courseCode]) {
    if (!adapter.label.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const rest = adapter.label.slice(prefix.length).trim();
    if (rest !== "") return rest;
  }
  return adapter.label;
}

/** The last path segment when it names a page, else undefined. */
function pagePathSegment(url: string): string | undefined {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return undefined;
  }
  const last = path.split("/").filter(Boolean).pop();
  if (last === undefined || last === "" || TERM_SEGMENT.test(last)) return undefined;
  return last.length <= 40 ? last : undefined;
}

/** Writes a sentence where the action that produced it happened. */
export type Note = (text: string) => void;

/**
 * What a control on one of these rows does. The page supplies all of it.
 *
 * `toggle` in particular: it is called straight out of the `change` handler and
 * must ask Chrome for the host permission **synchronously**, because a user
 * gesture does not survive an `await` — asking from the service worker, as this
 * first did, meant Chrome refused the prompt and the switch silently reverted
 * with no diagnostic anywhere.
 */
export interface CourseSiteActions {
  /** `control` is the switch itself, so a refusal can put it back. */
  toggle(adapter: AdapterEntry, enabled: boolean, note: Note, control: HTMLInputElement): void;
  allow(adapter: AdapterEntry, note: Note): void;
  remove(adapter: AdapterEntry, note: Note, button: HTMLButtonElement): void;
  /** The "Removed CS 425 lectures · Undo" line this course is still owed, if any. */
  undoLine?(group: CourseGroup<AdapterEntry>): HTMLElement | undefined;
}

let switchSeq = 0;

/**
 * One course: its name, its host, and one switch per page along the row.
 *
 * The switch is a real `<input type="checkbox">` with a real `<label for>` —
 * not a `<div>` with a click handler — so the keyboard behaviour, the label
 * association and the announcement come for free rather than being
 * reimplemented badly. Which element is that label is the layout's one subtle
 * point: with **one** page the course's own name is the label, so a single-page
 * course draws no page name at all (the course's name already says what the
 * switch is for, and "CS 424 / course site" is the redundancy 8812d32 took out
 * of the heading); with more than one, the name on the left is a plain `<span>`
 * and each page's own name labels its own switch.
 *
 * A group with no pages still draws: removing a course's last page has to leave
 * the undo line somewhere, and that is the removal most likely to be a mistake.
 */
export function courseRow(
  group: CourseGroup<AdapterEntry>,
  actions: CourseSiteActions,
): HTMLElement {
  const row = el("div", undefined, COURSE_ROW_CLASS);
  const layout = coursePagesLayout(group.adapters.map((adapter) => adapter.url));

  // The note is built first so every handler below can close over it: a
  // sentence about this course belongs on this course (UI rule 3), not in a
  // line under a list that can be a screenful away from the switch pressed.
  const note = el("p", undefined, `${NOTE_CLASS} opt-note`);
  const say: Note = (text) => {
    note.textContent = text;
  };

  // With one page this *is* the switch's label; with more it is a plain name
  // and each page labels its own switch.
  const courseLabel = layout.labelPages
    ? undefined
    : el("label", group.label, COURSE_NAME_CLASS);
  row.append(courseLabel ?? el("span", group.label, COURSE_NAME_CLASS));
  // Said once when every page shares it, which is the usual case. Visible
  // rather than hovered: granting access to a host nobody recognises is the
  // thing worth noticing before granting it.
  if (layout.sharedHost !== undefined) {
    row.append(el("span", layout.sharedHost, COURSE_HOST_CLASS));
  }

  const pages = el("span", undefined, PAGES_CLASS);
  group.adapters.forEach((adapter, at) => {
    const cell = el("span", undefined, PAGE_CLASS);
    const box = el("input");
    box.type = "checkbox";
    box.className = `switch ${SWITCH_CLASS}`;
    box.checked = adapter.enabled && adapter.granted;
    box.id = `csw-${(switchSeq += 1)}`;
    box.addEventListener("change", () => actions.toggle(adapter, box.checked, say, box));
    cell.append(box);

    const label = layout.labelPages
      ? el("label", adapterPageName(adapter), PAGE_NAME_CLASS)
      : courseLabel;
    if (label) {
      label.htmlFor = box.id;
      // The full address, discoverable: the hostname is on the row, and this is
      // the rest of it. On the element the pointer is already over.
      label.title = adapter.url;
      if (layout.labelPages) cell.append(label);
    }
    // Only when they differ — otherwise the row said it once, above.
    if (layout.sharedHost === undefined) {
      cell.append(el("span", layout.hosts[at] ?? "", PAGE_HOST_CLASS));
    }

    if (adapter.enabled && !adapter.granted) {
      // Switched on, but Chrome never granted the host — so it reads nothing
      // and says nothing. Not "Sign in needed": nothing about this is a login.
      const chip = stateChip(
        "needs_login",
        undefined,
        "Chrome has not granted access to this site",
      );
      chip.textContent = "Permission missing";
      cell.append(chip);
      const allow = el("button", "Allow", `btn btn-secondary btn-sm ${ALLOW_CLASS}`);
      allow.addEventListener("click", () => actions.allow(adapter, say));
      cell.append(allow);
    }

    if (isLocalAdapter(adapter)) {
      // A quiet mark on this page's own cell, not a button wedged between two
      // switches: it acts on one page, and drawn as a peer of the switches it
      // read as a third one.
      const remove = el("button", "\u00d7", `btn-bare ${REMOVE_CLASS}`);
      remove.setAttribute("aria-label", `Remove ${adapterPageName(adapter)}`);
      remove.title =
        `Removes ${adapter.label} from this browser. You added it yourself, so nobody ` +
        `else loses it — and you can put it back for a few seconds afterwards.`;
      remove.addEventListener("click", () => {
        // Asynchronous, so it says so on itself (UI rule 4): that one change
        // tells "the click never ran" from "the round trip failed" with no
        // console at all.
        remove.disabled = true;
        remove.textContent = "\u2026";
        actions.remove(adapter, say, remove);
      });
      cell.append(remove);
    }

    pages.append(cell);
  });
  row.append(pages);
  row.append(note);

  const undo = actions.undoLine?.(group);
  if (undo) row.append(undo);
  return row;
}

/**
 * The whole list: the student's courses, one row each, and nothing else.
 *
 * `courseGroupsForYou` is called here rather than in the page so that "which
 * courses does a student see?" is one decision with one caller — and so the DOM
 * test can hand in a registry containing courses that are not the student's and
 * watch them not appear.
 */
export function renderCourseSites(
  adapters: readonly AdapterEntry[],
  courseKeys: readonly string[],
  actions: CourseSiteActions,
): { rows: HTMLElement[]; yours: CourseGroup<AdapterEntry>[] } {
  const { yours } = courseGroupsForYou(adapters, courseKeys);
  return { rows: yours.map((group) => courseRow(group, actions)), yours };
}

/** Whether any drawn course would carry this removal's undo line. */
export function courseIsDrawn(
  yours: readonly CourseGroup<AdapterEntry>[],
  courseCode: string,
): boolean {
  return yours.some((group) => groupHasCourse(group, courseCode));
}
