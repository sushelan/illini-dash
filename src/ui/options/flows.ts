/**
 * The two long presses on Settings — "Prepare report" and "Read this page" —
 * and the part of each that decides what the student is told.
 *
 * Both set a status line ("Fetching…", "Reading…"), awaited a `send` with no
 * `try`, and returned early on any answer that was not the one they expected
 * — so a rejected `send` (the stale-worker sentence from `messages.ts`) became
 * an unhandled rejection invisible in the page, and an unexpected answer left
 * "Fetching…" on screen for good. Neither button was disabled while it ran, so
 * a second press started a second fetch (options-live #3, measured on the
 * preview: `#report-status` still "Fetching…" 2.5s later, button enabled).
 *
 * `send` is a parameter so a test can hand in one that refuses, rejects or
 * answers something from another build (worker rule 8).
 */

import type { Request, Response } from "../../messages.js";
import { actionOutcome } from "../../core/outcome.js";
import { messageOf } from "./actions.js";

export type Send = (request: Request) => Promise<Response>;

/** What a request came back as, from the student's side of the page. */
export type Answer<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Said when the worker answers with a shape this page did not ask for. That is
 * almost always a worker on another build, and naming the fix is the point.
 */
export const UNEXPECTED_ANSWER =
  "The background part of Illini Dash answered something this page did not expect, " +
  "which usually means it is running an older version. Open chrome://extensions and " +
  "click Reload on the Illini Dash card, then try again.";

/**
 * Sends one request and classifies the answer into the one this page wanted or
 * a sentence. Never rejects.
 *
 * Refusals are `actionOutcome`'s to recognise (an empty message is still a
 * refusal, parser rule 5); anything else of the wrong `type` is named as an
 * unexpected answer — with the type it was, so the sentence is evidence as well
 * as advice — rather than returned from silently.
 */
export async function requestAnswer<T extends Response["type"]>(
  send: Send,
  request: Request,
  expected: T,
): Promise<Answer<Extract<Response, { type: T }>>> {
  let response: unknown;
  try {
    response = await send(request);
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
  const outcome = actionOutcome(response);
  if (!outcome.ok) return { ok: false, message: outcome.message };
  const type =
    typeof response === "object" && response !== null
      ? (response as { type?: unknown }).type
      : undefined;
  if (type !== expected) {
    return {
      ok: false,
      message: `${UNEXPECTED_ANSWER} (It answered ${
        typeof type === "string" ? `“${type}”` : "with nothing recognisable"
      } to “${request.type}”.)`,
    };
  }
  return { ok: true, value: response as Extract<Response, { type: T }> };
}

/** The button a flow runs from, and the line it reports on. */
export interface FlowUi {
  button: HTMLButtonElement;
  /** Written while the flow runs, on the button itself (UI rule 4). */
  busyText: string;
  status: HTMLElement;
}

/**
 * Runs one press to completion: the button is disabled and relabelled for as
 * long as the work runs, whatever the work does, and anything it throws lands
 * in the status line rather than in a console.
 *
 * `work` is called synchronously, before the first `await` here, so a
 * permission prompt it asks for is still inside the user's gesture.
 */
export async function runFlow(ui: FlowUi, work: () => Promise<void>): Promise<void> {
  const label = ui.button.textContent;
  ui.button.disabled = true;
  ui.button.textContent = ui.busyText;
  try {
    await work();
  } catch (err) {
    ui.status.textContent = messageOf(err);
  } finally {
    ui.button.disabled = false;
    ui.button.textContent = label;
  }
}
