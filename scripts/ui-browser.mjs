/** A disposable Chrome profile and real input, using the same CDP approach as
 * held-press.mjs. No personal profile, extension login, or external requests. */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, sep, extname, join } from "node:path";
import { tmpdir } from "node:os";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function openBrowser(dist) {
  const executable = process.env.ILLINI_CHROME ?? [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ].find(existsSync);
  if (!executable) throw new Error("Chrome not found; set ILLINI_CHROME to its executable.");
  const profile = mkdtempSync(join(tmpdir(), "illini-ui-"));
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" };
  const server = createServer((req, res) => {
    try {
      const path = resolve(dist, `.${decodeURIComponent(new URL(req.url, "http://local").pathname)}`);
      if (!path.startsWith(resolve(dist) + sep)) throw new Error("outside dist");
      const body = readFileSync(path);
      res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const child = spawn(executable, ["--headless=new", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--disable-component-update", "about:blank"], { stdio: "ignore" });
  let ws;
  let nextId = 0;
  const pending = new Map();
  const events = [];
  const close = async () => {
    ws?.close();
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error("Browser closed")); }
    pending.clear();
    child.kill("SIGKILL");
    await Promise.race([new Promise((r) => child.exitCode !== null || child.signalCode ? r() : child.once("exit", r)), sleep(2000)]);
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  };
  child.on("error", (e) => events.push({ kind: "launch-error", message: e.message }));
  const send = (method, params = {}) => new Promise((resolveResult, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 12000);
    pending.set(id, { resolve: resolveResult, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  try {
    const portFile = join(profile, "DevToolsActivePort");
    for (let n = 0; n < 80 && !existsSync(portFile); n++) await sleep(100);
    if (!existsSync(portFile)) throw new Error("Chrome did not start its debugging endpoint");
    const port = readFileSync(portFile, "utf8").split("\n")[0];
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(5000) })).json();
    const target = targets.find((t) => t.type === "page");
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    ws.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id); clearTimeout(entry.timer);
        if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
      } else if (message.method === "Fetch.requestPaused") {
        const { requestId, request } = message.params;
        const local = request.url.startsWith(origin + "/");
        if (!local) events.push({ kind: "blocked-external-request", url: request.url });
        void send(local ? "Fetch.continueRequest" : "Fetch.failRequest", local ? { requestId } : { requestId, errorReason: "BlockedByClient" }).catch((e) => events.push({ kind: "harness-error", message: e.message }));
      } else if (message.method === "Runtime.exceptionThrown") events.push({ kind: "exception", details: message.params.exceptionDetails });
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    await send("Emulation.setTimezoneOverride", { timezoneId: "America/Chicago" });
    await send("Emulation.setLocaleOverride", { locale: "en-US" });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    const waitFor = async (expression) => {
      for (let n = 0; n < 80; n++) { if (await evaluate(expression)) return; await sleep(100); }
      throw new Error(`UI did not become ready: ${expression}`);
    };
    const press = async (selector) => {
      const point = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Control not found');
        const r = el.getBoundingClientRect(); const x = r.x + r.width/2, y = r.y + r.height/2;
        const hit = document.elementFromPoint(x,y);
        if (!hit || !el.contains(hit)) throw new Error('Control clipped or covered at pointer');
        return { x, y };
      })()`);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      await sleep(120);
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
      await sleep(150);
    };
    return { origin, send, evaluate, waitFor, press, events, close,
      async navigate(path, width, height, systemMode = "dark") {
        events.length = 0;
        await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: systemMode }, { name: "prefers-reduced-motion", value: "reduce" }] });
        await send("Storage.clearDataForOrigin", { origin, storageTypes: "all" });
        await send("Page.navigate", { url: `${origin}/${path}` });
        await waitFor(`location.pathname.includes('preview-') && document.readyState === 'complete' && !!globalThis.__UI_ACCEPTANCE__ && !!document.querySelector('#view > *, #sources > *')`);
        await evaluate("document.fonts.ready.then(() => true)");
        await sleep(1500);
      },
      async screenshot() {
        return Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })).data, "base64");
      },
    };
  } catch (error) { await close(); throw error; }
}
