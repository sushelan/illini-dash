/**
 * The first-run screen: which sites this student's courses actually use.
 *
 * It hides the calendar chrome entirely rather than sitting above it, because
 * the thing it replaces was a full calendar shell with one sentence of
 * explanation under it, which reads as a broken app rather than a first step.
 *
 * Nothing here blocks. "Show my calendar" is clickable from the first paint —
 * see the module comment in core/setup.ts for why a gate was the wrong answer.
 */

import { type SetupRow, loginsToOpen, setupProgress, setupSummary } from "../../../core/setup.js";
import { LOGIN_URL, SOURCE_NAME } from "../../../core/names.js";
import { appMark, icon, iconButton } from "../../icons.js";
import { send } from "../../../messages.js";
import type { Source } from "../../../sources/types.js";
import {
  PIN_DISMISSED_KEY,
  app,
  bannersEl,
  dateNavEl,
  filtersEl,
  footerEl,
  healthEl,
  isFullView,
  isSyncing,
  readStored,
  state,
  tabsEl,
  viewEl,
  writeStored,
} from "../state.js";
import { signInUrl } from "../shell.js";

export function renderSetup(rows: SetupRow[], recheckLogins: () => void): void {
  document.body.classList.add("setup");
  // The checklist says how each source is doing, which is the health pill's
  // whole job — leaving the pill in the bar as well would be the same fact
  // twice, in a header that has nothing else to do yet. The mark and the name
  // instead.
  healthEl.replaceChildren(renderMarkOnly());
  bannersEl.replaceChildren();
  tabsEl.replaceChildren();
  filtersEl.replaceChildren();
  dateNavEl.replaceChildren();
  dateNavEl.hidden = true;
  // And no footer: it reports on sources the student is in the middle of
  // choosing, and "0 sources · not synced yet" under a checklist asking which
  // sources they have is the same fact contradicting itself.
  footerEl.replaceChildren();
  viewEl.replaceChildren();

  const page = document.createElement("div");
  page.className = "setup--page";

  const pin = renderPinCard();
  if (pin) page.append(pin);

  const heading = document.createElement("h1");
  heading.className = "setup--title";
  heading.textContent = "Which sites do your courses use?";

  const blurb = document.createElement("p");
  blurb.className = "setup--blurb";
  blurb.textContent =
    "Illini Dash reads your deadlines from these using the logins already in your browser. " +
    "It never sees a password, and nothing leaves your computer.";

  page.append(heading, blurb);

  for (const row of rows) {
    page.append(renderSetupRow(row));
  }

  const summary = document.createElement("p");
  summary.className = "setup--summary";
  // What was actually found, once anything has been. `found` comes from the
  // last draw's state, so on the first paint it is undefined and the line falls
  // back to the connection count — which is the only true thing available then.
  summary.textContent = setupSummary(setupProgress(rows), state.lastFound);

  // The line Sushi asked for. It goes under the list rather than in the blurb
  // because this is the worry the list creates — "what if I pick wrong" — and
  // the answer belongs next to the choice, not three paragraphs above it.
  const changeable = document.createElement("p");
  changeable.className = "setup--note";
  changeable.textContent = "You can change any of this later in Settings.";

  page.append(summary, changeable);

  const actions = document.createElement("div");
  actions.className = "setup--actions";

  // Resolved to URLs *before* the label is written. It used to count the
  // sources and then skip the ones with no page to open, so a button reading
  // "Open all 5 sign-in pages" could open four and say nothing about the fifth.
  const outstanding = loginsToOpen(rows)
    .map((source) => ({
      source,
      url:
        signInUrl(source, rows.find((row) => row.source === source)?.status) ?? LOGIN_URL[source],
    }))
    .filter((entry): entry is { source: Source; url: string } => entry.url !== undefined);
  if (outstanding.length > 0) {
    const all = document.createElement("button");
    all.className = "btn btn-secondary";
    all.textContent =
      outstanding.length === 1
        ? "Open the sign-in page"
        : `Open all ${outstanding.length} sign-in pages`;
    all.title = "Opens a tab for each site you picked that is not signed in yet";
    all.addEventListener("click", () => {
      for (const { url } of outstanding) {
        // Not focused: four tabs stealing focus one after another would leave
        // the student on whichever opened last, with no idea where they are.
        chrome.tabs.create({ url, active: false });
      }
    });
    actions.append(all);
  }

  const done = document.createElement("button");
  done.className = "btn btn-primary";
  done.textContent = "Show my calendar";
  done.addEventListener("click", async () => {
    done.disabled = true;
    await send({ type: "complete-setup" });
    document.body.classList.remove("setup");
    await app.refresh();
    // Pressing this is the clearest "I have finished signing in" a student can
    // say, and it was landing on a calendar still asserting nobody was.
    recheckLogins();
  });
  actions.append(done);

  page.append(actions);
  viewEl.append(page);
}

/** The mark and the name, with no pill beside them. */
function renderMarkOnly(): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "setup--brand";
  const mark = document.createElement("span");
  mark.className = "wordmark";
  mark.textContent = "Illini Dash";
  wrap.append(appMark(), mark);
  return wrap;
}

function renderSetupRow(row: SetupRow): HTMLElement {
  const line = document.createElement("div");
  line.className = "setup--row";

  const box = document.createElement("input");
  box.type = "checkbox";
  box.className = "switch";
  box.checked = row.enabled;
  box.id = `setup-${row.source}`;
  box.addEventListener("change", async () => {
    box.disabled = true;
    await send({ type: "set-source-enabled", source: row.source, enabled: box.checked });
    // A source just switched on has never been fetched, so ask for one now
    // rather than leaving the row pending until the next poll — the whole
    // screen is a checklist that is supposed to tick itself.
    if (box.checked) void send({ type: "sync", trigger: "manual" });
    await app.refresh();
  });

  const label = document.createElement("label");
  label.className = "setup--label";
  label.htmlFor = box.id;
  const name = document.createElement("span");
  name.className = "setup--name";
  name.textContent = SOURCE_NAME[row.source];
  const hint = document.createElement("span");
  hint.className = "setup--hint";
  hint.textContent = row.hint;
  label.append(name, hint);

  // The same chips Settings uses, so a student who has seen one screen can read
  // the other. "✓ connected", "needs sign-in", "could not read" and "not used"
  // were four wordings this screen invented for itself.
  const stateEl = document.createElement("span");
  if (!row.enabled) {
    stateEl.className = "chip-base chip-state";
    stateEl.textContent = "Not used";
  } else if (isSyncing()) {
    /*
     * A sync is in flight, so every other word on this row is about the
     * *previous* one.
     *
     * The store is written once, at the end of a sync, so during the five to
     * ten seconds one takes these rows keep asserting the pre-sync answer with
     * nothing to say they are being re-read. Sushi, looking at a signed-in
     * Gradescope dashboard with this screen on top of it: "as u can see im in
     * gradescope and it still says not signed in. Either there's a really long
     * delay or it's waiting on something to trigger the sync." Both readings
     * were available because the screen offered no third one.
     *
     * The header pill has said "Checking…" throughout; this screen has no pill,
     * which is exactly why it needed its own.
     */
    stateEl.className = "chip-base chip-state";
    stateEl.textContent = "Checking…";
    stateEl.title = "Reading this site now. This can take a few seconds.";
  } else if (row.status?.lastSuccessAt !== undefined) {
    stateEl.className = "chip-base chip-state is-ok";
    stateEl.textContent = "Connected";
  } else if (row.status?.state === "needs_login") {
    stateEl.className = "chip-base chip-state is-warn";
    stateEl.textContent = "Sign in needed";
    // What the site actually answered. It was already here for the two error
    // states and missing from the one people get stuck on — and it is the
    // difference between "the cookie is not reaching us" and "the page says
    // something we misread", which nothing else on this screen can tell apart.
    stateEl.title = row.status.lastError ?? "";
  } else if (row.status?.state === "parse_error" || row.status?.state === "network_error") {
    stateEl.className = "chip-base chip-state is-err";
    stateEl.textContent = "Couldn't read";
    stateEl.title = row.status.lastError ?? "";
  } else {
    stateEl.className = "chip-base chip-state";
    stateEl.textContent = "Checking…";
  }

  line.append(box, label, stateEl);

  // The action, beside the state rather than instead of it: "Sign in needed"
  // and a button that does it are two different things, and replacing the first
  // with the second left a row whose state was a verb.
  const login = row.enabled ? signInUrl(row.source, row.status) : undefined;
  if (login) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary btn-sm";
    button.textContent = "Sign in";
    button.addEventListener("click", () => chrome.tabs.create({ url: login }));
    line.append(button);
  }
  return line;
}

/**
 * "Pin Illini Dash", and the two clicks that do it.
 *
 * Chrome leaves a newly installed extension unpinned, which means the badge —
 * the only thing that ever tells a student something is due without them
 * asking — lives behind the puzzle-piece menu where nobody looks. Everything
 * else in this project is about not failing silently; an unpinned icon is that
 * failure at the operating-system level.
 *
 * Dismissible, and it stays dismissed: a card that reappears after being
 * dismissed is worse than one that was never shown.
 */
function renderPinCard(): HTMLElement | undefined {
  /*
   * The tab only.
   *
   * This is the screen `onInstalled` opens, and the install is the moment the
   * advice is for. In a 400px popup the card costs about 90px of a 600px window
   * and pushes "Show my calendar" — the one thing on the screen that has to be
   * reachable — below the fold, to give advice to somebody who has just
   * demonstrated they can find the icon.
   */
  if (!isFullView) return undefined;
  if (readStored(PIN_DISMISSED_KEY) === "1") return undefined;

  const card = document.createElement("div");
  card.className = "pincard";

  const glyph = icon("puzzle");
  glyph.classList.add("pincard--glyph");

  const text = document.createElement("div");
  text.className = "pincard--text";
  const title = document.createElement("b");
  title.textContent = "Pin Illini Dash to your toolbar";
  const how = document.createElement("span");
  how.textContent =
    "Click the puzzle-piece icon at the top right of Chrome, then the pin beside Illini Dash. " +
    "Until you do, the badge that counts what is due is hidden behind that menu.";
  text.append(title, how);

  const dismiss = iconButton("close", "Dismiss");
  dismiss.classList.add("btn-sm");
  dismiss.addEventListener("click", () => {
    writeStored(PIN_DISMISSED_KEY, "1");
    card.remove();
  });

  card.append(glyph, text, dismiss);
  return card;
}
