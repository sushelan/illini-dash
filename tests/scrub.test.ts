/**
 * Appendix A: fixtures must lose the student's identity and keep everything the
 * parsers are tested against — course names, assignment names, dates, structure.
 */

import { describe, expect, it } from "vitest";
import { scrubHtml } from "../src/core/scrub.js";

describe("scrubHtml", () => {
  it("replaces emails, UINs, names and netids", () => {
    const { html, report } = scrubHtml(
      `<p>Jane Doe (jdoe42@illinois.edu), UIN 123456789, netid jdoe42</p>`,
      { name: "Jane Doe", netid: "jdoe42" },
    );
    expect(html).toBe(
      `<p>STUDENT (student@illinois.edu), UIN 000000000, netid netid</p>`,
    );
    expect(report.counts).toMatchObject({
      "email address": 1,
      "student name": 1,
      "9-digit student id": 1,
      netid: 1,
    });
  });

  it("keeps course names, assignment names and dates untouched", () => {
    const source = `<tr><th class="table--primaryLink"><a href="/courses/1352838/assignments/12">MP1: Sound</a></th>
      <td class="submissionStatus">No Submission</td>
      <time class="submissionTimeChart--dueDate" datetime="2026-09-09 17:00:00 -0500">Sep 09 at 5:00PM</time></tr>`;
    const { html } = scrubHtml(source, { name: "Jane Doe", netid: "jdoe42" });
    expect(html).toBe(source);
  });

  it("does not mangle a course id that happens to be nine digits long", () => {
    // Course ID 1352838 is 7 digits and must survive; a 9-digit run is a UIN.
    const { html } = scrubHtml(`<p>Course ID: 1352838</p>`);
    expect(html).toContain("1352838");
  });

  it("leaves 9-digit runs embedded in longer tokens alone", () => {
    // Real Canvas values that the first version of this rule corrupted.
    const source = JSON.stringify({
      lti_context_id: "80317707-f836-46b3-8f2b-4d5e123456789a50",
      resource_link_id: "ede053e6ca123456789c8b3ed7a1c1aece41f443",
      uin: "123456789",
    });
    const { html } = scrubHtml(source);
    expect(html).toContain("80317707-f836-46b3-8f2b-4d5e123456789a50");
    expect(html).toContain("ede053e6ca123456789c8b3ed7a1c1aece41f443");
    expect(html).toContain(`"uin":"000000000"`);
  });

  it("redacts identifying id fields by key, leaving other ids intact", () => {
    const source = JSON.stringify({
      id: 72393,
      course_id: 72393,
      enrollments: [{ user_id: 399483, type: "student" }],
      sortable_name: "Family, Given",
    });
    const { html } = scrubHtml(source);
    expect(html).toContain(`"id":72393`);
    expect(html).toContain(`"course_id":72393`);
    expect(html).toContain(`"user_id":0`);
    expect(html).toContain(`"sortable_name":"REDACTED"`);
    expect(JSON.parse(html)).toBeTypeOf("object");
  });

  it("leaves 10+ digit numbers alone", () => {
    const { html } = scrubHtml(`<p>1234567890</p>`);
    expect(html).toBe(`<p>1234567890</p>`);
  });

  it("blanks csrf tokens but keeps the tag shape", () => {
    const { html, report } = scrubHtml(
      `<meta name="csrf-token" content="abc123XYZ==" /><input name="authenticity_token" value="deadbeef">`,
    );
    expect(html).toBe(
      `<meta name="csrf-token" content="SCRUBBED" /><input name="authenticity_token" value="SCRUBBED">`,
    );
    expect(report.counts["csrf token (meta)"]).toBe(1);
    expect(report.counts["csrf token (form input)"]).toBe(1);
  });

  it("escapes regex metacharacters in a supplied name", () => {
    const { html } = scrubHtml(`<p>a.c and abc</p>`, { name: "a.c" });
    expect(html).toBe(`<p>STUDENT and abc</p>`);
  });

  it("replaces every part of a multi-part name, not just the whole string", () => {
    // The whole string collapses to one STUDENT; a part appearing on its own
    // elsewhere is caught by the per-part rules.
    const { html } = scrubHtml(`<a>Given Family</a><p>Given alone</p>`, {
      name: "Given Family",
    });
    expect(html).toBe(`<a>STUDENT</a><p>STUDENT alone</p>`);
  });

  it("does not let a name part rewrite the page's own use of the placeholder word", () => {
    // Passing "STUDENT" as a name part would otherwise turn PrairieLearn's
    // data-view-type="student" into data-view-type="STUDENT".
    const { html } = scrubHtml(
      `<ul data-view-type="student"><a href="/student-guide/">g</a></ul>`,
      {
        name: "Given STUDENT",
      },
    );
    expect(html).toBe(
      `<ul data-view-type="student"><a href="/student-guide/">g</a></ul>`,
    );
  });

  it("marks leftover identity as a blocker and missing inputs as notes", () => {
    const { report } = scrubHtml(`<a>Given Family</a>`, {
      name: "Family",
      netid: "x",
    });
    expect(report.warnings.some((w) => w.severity === "blocker")).toBe(true);
    const clean = scrubHtml(`<p>nothing</p>`);
    expect(clean.report.warnings.every((w) => w.severity === "note")).toBe(
      true,
    );
  });

  it("warns when a capitalised word is left touching a replacement", () => {
    // The real failure: only the family name was supplied, so PrairieLearn's
    // navbar came out as "<given name> STUDENT" and was still identifying.
    const { report } = scrubHtml(`<a>Given Family</a>`, { name: "Family" });
    expect(report.warnings.map((w) => w.message).join(" ")).toMatch(
      /"Given STUDENT".*rest of your name/,
    );
  });

  it("does not warn when the whole name was replaced", () => {
    const { report } = scrubHtml(`<a>Given Family</a>`, {
      name: "Given Family",
    });
    expect(report.warnings.map((w) => w.message).join(" ")).not.toMatch(
      /rest of your name/,
    );
  });

  it("ignores name parts shorter than three characters", () => {
    // A middle initial would otherwise turn every standalone "A" into STUDENT.
    // The page here does not contain the full name, so only the parts can match.
    const { html } = scrubHtml(`<p>Given Family, A, and a apple</p>`, {
      name: "A Given Family",
    });
    expect(html).toBe(`<p>STUDENT STUDENT, A, and a apple</p>`);
  });

  it("redacts AWS presigned-URL credentials but keeps the URL shape", () => {
    // Real shape from a Gradescope course page: a course-file link carrying an
    // access key id, an STS session token and a signature.
    const source =
      '<a href="https://x.s3.amazonaws.com/uploads/f/Homework2.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      "&amp;X-Amz-Credential=ASIAEXAMPLEKEYID0000%2F20260903%2Fus-west-2%2Fs3%2Faws4_request" +
      "&amp;X-Amz-Security-Token=EXAMPLESESSIONTOKEN&amp;X-Amz-Expires=10800" +
      '&amp;X-Amz-Signature=0000examplesignature0000">HW2</a>';
    const { html, report } = scrubHtml(source);
    expect(html).not.toContain("ASIAEXAMPLEKEYID0000");
    expect(html).not.toContain("EXAMPLESESSIONTOKEN");
    expect(html).not.toContain("0000examplesignature0000");
    expect(html).toContain("X-Amz-Credential=SCRUBBED");
    expect(html).toContain("X-Amz-Signature=SCRUBBED");
    // Structure a parser might read is untouched.
    expect(html).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(html).toContain("X-Amz-Expires=10800");
    expect(html).toContain(">HW2</a>");
    expect(report.counts["aws presigned url credential"]).toBe(3);
  });

  it("warns when no netid or name was supplied", () => {
    const { report } = scrubHtml(`<p>hi</p>`);
    expect(report.warnings.map((w) => w.message).join(" ")).toMatch(
      /No NetID given/,
    );
    expect(report.warnings.map((w) => w.message).join(" ")).toMatch(
      /No name given/,
    );
  });

  it("warns about a bearer token it deliberately did not remove", () => {
    const { report } = scrubHtml(
      `<script>h="Bearer abcdefghijklmnopqrst"</script>`,
    );
    expect(report.warnings.map((w) => w.message).join(" ")).toMatch(
      /Bearer token/,
    );
  });

  // The 2026-09-10 smartPhysics captures had their enrolment ids replaced by
  // hand, and nothing recorded that as a step. On 2026-09-21 a calendar capture
  // came back reading "nothing identifying was recognized" over a page carrying
  // the real id in every nav link.
  describe("enrolment ids, which name a (student, course) pair", () => {
    it("maps each distinct id to a stable counter, keeping distinct ones distinct", () => {
      const { html, report } = scrubHtml(
        `<a href="/Course?enrollmentID=151698">PHYS 214</a>` +
          `<a href="/Course?enrollmentID=150666">PHYS 213</a>` +
          `<a href="/Course/Calendar?enrollmentID=151698">Calendar</a>`,
      );
      expect(html).not.toContain("151698");
      expect(html).not.toContain("150666");
      // Two courses stay two courses. A constant replacement would merge them,
      // and the fixture would then pin `parseCourseList` to the wrong answer.
      expect(html).toContain("/Course?enrollmentID=100001");
      expect(html).toContain("/Course?enrollmentID=100002");
      // The same course's two pages keep the same id, or its calendar would no
      // longer belong to it.
      expect(html).toContain("/Course/Calendar?enrollmentID=100001");
      expect(report.counts["smartPhysics enrolment id"]).toBe(3);
      // Structure a parser reads is untouched.
      expect(html).toContain(">PHYS 214</a>");
    });

    it("is a fixed point, so re-scrubbing a committed fixture changes nothing", () => {
      const already = `<a href="/Course?enrollmentID=100001">A</a><a href="/Course?enrollmentID=100002">B</a>`;
      expect(scrubHtml(already).html).toBe(already);
    });

    // The first fixed calendar capture still had two live ids in it: the key is
    // in one attribute and the number in another, which the query-string
    // pattern cannot see.
    it("reads a hidden input, where the key and the number are different attributes", () => {
      const { html, report } = scrubHtml(
        `<a href="/Course?enrollmentID=151698">PHYS 214</a>` +
          `<input type='hidden' id='EnrollmentID' value='151698' />` +
          `<input type='hidden' name='enrollmentID' value='151698' />` +
          `<input value="151698" type="hidden" name="enrollmentID" />`,
      );
      expect(html).not.toContain("151698");
      // One counter across every spelling: the hidden field and the nav link
      // are the same enrolment, and a fixture where they disagree describes a
      // page that cannot exist.
      expect(html.match(/100001/g)).toHaveLength(4);
      expect(report.counts["smartPhysics enrolment id"]).toBe(4);
      // Neither attribute order loses the rest of its tag.
      expect(html).toContain(
        `<input value="100001" type="hidden" name="enrollmentID" />`,
      );
    });

    it("reads the key, not the shape, in whatever spelling holds it", () => {
      const { html } = scrubHtml(
        `<script>var e={"enrollmentId": 151698, "unitItemID": 151698};</script>`,
      );
      expect(html).toContain('"enrollmentId": 100001');
      // `unitItemID` is per-assignment, not per-student, and the README says it
      // is kept — matching by shape would have rewritten it too.
      expect(html).toContain('"unitItemID": 151698');
    });
  });

  // smartPhysics's calendar page posts to /Service/iCalendar with an enrolment
  // id and a `publicID` uuid. That pair is fetched by a calendar client with no
  // session, so anyone holding the uuid can read the student's whole calendar
  // from anywhere, indefinitely.
  it("removes a calendar feed token, which is a credential and not an identity", () => {
    const { html, report } = scrubHtml(
      `<form action="/Service/iCalendar" method="get">` +
        `<input type='hidden' name='enrollmentID' value='151698' />` +
        `<input type='hidden' name='publicID' value='201a727d-e0d4-654e-b5b4-0f2318913fcd' />` +
        `</form><a href="/Service/iCalendar?enrollmentID=151698&publicID=201a727d-e0d4-654e-b5b4-0f2318913fcd">Subscribe</a>`,
    );
    expect(html).not.toContain("201a727d");
    // A constant, not a counter: unlike an enrolment id there is nothing to
    // keep distinct, and the shape is kept so the form still parses as a form.
    expect(html).toContain("00000000-0000-4000-8000-000000000000");
    expect(report.counts["smartPhysics calendar feed token"]).toBe(2);
    // The action and the field names survive, so a parser reads what it read.
    expect(html).toContain(`action="/Service/iCalendar"`);
    expect(html).toContain(`name='publicID'`);
  });

  it("warns about a hidden field that looks like a token, whatever its shape", () => {
    // A probe rather than a rule: the next host's token will not be a uuid, and
    // guessing at its shape risks rewriting something a parser reads.
    const { report } = scrubHtml(
      `<input type="hidden" name="api_key" value="zzz" />`,
    );
    expect(report.warnings.map((w) => w.message).join(" ")).toMatch(
      /looks like a token or key/,
    );
    expect(report.warnings.some((w) => w.severity === "blocker")).toBe(true);
  });

  // `publicID` has its own dedicated rule above with a known shape. Pairing it
  // with the name-only probe too would make a page the rule just cleaned fail
  // this probe forever, on the exact field the rule exists for.
  it("does not also flag publicID once its own rule has scrubbed it", () => {
    const { html, report } = scrubHtml(
      `<input type='hidden' name='publicID' value='201a727d-e0d4-654e-b5b4-0f2318913fcd' />`,
    );
    expect(html).not.toContain("201a727d");
    expect(report.warnings.map((w) => w.message).join(" ")).not.toMatch(
      /looks like a token or key/,
    );
  });

  it("does not read 'nothing was recognized' as reassurance", () => {
    const { report } = scrubHtml(`<p>nothing here</p>`, {
      netid: "jdoe42",
      name: "Given Family",
    });
    expect(report.warnings.map((w) => w.message).join(" ")).toMatch(
      /no rule covers this host yet/,
    );
    // And it says nothing of the kind once a rule has fired.
    const found = scrubHtml(`<a href="/Course?enrollmentID=151698">A</a>`, {
      netid: "jdoe42",
      name: "Given Family",
    });
    expect(found.report.warnings.map((w) => w.message).join(" ")).not.toMatch(
      /Nothing was/,
    );
  });
});
