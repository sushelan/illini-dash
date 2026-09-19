/**
 * One deadline, opened (brief D8, mock 1c).
 *
 * **In document flow, always.** It replaces the contents of `#view`; it is
 * never a floating panel. A panel positioned out of flow contributes nothing to
 * the intrinsic box Chrome measures to size a popup, so a screen with four
 * buttons at the foot of it would be clipped by the 600px ceiling with the
 * buttons past the bottom edge — the same defect the source list and the editor
 * each shipped with once (UI house rule 8).
 *
 * **It survives a redraw by being re-rendered, not by holding one off.** Six
 * things redraw this page and half of what this screen says is relative — a
 * countdown, "2 late", a status a sync just changed. Holding the draw
 * (`drawIsHeld`) would freeze all of it for as long as the screen is open,
 * which on the one surface whose whole point is a live countdown is the wrong
 * half of the trade. So `state.screen` holds an **item id**, not an item, and
 * `renderOpenScreen` is called from the entry's `render` on every draw: the row
 * is looked up fresh, and a row that has gone (deleted, hidden by a sync,
 * merged away) closes the screen rather than leaving a stale copy of it on
 * screen.
 */

import { countdown, examDetail, formatDue, liveDeadline, movedText } from "../../../core/grouping.js";
import { courseLabel, displayCourseLabel, SOURCE_NAME } from "../../../core/names.js";
import { courseColours, coursesIn } from "../../../core/calendar.js";
import { movedByText } from "../../../core/suggest.js";
import { googleCalendarUrl } from "../../../core/ics.js";
import { sameCourse } from "../../../core/dedupe.js";
import { unreadableDeadline, unreadableSummary } from "../../../core/quality.js";
import { iconButton } from "../../icons.js";
import type { Item, Status } from "../../../sources/types.js";
import { HIDDEN_KEY, MENU_CLASS, app, safeUrl, state, viewEl, writeStored } from "../state.js";
import { leaveNeedsYou } from "./needs-you.js";
import {
  applyOverrideAction,
  applySuggestionRequest,
  closeMenus,
  menuItem,
  placeFloating,
  soleManualMember,
  trapMenuKeys,
} from "../shell.js";

/* -------------------------------------------------------------------------- */
/* Opening and closing                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The title of the row the screen was opened from, so ‹ back can put focus
 * back on it.
 *
 * A title rather than a reference: the row that was pressed is destroyed by the
 * redraw that closes the screen, and a detached element cannot be focused. The
 * id would be exact, but no row element carries it — `rows.ts` is another
 * worker's file — and matching the title is right for every list this popup
 * draws, where two rows with the same title in the same view is itself a merge
 * defect.
 */
let openedFrom: string | undefined;

export function openDeadline(item: Item): void {
  closeMenus();
  leaveNeedsYou();
  openedFrom = item.title;
  state.screen = { kind: "deadline", itemId: item.id, view: state.view };
  // Focus lands on ‹ back once drawn (R2 L2).
  void app.refresh().then(() => {
    viewEl.querySelector<HTMLElement>(".screen-bar button")?.focus();
  });
}

/**
 * Back to the list, and focus where the screen came from.
 *
 * The refresh is what draws the list again: `render` finds no screen and takes
 * its ordinary path, which is also what restores the tab that was showing —
 * `state.view` was never changed.
 */
export function closeScreen(): void {
  if (!state.screen || state.screen.kind === "needs-you") return;
  state.screen = undefined;
  const wanted = openedFrom;
  openedFrom = undefined;
  void app.refresh().then(() => {
    const rows = [...viewEl.querySelectorAll<HTMLElement>("a.row, .row")];
    const match = rows.find(
      (row) => row.querySelector(".row--title")?.textContent === wanted,
    );
    (match ?? rows[0])?.focus();
  });
}

/*
 * Escape leaves the screen, the way it leaves a menu.
 *
 * At module scope and guarded on `state.screen`, so it is one listener for the
 * life of the document rather than one per open — the roving-tabindex bug
 * (listeners stacked by a function that runs after every draw) is the reason
 * that distinction is written down.
 *
 * `MENU_CLASS` first: with the screen's ⋯ open, Escape belongs to the menu, and
 * shell.ts's own handler has already dealt with it.
 */
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.screen) return;
  // The Needs-you screen owns its own Escape (screens/needs-you.ts).
  if (state.screen.kind === "needs-you") return;
  if (document.querySelector(`.${MENU_CLASS}`)) return;
  if (state.editor) return;
  event.preventDefault();
  closeScreen();
});

/**
 * Called by the entry's `render` on every draw. `true` means "this draw is
 * spoken for".
 *
 * Three ways it declines, and each is a way the screen is meant to end:
 * nothing is open; the student changed tab underneath it (the tab strip stays
 * live while a screen is open, and a tab press means they want the list); or
 * the row itself is gone.
 */
export function renderOpenScreen(now: Date): boolean {
  const screen = state.screen;
  if (!screen) return false;
  // Drawn by the entry before the tabs, never here.
  if (screen.kind === "needs-you") return false;
  if (screen.view !== state.view) {
    state.screen = undefined;
    openedFrom = undefined; // R2 L8: nothing to return focus to any more.
    return false;
  }
  if (screen.kind === "editor") {
    // The editor mounts itself (screens/editor.ts) and is held off redraws by
    // `drawIsHeld`, so a draw that reaches here is one where the form has
    // already gone — treat it as closed.
    state.screen = undefined;
    return false;
  }
  const item = state.currentItems.find((candidate) => candidate.id === screen.itemId);
  if (!item) {
    state.screen = undefined;
    return false;
  }
  viewEl.replaceChildren(renderDeadlineScreen(item, now));
  markScreen();
  return true;
}

/**
 * The marker the stylesheet keys the date navigator off.
 *
 * A `‹ Today · Sat, Sep 19 ›` strip over a screen about one deadline is a
 * control for a list that is not on screen, and pressing it would move an
 * anchor nothing here reads. Hidden by CSS on `body[data-screen]` rather than
 * by emptying `#nav`, which is the shell's element to write.
 *
 * Set on every draw that a screen owns, and cleared by `render` the moment one
 * does not — which is `clearScreenMark`, called from the same place.
 */
export function markScreen(): void {
  document.body.dataset["screen"] = "true";
}

export function clearScreenMark(): void {
  delete document.body.dataset["screen"];
}

/* -------------------------------------------------------------------------- */
/* The screen                                                                  */
/* -------------------------------------------------------------------------- */

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** What the source says about the work itself, in the student's words. */
const STATUS_WORD: Record<Status, string | undefined> = {
  not_submitted: "Not submitted",
  submitted: "Submitted",
  graded: "Graded",
  missing: "Missing",
  // Every source that cannot report completion reports this one, and "Unknown"
  // on a row is a word that answers nothing. The line is left out instead.
  unknown: undefined,
};

function statusText(item: Item): string | undefined {
  // The student's own tick outranks the source: it is the more recent statement
  // about the same question, and it is the one they can undo from this screen.
  if (item.done) return "Done — you ticked it off";
  if (item.kind === "booking") {
    return item.status === "submitted" || item.status === "graded" ? "Booked" : "Not booked";
  }
  return STATUS_WORD[item.status];
}

function factRow(label: string, value: string, tone?: "warn"): HTMLElement {
  const row = el("div", "fact");
  row.append(el("span", "fact--label", label));
  const text = el("span", "fact--value", value);
  if (tone === "warn") text.classList.add("fact--warn");
  row.append(text);
  return row;
}

function renderDeadlineScreen(item: Item, now: Date): HTMLElement {
  const screen = el("section", "screen screen--deadline");
  screen.append(renderBar(item));

  const body = el("div", "screen--body");
  screen.append(body);

  /* ---- course pill and title ---- */
  const head = el("div", "dl--head");
  const pill = el("span", "dl--course");
  // The same hue the row carried, derived the same way, so opening a row does
  // not change the colour of the thing that was opened.
  const colours = courseColours(coursesIn(state.currentItems));
  if (colours.has(item.courseLabel)) pill.classList.add(`course-${colours.get(item.courseLabel)!}`);
  pill.append(el("span", "dl--dot", ""));
  pill.append(el("b", "dl--code", displayCourseLabel(item.courseLabel) || "—"));
  // The student's own name for the course beside the code, which is the mock's
  // "CS425 · Distributed Systems". Only when they have given one: repeating the
  // code twice in one pill is noise.
  const named = state.courseNames[item.courseLabel]?.trim();
  if (named) pill.append(el("span", "dl--course-name", named));
  head.append(pill, el("h2", "dl--title", item.title));
  body.append(head);

  body.append(renderDueCard(item, now));
  body.append(renderFacts(item, now));

  /* ---- an announcement moved it ---- */
  const moved = movedByText(item) ?? movedText(item);
  if (moved) {
    const note = el("div", "dl--moved");
    note.append(el("div", "dl--moved-head", "Moved by an announcement"));
    const line = el("div", "dl--moved-text", moved);
    if (item.movedBy?.reason) line.title = item.movedBy.reason;
    note.append(line);
    // Only an override written by a post can be taken back: `movedFrom` is
    // derived per sync and has nothing behind it to undo.
    if (item.movedBy) {
      const undo = document.createElement("button");
      undo.type = "button";
      undo.className = "btn btn-secondary btn-sm dl--undo";
      undo.textContent = "Undo move";
      undo.title = "Put this deadline back to what the source says";
      undo.addEventListener("click", () => {
        applySuggestionRequest({ type: "undo-move", itemId: item.id }, undo);
      });
      note.append(undo);
    }
    body.append(note);
  }

  body.append(renderButtons(item));
  return screen;
}

function renderBar(item: Item): HTMLElement {
  const bar = el("div", "screen-bar");
  const back = iconButton("left", "Back to the list");
  back.classList.add("btn-icon");
  back.addEventListener("click", () => closeScreen());
  bar.append(back, el("div", "screen-bar--title", "Deadline"));
  const more = iconButton("more", "More actions");
  more.addEventListener("click", (event) => {
    event.stopPropagation();
    // A second press closes, as the header's ⋯ does (R2 L4).
    if (more.getAttribute("aria-expanded") === "true") {
      closeMenus();
      return;
    }
    openScreenMenu(item, more);
  });
  bar.append(more);
  return bar;
}

/**
 * "DUE / Today, 11:59 PM" on the left, the countdown on the right.
 *
 * `liveDeadline` decides which instant that is, so this screen cannot disagree
 * with the row about a full-credit deadline that has passed while the late
 * window is still open.
 */
function renderDueCard(item: Item, now: Date): HTMLElement {
  const card = el("div", "card dl--due");
  const left = el("div", "dl--due-left");
  left.append(el("div", "dl--due-label", "Due"));

  const live = liveDeadline(item, now);
  const unreadable = unreadableDeadline(item);
  const when = el("div", "dl--due-when");
  if (unreadable.length > 0) {
    when.textContent = "The source's date could not be read";
    when.title = unreadableSummary(unreadable) ?? "";
  } else if (live === undefined) {
    when.textContent = "No date yet";
  } else {
    when.textContent = new Date(live.at).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    // Never shown as a stated time. §4.5's runner fills in 23:59 for a course
    // page that prints a bare date, and a screen this large showing it as fact
    // is worker rule 3's risk wearing its friendliest face.
    if (item.timeAssumed) {
      when.append(el("span", "dl--assumed", "no time stated"));
      when.title = "The course site gives a date but no time. Check the page for the cutoff.";
    }
  }
  left.append(when);

  const right = el("div", "dl--count");
  if (item.done) {
    right.append(el("div", "dl--count-big", "done"));
  } else if (live !== undefined) {
    /*
     * `countdown` answers in whatever unit is still true, which past a week is
     * a *date* — "Dec 23", under a caption reading "remaining". The row wants
     * that; a card whose whole right-hand side is a quantity does not, so
     * anything that is not already a quantity becomes one here.
     */
    const text = countdown(live.at, now, "fine");
    const late = live.at < now.getTime();
    const days = Math.max(1, Math.round(Math.abs(live.at - now.getTime()) / 86_400_000));
    const quantity = late
      ? { big: text.replace(/ late$/, ""), cap: "late" }
      : text.startsWith("in ")
        ? { big: text.slice(3), cap: "remaining" }
        : { big: `${days}d`, cap: "to go" };
    const big = el("div", "dl--count-big", quantity.big);
    if (late) big.classList.add("is-late");
    right.append(big, el("div", "dl--count-cap", quantity.cap));
  }
  if (right.childElementCount > 0) card.classList.add("dl--due-open");
  card.append(left, right);
  return card;
}

function renderFacts(item: Item, now: Date): HTMLElement {
  const facts = el("div", "dl--facts");

  /* ---- Source, with a way to open it ---- */
  const primary = item.members[0]?.source;
  const sourceRow = factRow("Source", primary ? SOURCE_NAME[primary] : "—");
  const url = safeUrl(item.url);
  if (url) {
    const open = document.createElement("button");
    open.type = "button";
    open.className = "link fact--open";
    open.textContent = "Open ↗";
    open.addEventListener("click", () => chrome.tabs.create({ url }));
    sourceRow.append(open);
  }
  facts.append(sourceRow);

  /* ---- and every other source that sees the same deadline ---- */
  const others = [...new Set(item.members.slice(1).map((member) => member.source))];
  if (others.length > 0) {
    facts.append(
      factRow("Also seen in", others.map((source) => SOURCE_NAME[source]).join(" · ")),
    );
  }

  const status = statusText(item);
  if (status) facts.append(factRow("Status", status));

  /* ---- the late window, when there is one and it is still the live one ---- */
  const live = liveDeadline(item, now);
  if (live?.late === true && item.lateDueAt) {
    const until = new Date(item.lateDueAt);
    if (!Number.isNaN(until.getTime())) {
      facts.append(
        factRow(
          "Late window",
          `Until ${until.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`,
          "warn",
        ),
      );
    }
  }

  // §4.4's room and duration: an exam is the one deadline where "where" has a
  // wrong answer.
  const exam = examDetail(item);
  if (exam) facts.append(factRow(item.kind === "booking" ? "Sessions" : "Where", exam));

  // The row's own right-hand detail, when it says something the lines above do
  // not — "80% until Sep 22", "opens 9 AM", a score so far.
  const detail = formatDue(item, now).detail;
  if (detail) facts.append(factRow("Also", detail));

  return facts;
}

/* -------------------------------------------------------------------------- */
/* The four buttons                                                            */
/* -------------------------------------------------------------------------- */

function renderButtons(item: Item): HTMLElement {
  const grid = el("div", "dl--buttons");

  const button = (label: string, primary: boolean): HTMLButtonElement => {
    const control = document.createElement("button");
    control.type = "button";
    control.className = `btn ${primary ? "btn-primary" : "btn-secondary"} dl--button`;
    control.textContent = label;
    return control;
  };

  const done = button(item.done ? "Not done" : "Mark done", !item.done);
  done.addEventListener("click", () => {
    applyOverrideAction({ kind: item.done ? "undone" : "done", itemId: item.id }, done);
  });
  grid.append(done);

  // Hidden rather than disabled when it does not resolve: §8.3 route 1 needs an
  // instant to put in the link, and a dead button on a four-button grid is a
  // question with no answer.
  const calendar = googleCalendarUrl(item);
  if (calendar) {
    const gcal = button("Add to Calendar", false);
    gcal.addEventListener("click", () => chrome.tabs.create({ url: calendar }));
    grid.append(gcal);
  }

  /*
   * Hide the *course*, not the row.
   *
   * The same set the header's ⋯ › Courses writes, so the two controls cannot
   * disagree about which courses are off, and the way back is where it has
   * always been. Local to this window (`HIDDEN_KEY`), like every other view
   * preference, so it needs no round trip.
   */
  const code = courseLabel(item.courseLabel, state.courseNames);
  const hideCourse = button(
    state.hidden.has(item.courseLabel) ? `Show ${code}` : `Hide ${code}`,
    false,
  );
  hideCourse.title = "Switches the whole course off in this window. ⋯ › Courses turns it back on.";
  hideCourse.addEventListener("click", () => {
    if (state.hidden.has(item.courseLabel)) state.hidden.delete(item.courseLabel);
    else state.hidden.add(item.courseLabel);
    writeStored(HIDDEN_KEY, JSON.stringify([...state.hidden]));
    // Back first: the row this screen is about may be one of the ones that just
    // went, and a screen about a hidden row would close itself on the next draw
    // anyway — with a frame of nothing in between.
    closeScreen();
  });
  grid.append(hideCourse);

  const hide = button(item.hidden ? "Unhide this" : "Hide this", false);
  hide.addEventListener("click", () => {
    applyOverrideAction({ kind: item.hidden ? "unhide" : "hide", itemId: item.id }, hide);
  });
  grid.append(hide);

  return grid;
}

/* -------------------------------------------------------------------------- */
/* The ⋯, for everything the four buttons do not carry                         */
/* -------------------------------------------------------------------------- */

/**
 * The rest of inventory section I, reachable from the screen that replaced the
 * row menu as the primary path.
 *
 * Built with the shell's own helpers rather than by calling `openRowMenu`: that
 * one is anchored on a row and repeats Mark done, Hide and Open, which are
 * buttons here. Everything it does that is *not* a button is below, with the
 * same behaviour — including Merge's replace-in-place list of at most twelve
 * same-course candidates.
 */
function openScreenMenu(item: Item, anchor: HTMLElement): void {
  closeMenus();
  const menu = document.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");
  menu.addEventListener("click", (event) => event.stopPropagation());

  const add = (
    label: string,
    glyph: Parameters<typeof menuItem>[1],
    onClick: (entry: HTMLElement) => void,
  ): void => {
    menu.append(menuItem(label, glyph, onClick));
  };

  if (item.members.length > 1) {
    add(`Split (${item.members.length} sources)`, "more", (entry) => {
      applyOverrideAction({ kind: "split", itemId: item.id }, entry);
    });
  }

  // §5.1's own test, not the derived label: a cross-listed course ("CS425
  // ECE428") could otherwise never be re-merged after a split.
  const candidates = state.currentItems.filter(
    (other) =>
      other.id !== item.id &&
      !other.hidden &&
      other.members.some((mine) => item.members.some((theirs) => sameCourse(mine, theirs))),
  );
  if (candidates.length > 0) {
    add("Merge with…", "plus", () => {
      menu.replaceChildren();
      const heading = el("div", "menu-heading", `Merge "${item.title}" with:`);
      menu.append(heading);
      for (const other of candidates.slice(0, 12)) {
        add(other.title, "plus", (entry) => {
          applyOverrideAction({ kind: "merge", itemId: item.id, otherItemId: other.id }, entry);
        });
      }
      // The pressed entry was just removed with the rest, and focus with it.
      menu.querySelector<HTMLElement>(".menu-item")?.focus();
    });
  }

  const mine = soleManualMember(item);
  if (mine) {
    add("Edit", "settings", () => {
      closeMenus();
      app.openEditEditor(item, mine);
    });
    add("Delete", "close", (entry) => app.deleteManual(item, mine, entry));
  }

  /*
   * "Report this page" is the options page's tool, and it stays there.
   *
   * It needs a NetID and a name to scrub with, and a file to download at the
   * end of it — three things a 400px window with no scrollback is the wrong
   * place for. The entry exists here because this screen is where a student is
   * standing when they decide a row is wrong (inventory §W).
   */
  // Renaming lives in Settings › Courses with the rest of the course tools
  // (brief D8 lists it here; the rename itself is `renameCourse` in Options).
  add("Rename course…", "settings", () => {
    closeMenus();
    void chrome.tabs.create({ url: chrome.runtime.getURL("options.html#sec-courses") });
  });

  add("Report this page…", "warning", () => {
    closeMenus();
    void chrome.tabs.create({ url: chrome.runtime.getURL("options.html#sec-help") });
  });

  document.body.append(menu);
  placeFloating(menu, anchor, "right");
  trapMenuKeys(menu, anchor);
}
