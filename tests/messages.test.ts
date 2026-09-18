/**
 * send() has to turn Chrome's silent `undefined` response into something that
 * names the actual problem. This is the guard against the opaque
 * "Cannot read properties of undefined (reading 'type')" that a stale service
 * worker produced during build step 3.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { send } from "../src/messages.js";

function stubChrome(sendMessage: (request: unknown) => Promise<unknown>): void {
  (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { sendMessage } };
}

afterEach(() => {
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
  vi.restoreAllMocks();
});

describe("send", () => {
  it("passes a real response straight through", async () => {
    stubChrome(async () => ({ type: "pong", at: "2026-09-03T00:00:00Z", buildId: "x" }));
    await expect(send({ type: "ping" })).resolves.toMatchObject({ type: "pong" });
  });

  it("explains an undefined response instead of letting the caller deref it", async () => {
    stubChrome(async () => undefined);
    await expect(send({ type: "parse-selftest" })).rejects.toThrow(
      /returned no response.*chrome:\/\/extensions.*Reload/s,
    );
  });

  it("names the request type that went unanswered", async () => {
    stubChrome(async () => undefined);
    await expect(send({ type: "gate0" })).rejects.toThrow(/"gate0"/);
  });

  it("carries a post to the worker whole, including a pasted one", async () => {
    // A paste box is not in scope (Sushi rejected paste as the primary path),
    // but the message that would feed one ships now, so a later fallback is a
    // textarea in front of this rather than a second path with its own rules.
    let seen: unknown;
    stubChrome(async (request) => {
      seen = request;
      return { type: "ok" };
    });
    await send({
      type: "post-observed",
      post: {
        id: "cw-1",
        source: "paste",
        courseHint: "CS 357",
        postedAt: "2026-09-18T15:00:00-05:00",
        text: "MP3 is due Fri 10/2 at 11:59pm.",
      },
    });
    expect(seen).toMatchObject({ type: "post-observed", post: { id: "cw-1", source: "paste" } });
  });

  it("carries a post the Campuswire observer read, in the shape suggest.ts expects", () => {
    // The observer is a content script: it shares no bundle with the extension
    // pages, so the only thing keeping its payload and this union in step is
    // that both name the same fields. A field it invented would be dropped
    // silently at the boundary.
    const payload = {
      id: "campuswire:G794D32E4:682",
      source: "campuswire" as const,
      courseHint: "ECE 408: Applied Parallel Programming",
      postedAt: "2026-05-17T12:00:00-05:00",
      text: "CNN M3 Report Grade Released\nRegrade requests are due tomorrow.",
    };
    const request = { type: "post-observed" as const, post: payload };
    expect(request.post.id).toBe("campuswire:G794D32E4:682");
  });

  it("names the observer a switch is for, not just that one was switched", () => {
    // `{ enabled }` alone would have made the second observer a silent
    // behaviour change in the worker rather than a compile error here.
    let seen: unknown;
    stubChrome(async (request) => {
      seen = request;
      return { type: "ok" };
    });
    return send({ type: "set-observer-enabled", observer: "campuswire", enabled: true }).then(
      () => {
        expect(seen).toEqual({
          type: "set-observer-enabled",
          observer: "campuswire",
          enabled: true,
        });
      },
    );
  });
});
