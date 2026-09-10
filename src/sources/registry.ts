/**
 * Maps a parser id to its pure parse function. The offscreen document owns this
 * table; the service worker only ever sends an id and an HTML string.
 *
 * Canvas is absent by design: it returns JSON, so it never needs a DOM (§4.1).
 */

import { parseCoursePage as parseGradescopeCoursePage } from "./gradescope.js";
import { parseAssessments as parsePrairieLearnAssessments } from "./prairielearn.js";
import { parseHome as parsePrairieTestHome } from "./prairietest.js";
import { ROUNDTRIP_PARSER_ID, parseRoundtrip } from "./roundtrip.js";
import type { ParseFn, Source } from "./types.js";

export type ParserId = Source | typeof ROUNDTRIP_PARSER_ID;

export const PARSERS: Partial<Record<ParserId, ParseFn>> = {
  [ROUNDTRIP_PARSER_ID]: parseRoundtrip,
  // The dashboard is parsed during planning (it yields courses, not items), so
  // only the course page runs through the offscreen document.
  gradescope: parseGradescopeCoursePage,
  prairielearn: parsePrairieLearnAssessments,
  prairietest: parsePrairieTestHome,
};

export function getParser(id: ParserId): ParseFn {
  const parser = PARSERS[id];
  if (!parser) throw new Error(`no parser registered for "${id}"`);
  return parser;
}
