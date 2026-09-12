/**
 * Drives `scripts/components.html`.
 *
 * It imports the *real* `src/ui/icons.ts`, so an icon that is missing or
 * misdrawn here is missing in the extension. Everything else on the page is
 * plain markup against the real `ui.css`.
 *
 * Not shipped: `scripts/preview.mjs` bundles it into `dist/components.js` and
 * `scripts/package.mjs` keeps both out of the zip.
 */

import { ICON_PATHS, type IconName, icon, iconButton } from "../src/ui/icons.js";
import { allThemeClasses, themeClass } from "../src/core/theme.js";

/* ---- theme switcher ---- */
for (const button of document.querySelectorAll<HTMLElement>("[data-theme]")) {
  button.addEventListener("click", () => {
    document.documentElement.classList.remove(...allThemeClasses());
    document.documentElement.classList.add(themeClass(button.dataset["theme"] as never));
  });
}
document.documentElement.classList.add(themeClass("illini"));

/* ---- icon buttons ---- */
const iconRow = document.getElementById("icon-buttons")!;
for (const [name, label] of [
  ["sync", "Sync now"],
  ["open-tab", "Open in a tab"],
  ["settings", "Settings"],
  ["more", "More"],
  ["left", "Back"],
  ["right", "Forward"],
] as [IconName, string][]) {
  iconRow.append(iconButton(name, label));
}
document.getElementById("spinner")!.append(icon("sync"));

/* ---- health pill, in each of its four states ---- */
const pills = document.getElementById("pills")!;
for (const [state, text, chevron] of [
  ["is-ok", "All 5 OK · 11:16 PM", false],
  ["is-warn", "Sign in to Gradescope", true],
  ["is-err", "Gradescope couldn’t be read", true],
  ["is-pending", "Checking…", false],
] as [string, string, boolean][]) {
  const pill = document.createElement("button");
  pill.className = `pill ${state}`;
  pill.type = "button";
  const dot = document.createElement("i");
  dot.className = "pill--dot";
  const label = document.createElement("span");
  label.className = "pill--text";
  label.textContent = text;
  pill.append(dot, label);
  if (chevron) pill.append(icon("right"));
  pills.append(pill);
}

/* ---- banners ---- */
const banners = document.getElementById("banners")!;
for (const [tone, glyph, text, action] of [
  ["banner-warn", "warning", "Gradescope: signed out for 40h — its rows may be out of date", "Sign in"],
  ["banner-err", "warning", "Chrome is blocking reminders, so nothing will notify you", "Turn on"],
  ["banner-info", "info", "CS 357 Quiz 2 · sessions Sep 21–23 · not booked", "Book"],
] as [string, IconName, string, string][]) {
  const banner = document.createElement("div");
  banner.className = `banner-line ${tone}`;
  const label = document.createElement("span");
  label.className = "banner-line--text";
  label.textContent = text;
  const button = document.createElement("button");
  button.className = "btn btn-quiet btn-sm";
  button.textContent = action;
  banner.append(icon(glyph), label, button);
  banners.append(banner);
}

/* ---- menu ---- */
const menuBox = document.getElementById("menu")!;
const menu = document.createElement("div");
menu.className = "menu-surface";
for (const [label, glyph, active] of [
  ["Open in Gradescope", "open-tab", false],
  ["Mark done", "check", true],
  ["Hide", "close", false],
  ["Split (2 sources)", "more", false],
  ["Add to Google Calendar", "tab-month", false],
] as [string, IconName, boolean][]) {
  const item = document.createElement("button");
  item.className = "menu-item";
  if (active) item.dataset["active"] = "true";
  item.append(icon(glyph), document.createTextNode(label));
  menu.append(item);
}
menuBox.append(menu);

/* ---- every icon, so a new one cannot be added without being seen ---- */
const icons = document.getElementById("icons")!;
for (const name of Object.keys(ICON_PATHS) as IconName[]) {
  const box = document.createElement("span");
  box.className = "chip-base";
  box.title = name;
  box.append(icon(name), document.createTextNode(name));
  icons.append(box);
}

/* ---- the meaning tokens, as swatches ---- */
const swatches = document.getElementById("swatches")!;
for (const token of [
  "--err",
  "--warn",
  "--ok",
  "--accent",
  "--primary",
  "--brand",
  "--bg",
  "--surface",
  "--surface-raised",
  "--tint",
  "--tint-strong",
  "--line",
  "--muted",
  "--fg",
]) {
  const box = document.createElement("div");
  box.className = "swatch";
  const fill = document.createElement("i");
  fill.style.background = `var(${token})`;
  const label = document.createElement("span");
  label.textContent = token;
  box.append(fill, label);
  swatches.append(box);
}
