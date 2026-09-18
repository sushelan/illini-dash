/**
 * The form a student types a deadline into (§3's `manual` source).
 *
 * **DOM only.** Every rule about what a date is, what a blank time means and
 * which links may be opened lives in `core/manual.ts`, where the suite can
 * mutate it — this file collects strings, hands them to the worker, and shows
 * the sentence that comes back. A second copy of any of those checks here is
 * the shape this codebase's defects keep taking: the later copy is written from
 * memory and forgets one of them (house rules, parser rule 5).
 *
 * Three things here are decisions about the *form* rather than about the data,
 * and each is load-bearing:
 *
 * 1. **`<input type="date">` and `<input type="time">`, not text boxes.** Their
 *    `value` is `YYYY-MM-DD` and `HH:MM` on a 24-hour clock whatever the
 *    browser's locale displays — which is exactly what `ManualInput` wants. A
 *    text box would need a parser on this side to get there, and that parser
 *    would be the second copy of `core/manual.ts`'s anchored regexes.
 * 2. **It renders in flow.** In the popup a floating panel contributes nothing
 *    to the document's height, and Chrome sizes an extension popup by measuring
 *    exactly that (CLAUDE.md, "The popup is measured by Chrome"). An editor
 *    that opened over the list would be clipped by the 600px ceiling with no
 *    way to scroll to its Save button. Pushing the rows down costs nothing and
 *    cannot be clipped.
 * 3. **A refusal is shown beside the field it is about, and never only there.**
 *    `ManualItemError` carries a sentence and not a field name, so the routing
 *    below matches the sentences `core/manual.ts` actually produces, anchored
 *    at the start (house rule 6 — a substring match on "time" would put the
 *    end-time complaint on the start-time field). A sentence that matches none
 *    of them still appears, at the foot of the form: the failure mode to avoid
 *    is a refusal with nowhere to go, not a refusal in the wrong place.
 */

import { icon } from "./icons.js";
import type { Kind } from "../sources/types.js";

/** Exactly what the editor holds, as strings. `core/manual.ts` judges them. */
export interface EditorValues {
  title: string;
  courseRaw: string;
  /** `YYYY-MM-DD`, from `<input type="date">`. */
  date: string;
  /** `HH:MM` or `""`. Blank is "by end of day" — `manual.ts` decides what that means. */
  time: string;
  endTime: string;
  kind: Kind;
  url: string;
}

export interface EditorOptions {
  /** "Add a deadline" / "Edit this deadline". */
  heading: string;
  /** The word on the button that saves: "Add" or "Save". */
  submitLabel: string;
  /** Course labels currently on screen, offered as suggestions, not a closed list. */
  courses: readonly string[];
  values: Partial<EditorValues>;
  /**
   * Rejects with the sentence to show. Resolving closes the editor; the caller
   * does the closing, because it also owns the redraw that follows.
   */
  onSave: (values: EditorValues) => Promise<void>;
  onCancel: () => void;
  /** Every keystroke in a field that moves the ghost box on the day grid. */
  onChange?: (values: EditorValues) => void;
}

export interface Editor {
  el: HTMLElement;
  focus: () => void;
  values: () => EditorValues;
  /** The drag moved: put these on the clock fields without firing `onChange` back. */
  setTimes: (time: string, endTime: string) => void;
  /** Anything typed that has not been saved. The redraw guard asks this. */
  isDirty: () => boolean;
}

/** The class a redraw guard looks for. One constant, so no caller can misspell it. */
export const EDITOR_SELECTOR = ".editor";
const EDITOR_CLASS = EDITOR_SELECTOR.slice(1);

/**
 * The three kinds a student can pick, and what §3 calls them.
 *
 * Not all six `Kind`s: `booking` is PrairieTest's own idea and `quiz` and
 * `other` are distinctions a student typing a row does not need to make. The
 * word on the left is what they would say out loud; the value on the right is
 * what the rest of the extension already means by it.
 */
const KIND_OPTIONS: readonly { value: Kind; label: string }[] = [
  { value: "assignment", label: "Deadline" },
  { value: "event", label: "Event" },
  { value: "exam", label: "Exam" },
];

/** The kinds that occupy a span rather than a moment, so an end time is offered. */
const SPANNING: ReadonlySet<Kind> = new Set<Kind>(["event", "exam"]);

/**
 * Which field a refusal belongs beside.
 *
 * Anchored at the start and matched against the sentences in `core/manual.ts`.
 * When that file's wording changes this routing goes stale *quietly* — the
 * sentence then shows at the foot of the form instead of beside its field,
 * which is a worse form and not a lost error. That is the failure this is
 * allowed to have; silently swallowing the sentence is not.
 */
const ERROR_FIELD: readonly { test: RegExp; field: keyof EditorValues }[] = [
  { test: /^Give this deadline a title\b/, field: "title" },
  { test: /^A title can be at most\b/, field: "title" },
  { test: /^Say which course this is for\b/, field: "courseRaw" },
  { test: /^A course name can be at most\b/, field: "courseRaw" },
  { test: /^Give the date as\b/, field: "date" },
  { test: /^There is no such date as\b/, field: "date" },
  { test: /^Give the time as\b/, field: "time" },
  { test: /^Give the end time as\b/, field: "endTime" },
  { test: /^The end time has to be after\b/, field: "endTime" },
  { test: /^That link is not a web address\b/, field: "url" },
  { test: /^A link has to start with\b/, field: "url" },
];

function fieldFor(message: string): keyof EditorValues | undefined {
  return ERROR_FIELD.find((entry) => entry.test.test(message))?.field;
}

/** One labelled control, with somewhere for its refusal to go. */
function labelled(
  labelText: string,
  control: HTMLElement,
  options: { wide?: boolean } = {},
): { wrap: HTMLElement; error: HTMLElement } {
  const wrap = document.createElement("label");
  wrap.className = "editor--field";
  if (options.wide) wrap.classList.add("editor--field-wide");
  const label = document.createElement("span");
  label.className = "editor--label";
  label.textContent = labelText;
  const error = document.createElement("span");
  error.className = "editor--error";
  error.hidden = true;
  wrap.append(label, control, error);
  return { wrap, error };
}

let datalistSeq = 0;

export function createEditor(options: EditorOptions): Editor {
  const form = document.createElement("form");
  form.className = EDITOR_CLASS;
  // Chrome's own validation bubbles would compete with the sentences
  // `core/manual.ts` writes, and say less: "Please fill out this field" over a
  // form whose refusals are written to say what to do.
  form.noValidate = true;

  const head = document.createElement("div");
  head.className = "editor--head";
  const heading = document.createElement("h2");
  heading.className = "editor--title";
  heading.textContent = options.heading;
  head.append(heading);
  form.append(head);

  const grid = document.createElement("div");
  grid.className = "editor--grid";
  form.append(grid);

  const title = document.createElement("input");
  title.type = "text";
  title.className = "field";
  title.placeholder = "What is due";
  title.value = options.values.title ?? "";
  const titleField = labelled("Title", title, { wide: true });

  const course = document.createElement("input");
  course.type = "text";
  course.className = "field";
  course.placeholder = "CS 357";
  course.value = options.values.courseRaw ?? "";
  // A suggestion list, not a closed one: a student may be typing a deadline for
  // a course no source has ever listed, which is half of what this feature is
  // for. `<datalist>` suggests and still accepts anything.
  const list = document.createElement("datalist");
  datalistSeq += 1;
  list.id = `editor-courses-${datalistSeq}`;
  for (const label of options.courses) {
    const option = document.createElement("option");
    option.value = label;
    list.append(option);
  }
  course.setAttribute("list", list.id);
  const courseField = labelled("Course", course, { wide: true });
  courseField.wrap.append(list);

  const date = document.createElement("input");
  date.type = "date";
  date.className = "field";
  date.value = options.values.date ?? "";
  const dateField = labelled("Date", date);

  const time = document.createElement("input");
  time.type = "time";
  time.className = "field";
  time.value = options.values.time ?? "";
  const timeField = labelled("Time", time);
  // The whole of worker rule 3 in one tooltip: a blank here is not midnight,
  // and what fills it in is marked as invented so §5.3 never ranks it above a
  // deadline a source actually stated.
  timeField.wrap.title = "Leave blank for “by end of day”.";

  const endTime = document.createElement("input");
  endTime.type = "time";
  endTime.className = "field";
  endTime.value = options.values.endTime ?? "";
  const endField = labelled("Ends", endTime);

  const kind = document.createElement("select");
  kind.className = "field";
  for (const option of KIND_OPTIONS) {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    kind.append(el);
  }
  kind.value = options.values.kind ?? "assignment";
  // A kind outside the three offered — an exam row being edited is fine, but a
  // `booking` is not one of the options, and `select.value = "booking"` leaves
  // the control blank. Fall back rather than showing an empty control.
  if (kind.value === "") kind.value = "assignment";
  const kindField = labelled("Kind", kind);

  const url = document.createElement("input");
  url.type = "text";
  url.className = "field";
  url.placeholder = "https://…";
  url.value = options.values.url ?? "";
  const urlField = labelled("Link", url, { wide: true });

  grid.append(
    titleField.wrap,
    courseField.wrap,
    dateField.wrap,
    timeField.wrap,
    endField.wrap,
    kindField.wrap,
    urlField.wrap,
  );

  const errors: Record<string, HTMLElement> = {
    title: titleField.error,
    courseRaw: courseField.error,
    date: dateField.error,
    time: timeField.error,
    endTime: endField.error,
    kind: kindField.error,
    url: urlField.error,
  };

  const formError = document.createElement("p");
  formError.className = "editor--error editor--error-form";
  formError.hidden = true;
  form.append(formError);

  const actions = document.createElement("div");
  actions.className = "editor--actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "btn btn-primary btn-sm";
  save.textContent = options.submitLabel;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-quiet btn-sm";
  cancel.textContent = "Cancel";
  actions.append(cancel, save);
  form.append(actions);

  const read = (): EditorValues => ({
    title: title.value,
    courseRaw: course.value,
    date: date.value,
    time: time.value,
    // An end time on a kind that does not show the field is not a value the
    // student stated — it is one left behind by a kind they changed away from,
    // and sending it would build a span nobody asked for.
    endTime: SPANNING.has(kind.value as Kind) ? endTime.value : "",
    kind: (kind.value || "assignment") as Kind,
    url: url.value,
  });

  const opened = read();
  const clearErrors = (): void => {
    for (const slot of Object.values(errors)) {
      slot.hidden = true;
      slot.textContent = "";
    }
    formError.hidden = true;
    formError.textContent = "";
  };

  const showError = (message: string): void => {
    clearErrors();
    const field = fieldFor(message);
    const slot = field ? errors[field] : undefined;
    const target = slot ?? formError;
    target.textContent = message;
    target.hidden = false;
    // Focus goes to the field being complained about, so a refusal on a form
    // that has scrolled is not a red sentence somewhere off screen.
    const control = field ? (grid.querySelector(`[data-field="${field}"]`) as HTMLElement | null) : null;
    control?.focus();
  };

  for (const [name, control] of [
    ["title", title],
    ["courseRaw", course],
    ["date", date],
    ["time", time],
    ["endTime", endTime],
    ["kind", kind],
    ["url", url],
  ] as const) {
    control.dataset["field"] = name;
  }

  const syncKind = (): void => {
    // Hidden rather than removed: a `<label>` taken out of the grid re-flows
    // the three columns beside it, so the date moves when the kind changes.
    endField.wrap.hidden = !SPANNING.has(kind.value as Kind);
  };
  syncKind();

  const changed = (): void => options.onChange?.(read());
  for (const control of [date, time, endTime]) {
    control.addEventListener("input", changed);
  }
  kind.addEventListener("change", () => {
    syncKind();
    changed();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors();
    save.disabled = true;
    cancel.disabled = true;
    // Said on the control that was pressed. UI house rule 4: this is feedback
    // and a diagnostic at once — if the word never appears, the submit handler
    // never ran, which is a different bug from a round trip that failed.
    const word = save.textContent ?? "";
    save.replaceChildren(icon("sync"), document.createTextNode("Saving…"));
    options
      .onSave(read())
      .catch((err: unknown) => {
        showError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        // The editor may already be gone: a save that worked closes it, and
        // writing to a detached button is harmless but pointless.
        if (!form.isConnected) return;
        save.disabled = false;
        cancel.disabled = false;
        save.replaceChildren(document.createTextNode(word));
      });
  });

  cancel.addEventListener("click", () => options.onCancel());

  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      // Stopped here: the document-level Escape handler closes menus and moves
      // focus, and both would happen behind this form rather than to it.
      event.preventDefault();
      event.stopPropagation();
      options.onCancel();
      return;
    }
    // Enter saves, from any single-line field. `requestSubmit` runs the submit
    // handler above rather than bypassing it the way `submit()` does.
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  /*
   * A click inside the editor is not a click on the page.
   *
   * `document`'s click listener closes every menu, and the day grid's own
   * pointer handler starts a drag. Neither should happen because somebody
   * pressed a text box that is sitting on top of them.
   */
  form.addEventListener("click", (event) => event.stopPropagation());
  form.addEventListener("pointerdown", (event) => event.stopPropagation());

  return {
    el: form,
    focus: () => {
      // The title, always — even on an edit, where it is the field most likely
      // to be the reason for the edit, and the only one a student can act on
      // without first reading the rest of the form.
      title.focus();
      title.select();
    },
    values: read,
    setTimes: (next: string, nextEnd: string) => {
      time.value = next;
      if (SPANNING.has(kind.value as Kind)) endTime.value = nextEnd;
    },
    isDirty: () => {
      const now = read();
      return (Object.keys(now) as (keyof EditorValues)[]).some((key) => now[key] !== opened[key]);
    },
  };
}
