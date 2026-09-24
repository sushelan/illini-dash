/**
 * The quick panel's Assignment / Exam switch.
 *
 * Sushi, 2026-09-23: "if a student wants to add something, they should be able
 * to click on an option saying if its an assignment or exam cuz the exam should
 * show up in the section". The quick panel had no Kind, so every row typed there
 * was an assignment and none could reach the Exams tab.
 */
import { parseHTML } from "linkedom";
import { beforeAll, describe, expect, it } from "vitest";

let createEditor: typeof import("../src/ui/editor.js").createEditor;
let KIND_PICK_SELECTOR: string;

beforeAll(async () => {
  const { window } = parseHTML("<!doctype html><html><body></body></html>");
  Object.assign(globalThis, {
    document: window.document,
    Event: window.Event,
    HTMLElement: window.HTMLElement,
  });
  // linkedom leaves `<select>.value` read-only (the same gap popup-draw.test.ts
  // shims). This one keeps the spec's rule that a value no option carries
  // leaves the control blank, because the editor's fallback reads that.
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    get(this: Element) {
      return this.getAttribute("data-value") ?? "";
    },
    set(this: Element, next: string) {
      const known = Array.from(this.querySelectorAll("option")).some(
        (option) => option.getAttribute("value") === next,
      );
      this.setAttribute("data-value", known ? next : "");
    },
    configurable: true,
  });
  ({ createEditor, KIND_PICK_SELECTOR } = await import("../src/ui/editor.js"));
});

function quick(kind?: "assignment" | "exam") {
  return createEditor({
    compact: true,
    heading: "Add",
    submitLabel: "Add",
    courses: [],
    values: { date: "2026-09-24", ...(kind ? { kind } : {}) },
    onSave: async () => {},
    onCancel: () => {},
  });
}

function radios(editor: ReturnType<typeof quick>): HTMLInputElement[] {
  const pick = editor.el.querySelector(KIND_PICK_SELECTOR);
  expect(pick).not.toBeNull();
  return Array.from(pick!.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
}

describe("quick add — Assignment or Exam", () => {
  it("offers exactly Assignment and Exam, in that order", () => {
    const labels = radios(quick()).map((r) => r.parentElement!.textContent);
    expect(labels).toEqual(["Assignment", "Exam"]);
  });

  it("starts on Assignment", () => {
    const editor = quick();
    expect(radios(editor).find((r) => r.checked)?.value).toBe("assignment");
    expect(editor.values().kind).toBe("assignment");
  });

  it("saves an exam when Exam is picked", () => {
    const editor = quick();
    const exam = radios(editor).find((r) => r.value === "exam")!;
    exam.checked = true;
    exam.dispatchEvent(new Event("change"));
    expect(editor.values().kind).toBe("exam");
  });

  it("goes back to an assignment when Assignment is picked again", () => {
    const editor = quick("exam");
    const assignment = radios(editor).find((r) => r.value === "assignment")!;
    assignment.checked = true;
    assignment.dispatchEvent(new Event("change"));
    expect(editor.values().kind).toBe("assignment");
  });

  it("shows the kind it was opened with", () => {
    expect(radios(quick("exam")).find((r) => r.checked)?.value).toBe("exam");
  });

  it("gives the two radios one group, so picking one clears the other", () => {
    // The attribute, not `.name`: linkedom answers `undefined` for the
    // property, which a `not.toBe("")` would wave through.
    const names = radios(quick()).map((r) => r.getAttribute("name"));
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toMatch(/^kind-\w+$/);
  });
});
