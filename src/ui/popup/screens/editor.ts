/**
 * Typing a deadline in, editing one, deleting one, and taking that back.
 *
 * The form itself is `src/ui/editor.ts`, which knows nothing about the popup;
 * this is the part that decides where it goes, what it is prefilled with, and
 * what happens to the answer.
 */

import { QUICK_SELECTOR, createEditor, type EditorValues } from "../../editor.js";
import { coursesIn, dayKey } from "../../../core/calendar.js";
import { courseLabel, SOURCE_NAME } from "../../../core/names.js";
import { icon } from "../../icons.js";
import { send } from "../../../messages.js";
import type { Item } from "../../../sources/types.js";
import { UNDO_MS, app, state, viewedDate, viewEl } from "../state.js";
import {
  QUICK_FAB_SELECTOR,
  closeMenus,
  placeQuickPanel,
  releaseQuickPanel,
  showStatus,
  soleManualMember,
} from "../shell.js";
import { markScreen } from "./deadline.js";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** `HH:MM` on a 24-hour clock — what `<input type="time">` and §3 both use. */
export function timeValue(when: Date): string {
  return `${pad2(when.getHours())}:${pad2(when.getMinutes())}`;
}

export { pad2 };

/**
 * The fields of a manual row, as the editor's strings.
 *
 * Read from the *member*, not from the merged `Item`: a manual row can be
 * merged with a Gradescope one, and then `item.title` and `item.url` are
 * whichever member §5.3 ranked highest. Editing would silently rewrite the
 * student's own row to say what Gradescope says.
 *
 * A time the extension invented comes back blank. `extra.timeAssumed` is the
 * mark worker rule 3 exists for, and pre-filling 23:59 from it would turn an
 * invention into a value the student had apparently stated the moment they
 * opened the form to fix a typo in the title.
 */
export function valuesOfMember(member: Item["members"][number]): EditorValues {
  const due = member.dueAt ? new Date(member.dueAt) : undefined;
  const assumed = member.extra?.["timeAssumed"] === "true";
  const endRaw = member.extra?.["endAt"];
  const end = endRaw ? new Date(endRaw) : undefined;
  const dated = due !== undefined && !Number.isNaN(due.getTime());
  return {
    title: member.title,
    courseRaw: member.courseRaw,
    // Blank, not today, when the row has no date: since D11 a manual row may
    // legitimately have none, and pre-filling the day the list happens to be
    // looking at would save a deadline the student never typed the moment they
    // opened the form to fix a title. The form reads a blank date as its
    // "No date yet" toggle being on.
    date: dated ? dayKey(due!) : "",
    time: dated && !assumed ? timeValue(due!) : "",
    endTime: end !== undefined && !Number.isNaN(end.getTime()) ? timeValue(end) : "",
    kind: member.kind,
    url: member.url ?? "",
  };
}

/** The course labels on screen, offered as suggestions and not as a closed list. */
function courseChoices(): string[] {
  return coursesIn(state.currentItems).map((course) => courseLabel(course, state.courseNames));
}

/**
 * Hand the fields to the worker, and turn a refusal into something to read.
 *
 * `core/manual.ts` is the only thing that judges these, so this does no
 * checking of its own — it forwards strings and rethrows the sentence. The
 * `.catch` lives in the editor, which is the surface that has somewhere to put
 * it (UI house rule 2: a `send` without one is silent in the page *and* in the
 * worker's console).
 */
export async function saveManual(values: EditorValues, sourceId?: string): Promise<void> {
  const input = {
    title: values.title,
    courseRaw: values.courseRaw,
    date: values.date,
    time: values.time,
    endTime: values.endTime,
    kind: values.kind,
    url: values.url,
  };
  // Logged on the popup side, like every other request (worker rule 5).
  console.log(
    `[illini-dash] ${sourceId === undefined ? "add-manual-item" : `edit-manual-item for manual:${sourceId}`} requested`,
  );
  const response = await send(
    sourceId === undefined
      ? { type: "add-manual-item", input }
      : { type: "edit-manual-item", sourceId, input },
  );
  if (response.type === "error") throw new Error(response.message);
}

export interface EditorRequest {
  /**
   * Where the form goes, for a caller that has a place for it — the week's
   * per-day boxes, and the day grid's draft, which both need the form *inside*
   * the thing that was pressed.
   *
   * Left out, the form is a **screen**: it replaces `#view`, like the deadline
   * screen, which is what mock 2b draws and what the header's `+`, "Give it a
   * date" and the No date tab's dashed card all want. Either way it is in
   * document flow — a floating form contributes no height for Chrome to
   * measure (F116).
   */
  container?: HTMLElement;
  where?: "start" | "end";
  /**
   * The five-field panel over the list, instead of a screen (2026-09-19).
   *
   * `anchor` is the control that opened it — the floating "+" — and the only
   * thing it is used for is putting focus back when the panel closes. It is
   * `undefined` for the two cards that open the panel from inside `#view`
   * (Today's quiet card, Alerts' dashed card), because a redraw destroys those
   * and focusing a detached node is a promise this cannot keep.
   *
   * The panel is appended to `<body>`, not to `#view`: it sits on top of a list
   * it must not be part of, and a draw that ever did slip past `drawIsHeld`
   * would take a half-typed form with it. It is `position: fixed`, which
   * contributes no height for Chrome to measure — so `placeQuickPanel` asks
   * for the room, exactly as `placeFloating` does for a menu (UI rule 8).
   */
  quick?: { anchor: HTMLElement | undefined };
  /**
   * Which fields the panel carries. Only meaningful with `quick`.
   *
   * `"quick"` (the default) is the four-field shape Sushi asked for on the
   * "+": Date, Time, Title, Course. `"full"` is every field the screen has —
   * Kind, "No date yet" and the "More" fold with Ends and Link — in the same
   * floating panel.
   *
   * The two are separate questions and were one flag. *Where* the form goes is
   * this file's (`quick`); *what is on it* is the form's (`compact`), and
   * tying them meant an edit could not have both the panel and the fields an
   * edit needs. `.editor--quick` is what `popup-screens.css` draws the panel
   * from and it does not name a single one of the four fields — it is a fixed
   * box, a two-column grid and a `.editor--field-wide` that spans it, which is
   * exactly as true of seven fields as of four.
   */
  fields?: "quick" | "full";
  heading: string;
  submitLabel: string;
  /** The sentence under the bar (mock 2b), for the screens that have one. */
  intro?: string;
  values: Partial<EditorValues>;
  /** Present when this is an edit rather than a new row. */
  sourceId?: string;
  /**
   * What Save does, when it is not a manual row being written.
   *
   * "Give it a date" on a *source* row is the one case: there is nothing in
   * `manualItems` to edit, and the date goes into the overrides instead. It
   * rejects with the sentence to show, exactly as `saveManual` does, so the
   * editor's own catch is the only error path either way.
   */
  save?: (values: EditorValues) => Promise<void>;
  /** Follows the clock fields; the day grid uses it to move the draft box. */
  onChange?: (values: EditorValues) => void;
  /** Run when the form goes away, however it goes away. */
  onClose?: () => void;
}

export function closeEditor(): void {
  if (!state.editor) return;
  const el = state.editor.el;
  state.editor = undefined;
  el.remove();
  const after = state.editorOnClose;
  state.editorOnClose = undefined;
  after?.();
  // A form that had replaced the view leaves an empty `#view` behind, so the
  // redraw is not optional there the way it is for a form that was pushed into
  // a list still on screen.
  const wasScreen = state.screen?.kind === "editor";
  if (wasScreen) state.screen = undefined;
  if (state.redrawAfterEditor || wasScreen) {
    state.redrawAfterEditor = false;
    void app.refresh();
  }
}

export function openEditor(request: EditorRequest): void {
  closeMenus();
  closeEditor();
  const quick = request.quick;
  // The panel, with every field on it. `compact` is the *field set*, so this
  // shape does not take it — and then it has to be told it is a panel, because
  // `createEditor` only adds the class that draws one when `compact` is on.
  const fullPanel = quick !== undefined && request.fields === "full";
  const handle = createEditor({
    ...(quick && !fullPanel ? { compact: true } : {}),
    heading: request.heading,
    submitLabel: request.submitLabel,
    courses: courseChoices(),
    values: request.values,
    ...(request.intro !== undefined ? { intro: request.intro } : {}),
    ...(request.onChange ? { onChange: request.onChange } : {}),
    onSave: async (values) => {
      if (request.save) await request.save(values);
      else await saveManual(values, request.sourceId);
      closeEditor();
      // Not deferred: the form is gone, and the row it just created is the
      // whole point of having pressed Save.
      await app.refresh();
    },
    onCancel: () => closeEditor(),
  });
  state.editor = { handle, el: handle.el };
  state.editorOnClose = request.onClose;
  const container = request.container;
  if (quick) {
    if (fullPanel) {
      handle.el.classList.add(QUICK_SELECTOR.slice(1));
      /*
       * ‹ back goes, × stays.
       *
       * The full shape builds a screen bar — ‹ back, the heading, × — and both
       * controls are `onCancel`. In a panel there is nothing to go *back* to,
       * so ‹ is a second dismiss two elements from the first and a promise of a
       * screen that is not there. × is what a panel is expected to carry and it
       * is the one this keeps.
       *
       * By its label rather than by position: `iconButton("left", "Back")` is
       * what puts the string there, and a query that said "the first button in
       * the bar" would quietly take the heading's place if the bar's order ever
       * changed. Nothing happens if it is not found, which is the right answer
       * if `editor.ts` ever stops drawing one.
       */
      handle.el.querySelector<HTMLElement>('.editor--head [aria-label="Back"]')?.remove();
    }
    openQuickPanel(handle.el, quick.anchor, request.onClose);
    return;
  }
  if (container === undefined) {
    // The screen case. `state.screen` is what tells the entry's `render` that
    // the view belongs to a sub-screen; `drawIsHeld` is what stops a redraw
    // arriving mid-word, so between them the form is neither overwritten nor
    // left behind by a draw it did not see.
    state.screen = { kind: "editor", view: state.view };
    viewEl.replaceChildren(handle.el);
    markScreen();
  } else if (request.where === "end") {
    container.append(handle.el);
  } else {
    container.prepend(handle.el);
  }
  handle.focus();
  // The form is taller than most rows, and in the week and month views it opens
  // well down a document that may be scrolled. `nearest`, so a form already in
  // view does not move the page under the pointer that opened it.
  handle.el.scrollIntoView({ block: "nearest" });
}

/* -------------------------------------------------------------------------- */
/* The quick panel                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Put the five-field form over the list, and take it away again.
 *
 * Four things have to be true of it, and each is a defect this project has
 * already shipped once in some other costume:
 *
 * 1. **It is reachable.** Fixed, above the "+" that opened it, with the room
 *    asked for in pixels on `body` (`placeQuickPanel`) — because a floating
 *    panel contributes nothing to the box Chrome measures.
 * 2. **A redraw cannot take it.** `state.editor` holds every draw
 *    (`drawIsHeld`), and the panel hangs off `<body>` rather than `#view`, so
 *    even a draw that somehow ran would not `replaceChildren` it away.
 * 3. **Escape and Cancel put focus back on the "+".** Synchronously, on an
 *    element no draw rebuilds — not chained onto `refresh()`, which returns
 *    before a held draw has drawn anything (popup/focus.ts). A click *outside*
 *    deliberately does not: the click has already put focus somewhere, and
 *    taking it back is the steal that rule exists to prevent.
 * 4. **Dismiss-on-outside-click is decided in a click listener, one task
 *    later.** Not in a microtask queued from a focus event (the row-menu bug),
 *    and not in this task: two of the callers below open the panel from a
 *    `click` that is still propagating toward `document`, and a listener added
 *    during that propagation is called by that very event.
 */
function openQuickPanel(
  el: HTMLElement,
  anchor: HTMLElement | undefined,
  onClose: (() => void) | undefined,
): void {
  el.setAttribute("role", "dialog");
  document.body.append(el);
  anchor?.setAttribute("aria-expanded", "true");
  placeQuickPanel(el, anchor);
  /*
   * The room asked for is the room the panel needed *then*.
   *
   * A refusal from `core/manual.ts` adds a line under the field it is about, so
   * the panel that fitted when it opened is taller by the time the sentence
   * that says why is on it — and on a short list that is the one moment the
   * reserve has to be right. Re-asked from the element's own size rather than
   * recomputed at each of the places a sentence can appear.
   */
  const sizes =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => placeQuickPanel(el, anchor));
  sizes?.observe(el);

  // True until an outside click says otherwise; read by the close below.
  let restoreFocus = true;
  const outside = (): void => {
    restoreFocus = false;
    closeEditor();
  };
  const arm = setTimeout(() => document.addEventListener("click", outside), 0);

  state.editorOnClose = () => {
    sizes?.disconnect();
    clearTimeout(arm);
    document.removeEventListener("click", outside);
    releaseQuickPanel();
    anchor?.removeAttribute("aria-expanded");
    onClose?.();
    if (restoreFocus) anchor?.focus();
  };
  state.editor?.handle.focus();
}

/**
 * The "+" this view has, when it has one.
 *
 * Looked up rather than passed, because the two cards that open the panel from
 * inside `#view` cannot name it and the floating control is the right place for
 * focus to land from any of them. `undefined` on Alerts and Exams, which have
 * no floating "+" — there the panel opens and focus is simply left where the
 * browser put it.
 */
function quickAnchor(): HTMLElement | undefined {
  const fab = document.querySelector<HTMLElement>(QUICK_FAB_SELECTOR);
  /*
   * An anchor with no box is not an anchor.
   *
   * The "+" is drawn once, on `<body>`, and **stays in the document** on the
   * tabs that do not have one — `popup-screens.css` hides it with
   * `.qfab { display: none }` and turns it on for Day, Week and Month, and
   * `body[data-screen] .qfab { display: none }` takes it away again on every
   * sub-screen. So the query above is not `null` on Alerts, on Exams or on the
   * deadline screen: it is an element whose `getBoundingClientRect()` is all
   * zeros.
   *
   * `placeQuickPanel` reads `box.top` from it and computes
   * `windowHeight - box.top + QUICK_GAP`, which off a zero rect is 608px in a
   * 600px window — the panel positioned entirely above the top edge, with a
   * `max-height` floored at 140. Measured: Alerts' dashed "Add something" card
   * opened a panel at `bottom: 608px`, i.e. nowhere. The doc comment on this
   * function already promised `undefined` there; only `querySelector` returning
   * null would have delivered it, and it never does.
   *
   * The test is `getClientRects()`, which the CSSOM defines as empty for an
   * element that generates no boxes — exactly the question being asked.
   *
   * Not `offsetParent`: the HTML standard has that return null whenever the
   * computed position is `fixed`, and `.qfab` is fixed on the three tabs where
   * it *is* showing, so it would have refused every anchor there is. Not
   * `getBoundingClientRect()` either: that returns an all-zero rect for a
   * `display: none` element *and* under a DOM with no layout engine, so the
   * suite's linkedom document would lose the anchor along with Alerts — which
   * is what it did, and what the three `floating +` tests caught. Absent the
   * method, there is no layout to ask about and the element stands.
   */
  if (!fab) return undefined;
  if (typeof fab.getClientRects === "function" && fab.getClientRects().length === 0) {
    return undefined;
  }
  return fab;
}

/**
 * Every "add" on the calendar tabs: the floating "+", the week's empty day,
 * the month's per-day "+", Today's quiet card and Alerts' dashed card.
 *
 * Sushi, 2026-09-19: "the add should be in a hovering + on a tab in the day,
 * week, and month that doesnt take up the whole screen, it should just be a
 * small popup for date, time, name, course, and add/cancel." So the *form* is
 * the quick one wherever the add is started from a day — one form, not two
 * shapes a student has to learn — and the complete one stays on the header's
 * "+" (`openFullAdd`), which is also the only "+" the Alerts and Exams tabs
 * have.
 *
 * `container` is deliberately not forwarded. The week used to mount the whole
 * form inside the day card it was pressed on; the panel carries the day it was
 * pressed on in its Date field instead, and mounting a `fixed` panel in a day
 * box would only decide which element it is removed with.
 */
export function openAddEditor(request: Partial<EditorRequest> = {}): void {
  const { container: _ignored, where: _also, ...rest } = request;
  openEditor({
    heading: "Add",
    submitLabel: "Add",
    quick: { anchor: quickAnchor() },
    ...rest,
    values: { date: viewedDate(), kind: "assignment", ...(request.values ?? {}) },
  });
}

/**
 * The header's "+": the complete form, as a screen.
 *
 * What the quick panel drops is Event (it offers only Assignment and Exam),
 * the end time, the link, and "No date yet" — and this is where they still
 * are. It is on the bar rather than on the list, so it is the one add that
 * Alerts and Exams also have; removing it would leave those two tabs with no
 * way to type a row at all.
 */
export function openFullAdd(): void {
  openEditor({
    where: "end",
    heading: "Add a deadline",
    submitLabel: "Add it",
    intro:
      "For work no site lists — a paper problem set, an office-hours slot, " +
      "something a TA said out loud. It sits in the list like everything else, " +
      "and no sync can overwrite it.",
    values: { date: viewedDate(), kind: "assignment" },
  });
}

/**
 * Editing a row, in the same panel adding one uses (2026-09-19).
 *
 * Sushi: "the edit is too large." It was the full screen — `#view` replaced by
 * a document-height form with TITLE, COURSE, KIND, DATE, TIME, the "No date
 * yet" toggle, "More" and a full-width Save — while *adding* a row, since this
 * morning, is a 336px panel over the list. One form at two sizes, and the
 * bigger one is the one a student reaches by pressing Edit on a row they can
 * see, which then disappears.
 *
 * So edit takes the panel. What it does **not** take is the panel's four-field
 * shape: an edit legitimately needs Kind and "No date yet" — a student editing
 * an exam must not have it silently saved as a deadline, and D11's toggle is
 * the only way to take a date *off* a row — and neither has any other surface.
 * `fields: "full"` is the panel with all of them, which is why that flag exists
 * separately from `quick`.
 *
 * **What now takes an extra press:** Ends and Link, which are behind "More" —
 * the same fold, and the same one press, as on the screen this replaces.
 * Nothing that was reachable has become unreachable, and nothing has moved
 * further away than it already was.
 *
 * The heading is short now. The screen's `Edit “<title>”` was drawn in a
 * 400px-wide bar; the panel's is 314px inside, and a title of any length there
 * wraps the bar to three lines before a single field is on screen. The row's
 * own title is on the list behind the panel, and the panel is a `dialog` whose
 * accessible name is this string — "Edit deadline" is what it is.
 */
export function openEditEditor(item: Item, member: Item["members"][number]): void {
  void item;
  openEditor({
    heading: "Edit deadline",
    submitLabel: "Save",
    quick: { anchor: quickAnchor() },
    fields: "full",
    values: valuesOfMember(member),
    sourceId: member.sourceId,
  });
}

/* -------------------------------------------------------------------------- */
/* "Give it a date" (brief D3)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The same form, for a row that has no date — whoever listed it.
 *
 * Two different saves behind one screen, because a *source* row has no field of
 * its own to write: the next sync replaces the whole `RawItem`, so a date typed
 * here would survive about five minutes. It goes into the same `dueOverrides`
 * record an announcement writes, through `set-due` → `studentDueOverride`.
 *
 * A row the student typed themselves is an ordinary edit, and every field on it
 * is theirs to change.
 */
export function openGiveDate(item: Item): void {
  const mine = soleManualMember(item);
  if (mine) {
    openEditor({
      heading: "Give it a date",
      submitLabel: "Save",
      values: { ...valuesOfMember(mine), date: viewedDate() },
      sourceId: mine.sourceId,
    });
    return;
  }
  const source = item.members[0]?.source;
  openEditor({
    heading: "Give it a date",
    submitLabel: "Save",
    intro:
      `${source ? SOURCE_NAME[source] : "The source"} lists this without a date. ` +
      "What you type here is yours: the next sync will not overwrite it, and the " +
      "row's undo puts it back.",
    values: {
      title: item.title,
      courseRaw: item.members[0]?.courseRaw ?? item.courseLabel,
      date: viewedDate(),
      kind: item.kind,
    },
    // Not `saveManual`: there is no manual row to save. The override goes
    // through the worker's `set-due`, which builds the entry with
    // `studentDueOverride` and keys it to every member of the row.
    save: async (values) => {
      // Logged on this side, because the popup's console and the worker's are
      // different windows (UI rule 2's neighbour).
      console.log(`[illini-dash] set-due requested for ${item.id}`);
      const response = await send({
        type: "override",
        action: {
          kind: "set-due",
          itemId: item.id,
          date: values.date,
          ...(values.time ? { time: values.time } : {}),
        },
      });
      if (response.type === "error") throw new Error(response.message);
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Delete, and ten seconds to change your mind                                 */
/* -------------------------------------------------------------------------- */

export function clearUndo(): void {
  state.pendingUndo = undefined;
  if (state.undoTimer !== undefined) clearTimeout(state.undoTimer);
  state.undoTimer = undefined;
}

export function deleteManual(
  item: Item,
  member: Item["members"][number],
  entry: HTMLElement,
): void {
  // Said on the control that was pressed, before anything can go wrong — the
  // same reason `applyOverrideAction` does it (UI house rule 4).
  entry.replaceChildren(icon("sync"), document.createTextNode("Deleting…"));
  for (const other of entry.parentElement?.querySelectorAll("button") ?? []) {
    (other as HTMLButtonElement).disabled = true;
  }
  console.log(`[illini-dash] delete requested for manual:${member.sourceId}`);
  const values = valuesOfMember(member);
  void send({ type: "delete-manual-item", sourceId: member.sourceId })
    .then((response) => {
      if (response.type === "error") {
        showStatus(response.message);
        return;
      }
      clearUndo();
      state.pendingUndo = { title: item.title, values, until: Date.now() + UNDO_MS };
      state.undoTimer = setTimeout(() => {
        clearUndo();
        void app.refresh();
      }, UNDO_MS);
    })
    .catch((err: unknown) => {
      showStatus(
        `Could not delete that deadline: ${err instanceof Error ? err.message : String(err)}`,
      );
    })
    .finally(() => {
      closeMenus();
      void app.refresh();
    });
}

export function undoDelete(): void {
  const undo = state.pendingUndo;
  if (!undo) return;
  clearUndo();
  console.log(`[illini-dash] undo delete requested for “${undo.title}”`);
  void saveManual(undo.values)
    .catch((err: unknown) => {
      showStatus(
        `Could not put that deadline back: ${err instanceof Error ? err.message : String(err)}`,
      );
    })
    .finally(() => void app.refresh());
}

/* -------------------------------------------------------------------------- */
/* Late-bound wiring                                                           */
/* -------------------------------------------------------------------------- */

/*
 * The header's "+" lives in `shell.ts`, which this file imports — so it cannot
 * import back, and the call goes through the registry like the row menu's two
 * (state.ts, "Late-bound wiring"). Assigned here rather than at the bottom of
 * `popup.ts` beside its neighbours only because this module owns both ends of
 * it; `popup.ts` imports this file, so the assignment has run before anything
 * draws.
 */
app.openFullAdd = () => openFullAdd();
