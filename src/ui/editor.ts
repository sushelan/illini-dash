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

import { icon, iconButton } from "./icons.js";
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
  /**
   * The five-field shape (Sushi, 2026-09-19: "it should just be a small popup
   * for date, time, name, course, and add/cancel").
   *
   * Date, Time, Title, Course and an Assignment / Exam switch (added
   * 2026-09-23), and nothing else: no Event, no end time, no link, no "No date
   * yet". The controls those four would need are still
   * *built* — `read()` and `setTimes` are one implementation for both shapes,
   * and a second copy of `read()` is how this file's rules go stale — but they
   * are not appended, so nothing unappended can be typed into. What that costs
   * a student, and the route back to it, is written down in
   * `screens/editor.ts`.
   *
   * The one thing that must not be inherited from the full form is the error
   * slots: a sentence routed to a field that is not on screen would appear
   * nowhere at all, which is the failure the doc comment above calls worse
   * than the bug. `errors` below holds only the fields this shape shows, and
   * everything else falls to the form-level slot.
   */
  compact?: boolean;
  /** "Add a deadline" / "Edit this deadline". */
  heading: string;
  /** The word on the button that saves: "Add it" or "Save". */
  submitLabel: string;
  /**
   * The sentence under the bar (mock 2b), when the caller has one.
   *
   * Optional because an *edit* has nothing to explain — the student is looking
   * at a row they typed — while the add form is the one surface where "what is
   * this for" is a real question.
   */
  intro?: string;
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
 * The class the quick shape's stylesheet keys off, and the one a test looks
 * for. One constant, so the selector and the thing it matches cannot drift
 * apart (UI house rule 7).
 */
export const QUICK_SELECTOR = ".editor--quick";
const QUICK_CLASS = QUICK_SELECTOR.slice(1);

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

/** The quick panel's two, in the words Sushi used for them. */
const QUICK_KINDS: readonly { value: Kind; label: string }[] = [
  { value: "assignment", label: "Assignment" },
  { value: "exam", label: "Exam" },
];

/** The quick panel's Assignment / Exam switch. One constant (UI house rule 7). */
export const KIND_PICK_SELECTOR = ".editor--kindpick";
const KIND_PICK_CLASS = KIND_PICK_SELECTOR.slice(1);

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
  // Since D11's toggle, a time with no day is a state the form can be left in
  // by hand — clearing the date and not the clock — so the sentence that
  // refuses it belongs beside the date rather than at the foot of the form.
  { test: /^Give this a date\b/, field: "date" },
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
  const compact = options.compact === true;
  const form = document.createElement("form");
  form.className = EDITOR_CLASS;
  if (compact) form.classList.add(QUICK_CLASS);
  // Chrome's own validation bubbles would compete with the sentences
  // `core/manual.ts` writes, and say less: "Please fill out this field" over a
  // form whose refusals are written to say what to do.
  form.noValidate = true;

  /*
   * The screen bar (mock 2b): ‹ back, the heading, ×.
   *
   * Two controls that do the same thing, deliberately. ‹ is where every
   * sub-screen in this popup puts "leave", and × is what a form is expected to
   * carry; a student who learns either one is right. Both are `Cancel`, which
   * is the one path that also runs the caller's `onClose`.
   */
  const head = document.createElement("div");
  head.className = "editor--head screen-bar";
  if (compact) {
    /*
     * No ‹ and no ×. The quick shape is not a screen — there is nothing to go
     * back *to* — and Cancel is two fields below the place × would sit, which
     * is a second dismiss in a panel small enough to see both at once. The
     * heading stays because the panel is a `dialog` and a dialog with no
     * accessible name announces as nothing.
     */
    const quickTitle = document.createElement("h2");
    quickTitle.className = "editor--title screen-bar--title";
    quickTitle.textContent = options.heading;
    head.append(quickTitle);
    form.append(head);
  } else {
  const back = iconButton("left", "Back");
  back.addEventListener("click", () => options.onCancel());
  const heading = document.createElement("h2");
  heading.className = "editor--title screen-bar--title";
  heading.textContent = options.heading;
  const dismiss = iconButton("close", "Close this form");
  dismiss.addEventListener("click", () => options.onCancel());
  head.append(back, heading, dismiss);
  form.append(head);
  }

  if (options.intro && !compact) {
    const intro = document.createElement("p");
    intro.className = "editor--intro";
    intro.textContent = options.intro;
    form.append(intro);
  }

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
  const courseField = labelled("Course", course);
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

  /*
   * "No date yet" (brief D11), as a real checkbox with `role="switch"`.
   *
   * Not a `<div>` painted to look like the mock's toggle: this is the control
   * that decides whether a deadline lands on the calendar at all, and a div
   * cannot be tabbed to, cannot be pressed with the space bar and announces as
   * nothing. `.switch` in `ui.css` already draws a checkbox as a toggle.
   *
   * It *disables* Date and Time rather than clearing them, so a student who
   * turns it on by mistake gets the date they typed back when they turn it off.
   * `read()` below is what makes the promise true: a disabled field's value is
   * not a value the student stated.
   */
  const noDateWrap = document.createElement("label");
  noDateWrap.className = "editor--field-wide editor--nodate";
  const noDate = document.createElement("input");
  noDate.type = "checkbox";
  noDate.className = "switch";
  noDate.setAttribute("role", "switch");
  noDate.dataset["field"] = "noDate";
  // An edit of a row that has no date opens with the toggle already on: the
  // form would otherwise show whatever day the list was looking at and save it
  // as a deadline the student never typed.
  noDate.checked = options.values.date === "";
  // Never on in the quick shape, whatever it was opened with. The toggle is not
  // drawn there, and `read()` lets it win over both clock fields — so a quick
  // panel opened with a blank date would disable its own Date and Time boxes
  // with nothing on screen to turn them back on.
  if (compact) noDate.checked = false;
  const noDateText = document.createElement("span");
  noDateText.className = "editor--nodate-text";
  const noDateTitle = document.createElement("b");
  noDateTitle.textContent = "No date yet";
  const noDateNote = document.createElement("span");
  noDateNote.textContent = "Puts it on the No date tab instead of the calendar.";
  noDateText.append(noDateTitle, noDateNote);
  noDateWrap.append(noDate, noDateText);

  /*
   * End time and Link, folded away.
   *
   * `<details>`, not a button that toggles a class: it is open or closed with
   * no script, it is in the tab order, and it contributes its own height to the
   * document both ways — which is what Chrome measures the popup by.
   */
  const more = document.createElement("details");
  more.className = "editor--more editor--field-wide";
  const moreSummary = document.createElement("summary");
  moreSummary.textContent = "More";
  const moreGrid = document.createElement("div");
  moreGrid.className = "editor--more-grid";
  moreGrid.append(endField.wrap, urlField.wrap);
  more.append(moreSummary, moreGrid);

  /*
   * Assignment or Exam, for the quick panel (Sushi, 2026-09-23): *"if a
   * student wants to add something, they should be able to click on an option
   * saying if its an assignment or exam cuz the exam should show up in the
   * section"*. The quick panel had dropped Kind, so a typed exam was a Deadline
   * and never reached the Exams tab.
   *
   * Two radios rather than the full form's `<select>`: two choices, one press,
   * both visible. They write through to `kind` and fire its `change`, so
   * `read()` and `syncKind` keep one source of truth. Event is left to the full
   * form — it was not asked for here, and every pixel of this panel is height
   * the popup has to find room for.
   */
  const kindPick = document.createElement("fieldset");
  kindPick.className = `${KIND_PICK_CLASS} editor--field-wide`;
  const kindLegend = document.createElement("legend");
  kindLegend.className = "editor--label";
  kindLegend.textContent = "Kind";
  kindPick.append(kindLegend);
  const pickName = `kind-${Math.random().toString(36).slice(2)}`;
  for (const option of QUICK_KINDS) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = pickName;
    radio.value = option.value;
    radio.checked = kind.value === option.value;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      kind.value = option.value;
      kind.dispatchEvent(new Event("change"));
    });
    const text = document.createElement("span");
    text.textContent = option.label;
    label.append(radio, text);
    kindPick.append(label);
  }

  if (compact) {
    // The order Sushi named them in — "date, time, name, course" — which is
    // also the order they are decided in: the day is what the "+" was pressed
    // on, and the title is what the student came to type.
    // Course takes the width in this shape: Date and Time share the first row,
    // and a course name beside half a row of nothing reads as a missing field.
    courseField.wrap.classList.add("editor--field-wide");
    grid.append(dateField.wrap, timeField.wrap, titleField.wrap, courseField.wrap, kindPick);
  } else {
    // Mock 2b's order: Title across the top, then Course / Kind and Date / Time
    // in two columns, the toggle under them, and everything rarer behind "More".
    grid.append(
      titleField.wrap,
      courseField.wrap,
      kindField.wrap,
      dateField.wrap,
      timeField.wrap,
      noDateWrap,
      more,
    );
  }

  /*
   * Only the slots that are on screen.
   *
   * A refusal routed to a field this shape does not draw would be written into
   * a `<label>` that was never appended — visible nowhere, which is strictly
   * worse than the same sentence at the foot of the form. `showError` falls
   * back to `formError` for anything missing here.
   */
  const errors: Record<string, HTMLElement> = compact
    ? {
        title: titleField.error,
        courseRaw: courseField.error,
        date: dateField.error,
        time: timeField.error,
      }
    : {
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
  // Mock 2b: the filled button takes the width it needs and Cancel sits beside
  // it, rather than both being pushed to the right edge. The primary action on
  // a sub-screen is the thing the screen is for.
  save.classList.add("editor--save");
  actions.append(save, cancel);
  form.append(actions);

  const read = (): EditorValues => ({
    title: title.value,
    courseRaw: course.value,
    // The toggle wins over both clock fields. `core/manual.ts` accepts a row
    // with no date and refuses a time with no day, so sending the date the
    // student left in a disabled box would be sending a deadline they had just
    // said they did not have.
    date: noDate.checked ? "" : date.value,
    time: noDate.checked ? "" : time.value,
    // An end time on a kind that does not show the field is not a value the
    // student stated — it is one left behind by a kind they changed away from,
    // and sending it would build a span nobody asked for.
    endTime: SPANNING.has(kind.value as Kind) ? endTime.value : "",
    kind: (kind.value || "assignment") as Kind,
    url: url.value,
  });

  const changed = (): void => options.onChange?.(read());

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
    // A field folded under "More" has to be unfolded before its refusal can be
    // read — `<details>` hides its content from focus as well as from sight
    // (R1 F120: four of manual.ts's sentences were being swallowed).
    const fold = control?.closest("details");
    if (fold) fold.open = true;
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

  const syncNoDate = (): void => {
    date.disabled = noDate.checked;
    time.disabled = noDate.checked;
    dateField.wrap.classList.toggle("is-off", noDate.checked);
    timeField.wrap.classList.toggle("is-off", noDate.checked);
  };
  syncNoDate();
  noDate.addEventListener("change", () => {
    syncNoDate();
    changed();
  });

  const syncKind = (): void => {
    // Hidden rather than removed: a `<label>` taken out of the grid re-flows
    // the three columns beside it, so the date moves when the kind changes.
    endField.wrap.hidden = !SPANNING.has(kind.value as Kind);
  };
  syncKind();

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
