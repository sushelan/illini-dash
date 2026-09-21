/**
 * The Course websites list, rendered, and asserted over as a student sees it.
 *
 * Until 2026-09-21 this rendering had **no DOM test at all** — `site.test.ts`
 * covers `courseGroupsForYou`, and nothing covered what was drawn from it. That
 * is worker rule 1's gap one surface over: the decisions lived inside
 * `renderOptions`, which needs a worker, `chrome.*` and a browser, so "is a
 * course drawn twice?" could only be answered by looking. The list is
 * `ui/options/course-sites.ts` now, every action is a callback, and this builds
 * the real thing over a linkedom document the way `preview-acceptance.test.ts`
 * builds the popup's.
 *
 * Every class it looks for comes from the module's own exported constant (UI
 * house rule 7): three redraw guards once asked for `.menu` while the element's
 * class was `menu-surface`, and a test holding a second copy of a spelling
 * agrees with the wrong one.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";

const page = parseHTML("<!doctype html><html><body><div id='adapters'></div></body></html>");
const globals = globalThis as unknown as Record<string, unknown>;
globals["document"] = page.document;
globals["window"] = page.window;

type Mod = typeof import("../src/ui/options/course-sites.js");
let mod: Mod;
beforeAll(async () => {
  mod = await import("../src/ui/options/course-sites.js");
});

type Entry = Parameters<Mod["renderCourseSites"]>[0][number];

/** The preview fixture's shape, trimmed to what a row reads. */
function adapter(over: Partial<Entry> & { id: string; label: string; courseCode: string; url: string }): Entry {
  return {
    hostPattern: `https://${new URL(over.url).hostname}/*`,
    enabled: false,
    granted: false,
    currentTerm: true,
    ...over,
  } as unknown as Entry;
}

const REGISTRY: Entry[] = [
  // One page, switched on: the commonest course there is.
  adapter({ id: "cs424", label: "CS 424 course site", courseCode: "CS424",
    url: "https://courses.grainger.illinois.edu/cs424/fa2026/schedule/",
    enabled: true, granted: true }),
  // One page, switched on, never granted.
  adapter({ id: "phys214", label: "PHYS 214 course site", courseCode: "PHYS214",
    url: "https://physics.illinois.edu/phys214/schedule", enabled: true }),
  // Three pages, one host, one of them missing its permission.
  adapter({ id: "ece411-a", label: "ECE 411 assignments", courseCode: "ECE411",
    url: "https://courses.grainger.illinois.edu/ece411/fa2026/assignments.html",
    enabled: true, granted: true }),
  adapter({ id: "ece411-e", label: "ECE 411 exams", courseCode: "ECE411",
    url: "https://courses.grainger.illinois.edu/ece411/fa2026/exams.html", enabled: true }),
  adapter({ id: "ece411-l", label: "ECE 411 labs", courseCode: "ECE411",
    url: "https://courses.grainger.illinois.edu/ece411/fa2026/labs.html" }),
  // Two pages on two hosts.
  adapter({ id: "cs128-a", label: "CS 128 assignments", courseCode: "CS128",
    url: "https://courses.grainger.illinois.edu/cs128/fa2026/assignments/",
    enabled: true, granted: true }),
  adapter({ id: "cs128-e", label: "CS 128 exams", courseCode: "CS128",
    url: "https://cs128.org/exams/" }),
  // A page the student added, beside a published one for the same course: the
  // pair that used to draw the course on both sides of the split.
  adapter({ id: "cs374-local", label: "CS 374 group problem sessions", courseCode: "CS374",
    url: "https://courses.grainger.illinois.edu/cs374/fa2026/gps.html",
    enabled: true, granted: true, local: true } as Partial<Entry> & {
      id: string; label: string; courseCode: string; url: string }),
  adapter({ id: "cs374-hw", label: "CS 374 homeworks", courseCode: "CS374",
    url: "https://courses.grainger.illinois.edu/cs374/fa2026/homeworks.html" }),
  // One course, spelled two ways, on two entries.
  adapter({ id: "cs425-local", label: "CS 425 lectures", courseCode: "CS425",
    url: "https://courses.grainger.illinois.edu/cs425/fa2026/lectures.html",
    enabled: true, granted: true, local: true } as Partial<Entry> & {
      id: string; label: string; courseCode: string; url: string }),
  adapter({ id: "cs425-hw", label: "CS425/ECE428 assignments", courseCode: "CS425/ECE428",
    url: "https://courses.grainger.illinois.edu/cs425/fa2026/assignments.html" }),
  // Nobody's: published, off, and not one of the student's course keys.
  adapter({ id: "ece310", label: "ECE 310 course site", courseCode: "ECE310",
    url: "https://courses.grainger.illinois.edu/ece310/fa2026/" }),
  adapter({ id: "cs446-a", label: "CS 446 assignments", courseCode: "CS446",
    url: "https://courses.grainger.illinois.edu/cs446/fa2026/assignments.html" }),
  adapter({ id: "cs446-e", label: "CS 446 exams", courseCode: "CS446",
    url: "https://courses.grainger.illinois.edu/cs446/fa2026/exams.html" }),
];

const COURSE_KEYS = ["CS424", "PHYS214", "ECE411", "CS128"];

const NOTHING = {
  toggle: () => undefined,
  allow: () => undefined,
  remove: () => undefined,
};

function draw(adapters: Entry[] = REGISTRY, keys: readonly string[] = COURSE_KEYS) {
  const list = page.document.getElementById("adapters")!;
  list.replaceChildren();
  const { rows } = mod.renderCourseSites(adapters, keys, NOTHING);
  list.append(...rows);
  return list;
}

const rowsOf = (list: Element) =>
  [...list.querySelectorAll(`.${mod.COURSE_ROW_CLASS}`)] as HTMLElement[];
const nameOf = (row: Element) => row.querySelector(`.${mod.COURSE_NAME_CLASS}`)!.textContent;
const switchesOf = (row: Element) => [...row.querySelectorAll(`.${mod.SWITCH_CLASS}`)];
const rowFor = (list: Element, label: string) =>
  rowsOf(list).find((row) => nameOf(row) === label)!;

describe("Course websites: one row per course", () => {
  it("draws exactly one row for each of the student's courses and none for anyone else's", () => {
    const list = draw();
    // §0's list, in registry order. ECE 411's three entries are one row; CS 374
    // and CS 425 are one row each although their pages differ in standing and
    // in spelling; ECE 310 and CS 446 are the student's in no sense and are not
    // here at all — which is the whole of "they shouldnt be able to see courses
    // that they havent selected".
    expect(rowsOf(list).map(nameOf)).toEqual([
      "CS 424",
      "PHYS 214",
      "ECE 411",
      "CS 128",
      "CS 374",
      "CS 425 / ECE 428",
    ]);
  });

  it("names no course twice, in the rendered document", () => {
    const names = rowsOf(draw()).map(nameOf);
    expect(new Set(names).size).toBe(names.length);
    // And the pages of one course are all in that one row, not spread over two.
    expect([...draw().querySelectorAll(`.${mod.SWITCH_CLASS}`)]).toHaveLength(11);
  });

  it("puts every page of a course on its own row as its own switch", () => {
    const list = draw();
    expect(switchesOf(rowFor(list, "ECE 411"))).toHaveLength(3);
    expect(switchesOf(rowFor(list, "CS 374"))).toHaveLength(2);
    expect(switchesOf(rowFor(list, "CS 424"))).toHaveLength(1);
  });

  it("checks a switch only when the page is both on and granted", () => {
    const list = draw();
    const ece = switchesOf(rowFor(list, "ECE 411")) as HTMLInputElement[];
    // assignments on+granted, exams on but never granted, labs off.
    expect(ece.map((box) => box.checked)).toEqual([true, false, false]);
    expect((switchesOf(rowFor(list, "PHYS 214"))[0] as HTMLInputElement).checked).toBe(false);
  });
});

describe("Course websites: every switch is a real labelled control", () => {
  it("labels each switch with the page it reads, so the switches differ by address", () => {
    /*
     * The labels used to come from the adapter's own `label` with the course
     * stripped off, and the registry does not spell those consistently:
     * `CS/ECE 374 A course site` under a `CS374` code, `CS 425 course site`
     * under `CS425/ECE428`. Neither prefix matched, so the whole label came
     * through and a row read "course site · CS/ECE 374 A course site" beside a
     * course called CS 374 (2026-09-21).
     */
    const list = draw();
    const row = rowFor(list, "ECE 411");
    const labels = [...row.querySelectorAll(`.${mod.PAGE_NAME_CLASS}`)];
    expect(labels.map((l) => l.textContent)).toEqual([
      "assignments.html",
      "exams.html",
      "labs.html",
    ]);
    // Associated, not merely adjacent: `for` points at a checkbox in this row.
    for (const label of labels as HTMLLabelElement[]) {
      const control = page.document.getElementById(label.htmlFor);
      expect(control, `no control for ${label.textContent}`).not.toBeNull();
      expect((control as HTMLInputElement).type).toBe("checkbox");
      expect(row.contains(control)).toBe(true);
    }
  });

  it("names a single page too, rather than leaving one switch floating unlabelled", () => {
    // While the name came from the adapter's label this was the redundancy
    // "CS 424 / course site" and was left off. An address is not a
    // restatement of the course, and the lone switch at the end of the row
    // said nothing about what it read.
    const row = rowFor(draw(), "CS 424");
    const labels = [...row.querySelectorAll(`.${mod.PAGE_NAME_CLASS}`)];
    expect(labels.map((l) => l.textContent)).toEqual(["schedule"]);
  });

  it("leaves the course name a plain span, because the pages carry the labels", () => {
    // Otherwise a row has two labels pointing at one switch, and pressing the
    // course's name toggles whichever page happens to be first.
    for (const course of ["ECE 411", "CS 424"]) {
      expect(rowFor(draw(), course).querySelector(`.${mod.COURSE_NAME_CLASS}`)!.tagName)
        .toBe("SPAN");
    }
  });

  it("falls back to the entry's own name for an address with no page in it", () => {
    // ECE 310's URL ends at its term, `/ece310/fa2026/`, and "fa2026" names
    // the term rather than the page.
    expect(mod.adapterPageName({
      courseCode: "ECE310",
      label: "ECE 310 course site",
      url: "https://courses.grainger.illinois.edu/ece310/fa2026/",
    } as never)).toBe("course site");
  });

  it("gives every switch a distinct id, so one label cannot own two", () => {
    const ids = [...draw().querySelectorAll(`.${mod.SWITCH_CLASS}`)].map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id !== "")).toBe(true);
  });
});

describe("Course websites: the host, and the rest of the address", () => {
  it("says the host once when every page of a course shares it", () => {
    const row = rowFor(draw(), "ECE 411");
    expect([...row.querySelectorAll(`.${mod.COURSE_HOST_CLASS}`)].map((h) => h.textContent))
      .toEqual(["courses.grainger.illinois.edu"]);
    expect(row.querySelectorAll(`.${mod.PAGE_HOST_CLASS}`)).toHaveLength(0);
  });

  it("says it per page when they differ, rather than naming one of two", () => {
    const row = rowFor(draw(), "CS 128");
    expect(row.querySelectorAll(`.${mod.COURSE_HOST_CLASS}`)).toHaveLength(0);
    expect([...row.querySelectorAll(`.${mod.PAGE_HOST_CLASS}`)].map((h) => h.textContent))
      .toEqual(["courses.grainger.illinois.edu", "cs128.org"]);
  });

  it("carries each page's full address on the label the pointer is over", () => {
    const list = draw();
    expect(
      [...rowFor(list, "CS 128").querySelectorAll(`.${mod.PAGE_NAME_CLASS}`)].map((l) =>
        (l as HTMLElement).title,
      ),
    ).toEqual([
      "https://courses.grainger.illinois.edu/cs128/fa2026/assignments/",
      "https://cs128.org/exams/",
    ]);
    expect(
      (rowFor(list, "CS 424").querySelector(`.${mod.PAGE_NAME_CLASS}`) as HTMLElement).title,
    ).toBe("https://courses.grainger.illinois.edu/cs424/fa2026/schedule/");
  });
});

describe("Course websites: what a page can be asked to do", () => {
  it("offers Remove on a page the student added and on no other", () => {
    const list = draw();
    const local = rowFor(list, "CS 374").querySelectorAll(`.${mod.REMOVE_CLASS}`);
    expect(local).toHaveLength(1);
    // On the page they added, not on the published page beside it.
    expect(
      (local[0]!.closest(`.${mod.PAGE_CLASS}`)!.querySelector(`.${mod.PAGE_NAME_CLASS}`))!
        .textContent,
    ).toBe("gps.html");
    expect(rowFor(list, "ECE 411").querySelectorAll(`.${mod.REMOVE_CLASS}`)).toHaveLength(0);
  });

  it("says a page's permission is missing and offers to ask again, on that page", () => {
    const row = rowFor(draw(), "ECE 411");
    const allow = row.querySelectorAll(`.${mod.ALLOW_CLASS}`);
    expect(allow).toHaveLength(1);
    const cell = allow[0]!.closest(`.${mod.PAGE_CLASS}`)!;
    expect(cell.querySelector(`.${mod.PAGE_NAME_CLASS}`)!.textContent).toBe("exams.html");
    expect(cell.textContent).toContain("Permission missing");
    // The two pages that are fine say nothing.
    expect(row.querySelectorAll(".chip-state")).toHaveLength(1);
  });

  it("hands each control the note on its own row, not a line under the list", () => {
    const seen: string[] = [];
    const list = page.document.getElementById("adapters")!;
    list.replaceChildren();
    const { rows } = mod.renderCourseSites(REGISTRY, COURSE_KEYS, {
      ...NOTHING,
      toggle: (_a, _e, note) => {
        note("Permission denied, so that site stays off.");
        seen.push("toggled");
      },
    });
    list.append(...rows);
    const row = rowFor(list, "ECE 411");
    const box = switchesOf(row)[2] as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new page.window.Event("change"));
    expect(seen).toEqual(["toggled"]);
    expect(row.querySelector(`.${mod.NOTE_CLASS}`)!.textContent)
      .toBe("Permission denied, so that site stays off.");
    // And on that row alone: a sentence about ECE 411 on CS 424's row is the
    // shared status line this replaced.
    expect(rowFor(list, "CS 424").querySelector(`.${mod.NOTE_CLASS}`)!.textContent).toBe("");
  });

  it("puts an undo line on the course it belongs to, including one with no pages left", () => {
    const list = page.document.getElementById("adapters")!;
    list.replaceChildren();
    const undoLine = (group: { label: string }) =>
      group.label === "CS 425 / ECE 428"
        ? (() => {
            const p = page.document.createElement("p");
            p.className = mod.UNDO_CLASS;
            p.textContent = "Removed CS 425 lectures · Undo";
            return p;
          })()
        : undefined;
    const { rows, yours } = mod.renderCourseSites(REGISTRY, COURSE_KEYS, {
      ...NOTHING,
      undoLine,
    });
    list.append(...rows);
    expect(rowFor(list, "CS 425 / ECE 428").querySelector(`.${mod.UNDO_CLASS}`)!.textContent)
      .toContain("Removed CS 425 lectures");
    expect(list.querySelectorAll(`.${mod.UNDO_CLASS}`)).toHaveLength(1);
    // The removal that took a course's last page: `courseIsDrawn` is false and
    // the page draws an empty row so the notice has somewhere to hang.
    expect(mod.courseIsDrawn(yours, "CS425")).toBe(true);
    expect(mod.courseIsDrawn(yours, "CS233")).toBe(false);
    const empty = mod.courseRow(
      { codes: ["CS233"], label: "CS 233", department: "CS", adapters: [] },
      { ...NOTHING, undoLine: () => {
        const p = page.document.createElement("p");
        p.className = mod.UNDO_CLASS;
        p.textContent = "Removed CS 233 course site · Undo";
        return p;
      } },
    );
    expect(empty.querySelectorAll(`.${mod.SWITCH_CLASS}`)).toHaveLength(0);
    expect(empty.querySelector(`.${mod.UNDO_CLASS}`)!.textContent).toContain("CS 233");
  });
});
