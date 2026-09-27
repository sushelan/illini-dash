/**
 * The first-run screen (brief D12, mock 1d): which sites this student's courses
 * actually use.
 *
 * It hides the calendar chrome entirely rather than sitting above it, because
 * the thing it replaces was a full calendar shell with one sentence of
 * explanation under it, which reads as a broken app rather than a first step.
 *
 * Nothing here blocks. The primary button is clickable from the first paint —
 * see the module comment in core/setup.ts for why a gate was the wrong answer.
 *
 * **What the redesign changed, and what it did not.** The shape is the mock's:
 * a mark, a headline that says what the student gets rather than what the
 * screen wants, a two-sentence blurb, the pin card, one card of switches, and
 * one primary button with a hint under it. Every *behaviour* under that is the
 * one that was here — the switch still sends `set-source-enabled` and asks for
 * a sync, the state chip still says what the last attempt found, the Sign in
 * buttons still come from `signInUrl`, the summary line is still
 * `setupSummary(setupProgress(rows), lastFound)`, and the pin card still
 * dismisses itself for good.
 *
 * The one structural change is that the switches are **grouped** the way the
 * mock groups them: PrairieLearn and PrairieTest are one line, because a
 * student who takes CS or ECE wants both and nobody has ever wanted one. A
 * group's switch sends one message per source in it.
 */

import {
  ATTEMPTING_KEY,
  type SetupRow,
  isChecking,
  loginsToOpen,
  parseAttempting,
  setupChip,
  setupProgress,
  setupSummary,
} from "../../../core/setup.js";
import { actionOutcome } from "../../../core/outcome.js";
import { chromeTabs, focusOrOpen } from "../../../core/tabs.js";
import { LOGIN_URL, SOURCE_NAME, nameList } from "../../../core/names.js";
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
import { signInUrl, showStatus } from "../shell.js";

/**
 * The mock's six lines, over the five sources `setupRows` hands us.
 *
 * `hint` is the mock's wording rather than `SOURCE_HINT`'s, because a group of
 * two needs a sentence about the pair and because the mock's lines say what the
 * site *carries* ("Homework, labs and late windows") where the old ones said
 * who it is for. Both are useful; this screen has room for one, and a student
 * deciding whether to switch something on is asking what is in it.
 *
 * A group whose sources are all missing from `rows` is not drawn — the list
 * says what can be switched on here, and a dead switch is worse than an absent
 * one.
 */
const GROUPS: { label: string; hint: string; sources: Source[] }[] = [
  { label: "Canvas", hint: "Assignments, quizzes and calendar events", sources: ["canvas"] },
  { label: "Gradescope", hint: "Homework, labs and late windows", sources: ["gradescope"] },
  {
    label: "PrairieLearn & PrairieTest",
    hint: "CS and ECE homework, CBTF exam bookings",
    sources: ["prairielearn", "prairietest"],
  },
  { label: "smartPhysics", hint: "PHYS 211, 212, 213 and 214 only", sources: ["smartphysics"] },
];

/**
 * The two lines of the mock's list that are not `Source`s at all.
 *
 * Piazza and Campuswire are *observers*, and a course website is an adapter the
 * student picks one at a time; both need a host permission, which is granted in
 * the click that asks for it on a page that stays open — which a popup, closing
 * the moment Chrome's consent window takes focus, is not. So they are stated
 * here with the one control that is honest about where they live. Drawing a
 * switch that cannot do what a switch promises would be worse than the mock's
 * shape is worth.
 */
const ELSEWHERE: { label: string; hint: string; section: string }[] = [
  {
    label: "Piazza & Campuswire",
    hint: "Announcements that move a deadline — switched on in Settings",
    section: "sec-sources",
  },
  {
    label: "Course websites",
    hint: "Off until you add one, and it asks before reading each — in Settings",
    section: "sec-sites",
  },
];

/**
 * The sources the running sync attempts, as the worker last published them
 * (`ATTEMPTING_KEY`), or `undefined` when it has not said — an older worker,
 * or the moment between the syncing flag and the plan. `isChecking` falls back
 * to "every row" then, which is what this screen always did.
 *
 * Kept here, current, rather than read per draw: a draw is synchronous and
 * `storage.session` is not. A change redraws the screen while it is showing,
 * because the chips are exactly what changed.
 */
let attempting: Source[] | undefined;

// `typeof`, not `chrome?.`: optional chaining on an undeclared global still
// throws, and the test harness and the preview load this module without one.
const storage = typeof chrome === "undefined" ? undefined : chrome.storage;
void storage?.session
  ?.get(ATTEMPTING_KEY)
  .then((stored) => {
    attempting = parseAttempting(stored?.[ATTEMPTING_KEY]);
  })
  .catch(() => undefined);
storage?.onChanged?.addListener((changes, area) => {
  if (area !== "session" || !(ATTEMPTING_KEY in changes)) return;
  attempting = parseAttempting(changes[ATTEMPTING_KEY]?.newValue);
  if (document.body.classList.contains("setup")) void app.refresh();
});

const checkingNow = (source: Source): boolean => isChecking(source, isSyncing(), attempting);

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

  /*
   * The mark again, large, above the headline (mock 1d).
   *
   * The header's copy is 22px beside a wordmark; this one is the first thing on
   * a screen that may be the first thing a student ever sees of this extension,
   * and at 34px it is the only element on it doing the job a product's name
   * usually does.
   */
  const brand = document.createElement("div");
  brand.className = "setup--mark";
  brand.append(appMark());

  const heading = document.createElement("h1");
  heading.className = "setup--title";
  // What they get, not what this screen wants. "Which sites do your courses
  // use?" is a question asked before anything has been offered in return.
  heading.textContent = "One calendar, nothing to maintain";

  const blurb = document.createElement("p");
  blurb.className = "setup--blurb";
  blurb.textContent =
    "Illini Dash reads the sites you're already signed into. " +
    "Nothing leaves your browser, and there's no account to make.";

  page.append(brand, heading, blurb);

  const pin = renderPinCard();
  if (pin) page.append(pin);

  const listHead = document.createElement("div");
  listHead.className = "section-head";
  const listLabel = document.createElement("span");
  listLabel.textContent = "Where to look";
  listHead.append(listLabel);

  const list = document.createElement("div");
  list.className = "setup--list";
  for (const group of GROUPS) {
    const present = group.sources
      .map((source) => rows.find((row) => row.source === source))
      .filter((row): row is SetupRow => row !== undefined);
    if (present.length === 0) continue;
    list.append(renderGroup(group.label, group.hint, present));
  }
  for (const entry of ELSEWHERE) list.append(renderElsewhere(entry));

  page.append(listHead, list);

  const summary = document.createElement("p");
  summary.className = "setup--summary";
  // What was actually found, once anything has been. `found` comes from the
  // last draw's state, so on the first paint it is undefined and the line falls
  // back to the connection count — which is the only true thing available then.
  // `checkingNow`, so a row whose chip says "Checking…" is not also described
  // by its previous answer in the sentence under it.
  summary.textContent = setupSummary(setupProgress(rows, checkingNow), state.lastFound);
  page.append(summary);

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
    all.type = "button";
    all.className = "btn btn-secondary";
    all.textContent =
      outstanding.length === 1
        ? "Open the sign-in page"
        : `Open all ${outstanding.length} sign-in pages`;
    // Names them. `loginsToOpen` includes sources nothing has checked yet (a
    // first run has nothing else to offer), so "not signed in yet" was a claim
    // about sites no attempt had answered (popup-live #8).
    all.title = `Opens the sign-in page for ${nameList(outstanding.map((entry) => entry.source))}`;
    all.addEventListener("click", () => {
      for (const { url } of outstanding) {
        // Not focused: four tabs stealing focus one after another would leave
        // the student on whichever opened last, with no idea where they are.
        chrome.tabs.create({ url, active: false });
      }
    });
    actions.append(all);
  }

  /*
   * "Find my deadlines" — the thing pressing it does, rather than the screen it
   * lands on.
   *
   * Same sequence as "Show my calendar" had, with the sync it always implied
   * made explicit: the label now promises a search, so it runs one. `runSync`
   * owns the spinner cap and the failure sentence, and `recheckLogins` after it
   * is the old behaviour — pressing this is the clearest "I have finished
   * signing in" a student can say, and it used to land on a calendar still
   * asserting nobody was.
   */
  const done = document.createElement("button");
  done.type = "button";
  done.className = "btn btn-primary setup--go";
  done.textContent = "Find my deadlines";
  done.addEventListener("click", () => {
    done.disabled = true;
    done.textContent = "Looking…";
    // Every `send` from a page gets a `.catch`, and the one channel this screen
    // has is `#status` at the top of the document (UI rules 2 and 3).
    void send({ type: "complete-setup" })
      .then(async () => {
        document.body.classList.remove("setup");
        await app.runSync();
        recheckLogins();
      })
      .catch((err: unknown) => {
        done.disabled = false;
        done.textContent = "Find my deadlines";
        showStatus(
          `Illini Dash could not finish setting up: ${
            err instanceof Error ? err.message : String(err)
          }. Open chrome://extensions and click Reload on the Illini Dash card.`,
        );
      });
  });
  actions.append(done);
  page.append(actions);

  // The line Sushi asked for, under the button rather than in the blurb: this
  // is the worry the list creates — "what if I pick wrong" — and the answer
  // belongs next to the choice, not three paragraphs above it.
  const hint = document.createElement("p");
  hint.className = "setup--note";
  hint.textContent = "Takes about 20 seconds. You can change any of this later in Settings.";
  page.append(hint);

  viewEl.append(page);
}

/** The mark and the name, with no pill beside them. */
function renderMarkOnly(): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "setup--brand";
  const mark = document.createElement("span");
  mark.className = "wordmark";
  // Matches `renderWordmark` in shell.ts — the first-run screen and the bar
  // are the same name, and two spellings of a product name is one too many.
  mark.textContent = "Illini Dash";
  wrap.append(appMark(), mark);
  return wrap;
}

/**
 * One line of the list: a name, what it carries, a switch, and what it found.
 *
 * `rows` is one source or two. Two share a switch and show one chip per source
 * underneath, because "PrairieLearn connected, PrairieTest needs a sign-in" is
 * two facts and collapsing them would hide the one with something to do.
 */
function renderGroup(label: string, hint: string, rows: SetupRow[]): HTMLElement {
  const line = document.createElement("div");
  line.className = "setup--row";

  const box = document.createElement("input");
  box.type = "checkbox";
  box.className = "switch";
  // On when *any* of the group is on, so a half-on pair reads as on rather than
  // as off — switching it then off is one click and switching it on is a no-op
  // for whichever half was already on.
  box.checked = rows.some((row) => row.enabled);
  box.id = `setup-${rows.map((row) => row.source).join("-")}`;
  box.addEventListener("change", () => {
    box.disabled = true;
    const enabled = box.checked;
    const refuse = (reason: string) => {
      box.disabled = false;
      box.checked = !enabled;
      showStatus(`Could not switch ${label} ${enabled ? "on" : "off"}: ${reason}`);
    };
    void Promise.all(
      rows.map((row) => send({ type: "set-source-enabled", source: row.source, enabled })),
    )
      .then(async (responses) => {
        /*
         * The worker's answer, read (options-live #2, 2026-09-27). Every
         * handler throw in the worker — a failed write, a queue timeout —
         * comes back as `{ type: "error" }`, and this discarded all five: the
         * switch sprang back on the redraw with no sentence anywhere. A
         * refusal puts the box back, says why, and does not refresh — nothing
         * in the store changed (ZIP rule 2; `core/outcome.ts` decides which
         * answers are refusals).
         */
        const refused = responses.map(actionOutcome).find((outcome) => !outcome.ok);
        if (refused && !refused.ok) {
          console.warn(`[setup] ${label}: the worker refused set-source-enabled — ${refused.message}`);
          refuse(refused.message);
          return;
        }
        // A source just switched on has never been fetched, so ask for one now
        // rather than leaving the row pending until the next poll — the whole
        // screen is a checklist that is supposed to tick itself.
        if (enabled) {
          void send({ type: "sync", trigger: "manual" }).catch((err: unknown) => {
            console.warn(`[setup] ${label}: the sync after switching on failed to send`, err);
          });
        }
        await app.refresh();
      })
      .catch((err: unknown) => {
        refuse(err instanceof Error ? err.message : String(err));
      });
  });

  const text = document.createElement("label");
  text.className = "setup--label";
  text.htmlFor = box.id;
  const name = document.createElement("span");
  name.className = "setup--name";
  name.textContent = label;
  const sub = document.createElement("span");
  sub.className = "setup--hint";
  sub.textContent = hint;
  text.append(name, sub);

  const states = document.createElement("span");
  states.className = "setup--states";
  for (const row of rows) states.append(renderStateChip(row, rows.length > 1));

  // The action, beside the state rather than instead of it: "Sign in needed"
  // and a button that does it are two different things, and replacing the first
  // with the second left a row whose state was a verb.
  for (const row of rows) {
    const login = row.enabled ? signInUrl(row.source, row.status) : undefined;
    if (!login) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary btn-sm";
    button.textContent = rows.length > 1 ? `Sign in to ${SOURCE_NAME[row.source]}` : "Sign in";
    button.title = `Open ${SOURCE_NAME[row.source]}'s login page`;
    button.addEventListener("click", () => void focusOrOpen(login, chromeTabs()).catch((err: unknown) => console.warn("[tabs] open failed:", err)));
    states.append(button);
  }

  line.append(box, text, states);
  return line;
}

/**
 * The same chips Settings uses, so a student who has seen one screen can read
 * the other — `setupChip` in core derives it the way Settings does
 * (`displayState`, `STATE_WORD`, `toneOf`), which this function did not until
 * 2026-09-27: it tested `lastSuccessAt` before the failure states, and a
 * source that read once and failed since was a green "Connected".
 *
 * "Checking…" while a sync is in flight, for the rows it is actually reading:
 * the store is written once, at the end of a sync, so during the five to ten
 * seconds one takes the stored answer is about the *previous* attempt. Sushi,
 * looking at a signed-in Gradescope dashboard with this screen on top of it:
 * "as u can see im in gradescope and it still says not signed in. Either
 * there's a really long delay or it's waiting on something to trigger the
 * sync." Both readings were available because the screen offered no third one.
 */
function renderStateChip(row: SetupRow, named: boolean): HTMLElement {
  const chip = document.createElement("span");
  // In a pair, the chip has to say which source it is about, or "Connected ·
  // Sign in needed" is two states and no subjects.
  const prefix = named ? `${SOURCE_NAME[row.source]}: ` : "";
  const shown = setupChip(row, checkingNow(row.source));
  const tone =
    shown.tone === "ok" ? "is-ok" : shown.tone === "warn" ? "is-warn" : shown.tone === "err" ? "is-err" : "";
  chip.className = `chip-base chip-state ${tone}`.trim();
  chip.textContent = `${prefix}${shown.text}`;
  if (shown.title) chip.title = shown.title;
  return chip;
}

/** A line for something this screen can name but not switch on. */
function renderElsewhere(entry: { label: string; hint: string; section: string }): HTMLElement {
  const line = document.createElement("div");
  line.className = "setup--row setup--row-quiet";

  const text = document.createElement("div");
  text.className = "setup--label";
  const name = document.createElement("span");
  name.className = "setup--name";
  name.textContent = entry.label;
  const sub = document.createElement("span");
  sub.className = "setup--hint";
  sub.textContent = entry.hint;
  text.append(name, sub);

  const open = document.createElement("button");
  open.type = "button";
  open.className = "btn btn-secondary btn-sm";
  open.textContent = "Settings";
  open.title = `Open the Settings section for ${entry.label}`;
  open.addEventListener("click", () => {
    // A tab, not `openOptionsPage`: the fragment is the only way to land on a
    // section rather than at the top of a 4000px page, and that call cannot
    // carry one.
    void chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#${entry.section}`) });
  });

  line.append(text, open);
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
   * and pushes the primary button — the one thing on the screen that has to be
   * reachable — below the fold, to give advice to somebody who has just
   * demonstrated they can find the icon.
   */
  if (!isFullView) return undefined;
  if (readStored(PIN_DISMISSED_KEY) === "1") return undefined;

  const card = document.createElement("div");
  card.className = "pincard";

  const glyph = icon("pin");
  glyph.classList.add("pincard--glyph");

  const text = document.createElement("div");
  text.className = "pincard--text";
  const title = document.createElement("b");
  title.textContent = "Pin Illini Dash to your toolbar";
  const how = document.createElement("span");
  how.textContent =
    "Chrome hides new extensions behind the puzzle icon — so does the badge that tells you " +
    "something's due. Click it, then the pin beside Illini Dash.";
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
