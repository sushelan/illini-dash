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
});
