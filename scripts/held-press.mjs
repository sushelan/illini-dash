/**
 * A real mouse press, held, through Chrome's own input pipeline.
 *
 *     npm run preview && node scripts/held-press.mjs [holdMs=120]
 *
 * `Input.dispatchMouseEvent` over the DevTools protocol, pressed, held for
 * `holdMs`, released — not a DOM event. A synthetic `.click()` fires no
 * mousedown and no focus change, and a machine click is over in 0ms; a human
 * press holds for 80–150ms, and the Appearance panel's "Light" did nothing for
 * exactly that long (2026-09-19): mousedown on the label blurred the focused
 * radio, the panel's focus-out task ran during the hold, saw <body>, and
 * removed the panel before mouseup. Every harness passed. This is the check
 * that did not (CLAUDE.md, UI house rules 5 and 6).
 *
 * Prints a JSON record: whether each pressed control did its job. Run it on a
 * change before and after, the way a mutation check is run.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

const root = new URL("../dist", import.meta.url).pathname;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const HOLD_MS = Number(process.argv[2] ?? 120);
const port = 8799;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  try {
    const body = readFileSync(join(root, path === "/" ? "preview-popup.html" : path));
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(port, r));

const dbg = 9333;
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${dbg}`, "--window-size=400,600",
  "--blink-settings=preferredColorScheme=0", "--no-first-run", "--user-data-dir=/tmp/illini-held-press",
  `http://127.0.0.1:${port}/preview-popup.html?tab=day`,
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json();
    const page = list.find((t) => t.type === "page" && t.url.includes("preview-popup"));
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {}
}
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value ?? r.result?.exceptionDetails?.text;
};
const mouse = async (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
const heldPress = async (x, y) => { await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y); await sleep(HOLD_MS); await mouse("mouseReleased", x, y); await sleep(150); };
const centre = async (selectorJs) => evaluate(`(() => { const el = ${selectorJs}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

await send("Runtime.enable");
for (let i = 0; i < 40; i++) { if (await evaluate(`!!document.querySelector('#actions button[aria-label="More"]') && document.querySelectorAll('#view .row').length > 0`)) break; await sleep(250); }
await sleep(2200); // the popup's open-sync and its redraw (which closes menus)

const out = {};
// 1. Header ⋯ (a button) with a held press.
let c = await centre(`document.querySelector('#actions button[aria-label="More"]')`);
await heldPress(c.x, c.y);
out.headerMenuOpened = await evaluate(`!!document.querySelector('.menu-surface')`);
// 2. "Appearance…" (a menu button) with a held press.
c = await centre(`[...document.querySelectorAll('.menu-item')].find(b => b.textContent.includes('Appearance'))`);
await heldPress(c.x, c.y);
out.appearanceOpened = await evaluate(`document.querySelector('.menu-surface')?.getAttribute('aria-label') === 'Appearance'`);
// 3. The "Light" LABEL — non-focusable chrome — with a held press. This is the one that failed.
await evaluate(`localStorage.removeItem('illini-dash.mode'); window.__ev = []; for (const t of ['mousedown','focusout','mouseup','click']) document.addEventListener(t, e => __ev.push(t + ':' + (e.target.tagName || '') + '.' + (e.target.className || '')), true); 1`);
c = await centre(`[...document.querySelector('.menu-surface').querySelectorAll('label')].find(l => /^Light/.test(l.textContent.trim()))`);
out.lightLabelCentre = c;
await heldPress(c.x, c.y);
out.afterLight = await evaluate(`({ panelOpen: !!document.querySelector('.menu-surface'), htmlClass: document.documentElement.className, mode: localStorage.getItem('illini-dash.mode'), bodyBg: getComputedStyle(document.body).backgroundColor, ev: window.__ev })`);
// 4. A theme radio's label ("Neutral") the same way.
c = await centre(`[...document.querySelector('.menu-surface')?.querySelectorAll('label') ?? []].find(l => /^Neutral/.test(l.textContent.trim()))`);
if (c) { await heldPress(c.x, c.y); out.afterNeutral = await evaluate(`({ panelOpen: !!document.querySelector('.menu-surface'), htmlClass: document.documentElement.className, theme: localStorage.getItem('illini-dash.theme') })`); }
// 5. A press OUTSIDE the panel still closes it.
await heldPress(200, 590);
out.afterOutside = await evaluate(`({ panelOpen: !!document.querySelector('.menu-surface') })`);
// 6. The row ⋯ → "Hide" (a focusable button) with a held press: the 2026-09-18 path must still work.
c = await centre(`document.querySelector('#view .row .row--menu')`);
await heldPress(c.x, c.y);
out.rowMenuOpened = await evaluate(`[...document.querySelectorAll('.menu-item')].map(b => b.textContent.trim())`);
out.firstRowBefore = await evaluate(`document.querySelector('#view .row .row--title')?.textContent`);
await send("Runtime.enable"); const logs = []; ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.method === "Runtime.consoleAPICalled") logs.push(d.params.args.map(a => a.value).join(" ")); });
c = await centre(`[...document.querySelectorAll('.menu-item')].find(b => /^Hide/.test(b.textContent.trim()))`);
if (c) { await heldPress(c.x, c.y); await sleep(800); out.afterHide = await evaluate(`({ menuOpen: !!document.querySelector('.menu-surface'), firstRowNow: document.querySelector('#view .row .row--title')?.textContent })`); out.hideLogs = logs.filter(l => /requested|hide/i.test(l)); }

console.log(JSON.stringify({ holdMs: HOLD_MS, ...out }, null, 2));
ws.close(); chrome.kill(); server.close();
