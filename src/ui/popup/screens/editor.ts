/**
 * Typing a deadline in, editing one, deleting one, and taking that back.
 *
 * The form itself is `src/ui/editor.ts`, which knows nothing about the popup;
 * this is the part that decides where it goes, what it is prefilled with, and
 * what happens to the answer.
 */

import { createEditor, type EditorValues } from "../../editor.js";
import { coursesIn, dayKey } from "../../../core/calendar.js";
import { courseLabel } from "../../../core/names.js";
import { icon } from "../../icons.js";
import { send } from "../../../messages.js";
import type { Item } from "../../../sources/types.js";
import { UNDO_MS, app, state, viewedDate, viewEl } from "../state.js";
import { closeMenus, showStatus } from "../shell.js";

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
    date: dated ? dayKey(due!) : viewedDate(),
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
  const response = await send(
    sourceId === undefined
      ? { type: "add-manual-item", input }
      : { type: "edit-manual-item", sourceId, input },
  );
  if (response.type === "error") throw new Error(response.message);
}

export interface EditorRequest {
  /** Where the form goes. In the popup this is always a node already in flow. */
  container: HTMLElement;
  where?: "start" | "end";
  heading: string;
  submitLabel: string;
  values: Partial<EditorValues>;
  /** Present when this is an edit rather than a new row. */
  sourceId?: string;
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
  if (state.redrawAfterEditor) {
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
    ...(request.onChange ? { onChange: request.onChange } : {}),
    onSave: async (values) => {
      await saveManual(values, request.sourceId);
      closeEditor();
      // Not deferred: the form is gone, and the row it just created is the
      // whole point of having pressed Save.
      await app.refresh();
    },
    onCancel: () => closeEditor(),
  });
  state.editor = { handle, el: handle.el };
  state.editorOnClose = request.onClose;
  if (request.where === "end") request.container.append(handle.el);
  else request.container.prepend(handle.el);
  handle.focus();
  // The form is taller than most rows, and in the week and month views it opens
  // well down a document that may be scrolled. `nearest`, so a form already in
  // view does not move the page under the pointer that opened it.
  handle.el.scrollIntoView({ block: "nearest" });
}

/** The header's "+", and the week and month "+"s, all end up here. */
export function openAddEditor(request: Partial<EditorRequest> = {}): void {
  openEditor({
    container: viewEl,
    where: "start",
    heading: "Add a deadline",
    submitLabel: "Add",
    ...request,
    values: { date: viewedDate(), kind: "assignment", ...(request.values ?? {}) },
  });
}

export function openEditEditor(item: Item, member: Item["members"][number]): void {
  openEditor({
    container: viewEl,
    where: "start",
    heading: `Edit “${item.title}”`,
    submitLabel: "Save",
    values: valuesOfMember(member),
    sourceId: member.sourceId,
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
  void saveManual(undo.values)
    .catch((err: unknown) => {
      showStatus(
        `Could not put that deadline back: ${err instanceof Error ? err.message : String(err)}`,
      );
    })
    .finally(() => void app.refresh());
}
