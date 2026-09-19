/**
 * Typing a deadline in, editing one, deleting one, and taking that back.
 *
 * The form itself is `src/ui/editor.ts`, which knows nothing about the popup;
 * this is the part that decides where it goes, what it is prefilled with, and
 * what happens to the answer.
 */

import { createEditor, type EditorValues } from "../../editor.js";
import { coursesIn, dayKey } from "../../../core/calendar.js";
import { courseLabel, SOURCE_NAME } from "../../../core/names.js";
import { icon } from "../../icons.js";
import { send } from "../../../messages.js";
import type { Item } from "../../../sources/types.js";
import { UNDO_MS, app, state, viewedDate, viewEl } from "../state.js";
import { closeMenus, showStatus, soleManualMember } from "../shell.js";
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
  const handle = createEditor({
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

/** The header's "+", and the week and month "+"s, all end up here. */
export function openAddEditor(request: Partial<EditorRequest> = {}): void {
  openEditor({
    where: "end",
    heading: "Add a deadline",
    submitLabel: "Add it",
    intro:
      "For work no site lists — a paper problem set, an office-hours slot, " +
      "something a TA said out loud. It sits in the list like everything else, " +
      "and no sync can overwrite it.",
    ...request,
    values: { date: viewedDate(), kind: "assignment", ...(request.values ?? {}) },
  });
}

export function openEditEditor(item: Item, member: Item["members"][number]): void {
  openEditor({
    heading: `Edit “${item.title}”`,
    submitLabel: "Save",
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
