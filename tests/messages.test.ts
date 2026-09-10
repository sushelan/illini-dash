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
});
