/**
 * The heading a tab's sections wear: a label, and a count on its right.
 *
 * One copy, because two tabs draw it. It was a private helper in `alerts.ts`
 * until the Sources section moved to its own tab (2026-09-19), and a second
 * copy there would have been the `resolveColumn` finding again — two spellings
 * of one rule, each of which can be restyled without the other.
 *
 * `design-classical.css` styles `.section-head > :last-child:not(:first-child)`
 * at (0,4,1), which is why the count is only appended when there is one: a
 * bare label must stay the *first* child, or the shared sheet paints it as a
 * count (the specificity finding of 2026-09-19).
 */
export function sectionHead(label: string, count?: string): HTMLElement {
  const head = document.createElement("div");
  head.className = "section-head";
  const text = document.createElement("span");
  text.textContent = label;
  head.append(text);
  if (count !== undefined) {
    const right = document.createElement("span");
    right.textContent = count;
    head.append(right);
  }
  return head;
}
