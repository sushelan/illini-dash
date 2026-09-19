(() => {
  const styleKeys = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "color", "backgroundColor", "borderColor", "borderRadius", "padding", "gap", "overflow", "textOverflow", "whiteSpace"];
  const elements = [...document.querySelectorAll('body, h1, h2, .wordmark, .row--title, .row--code, button, a, input, select, textarea, svg, [role="tab"], .menu-surface')]
    .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
    .map((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const label = el.getAttribute("aria-label") || el.labels?.[0]?.textContent || el.textContent?.trim() || el.getAttribute("title") || "";
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        tag: el.tagName, id: el.id, classes: el.getAttribute("class"), label: label.slice(0, 240),
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        style: Object.fromEntries(styleKeys.map((key) => [key, style[key]])),
        scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
        horizontalOverflow: el.scrollWidth > el.clientWidth + 1,
        centerVisible: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
        centerHit: hit === el || el.contains(hit),
        disabled: !!el.disabled, role: el.getAttribute("role"),
        selected: el.getAttribute("aria-selected"),
      };
    });
  return {
    url: location.href, title: document.title,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    clock: globalThis.__PREVIEW_CLOCK__, now: new Date().toISOString(),
    locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    design: document.documentElement.dataset.design,
    dark: document.documentElement.classList.contains("is-dark"),
    systemDark: matchMedia("(prefers-color-scheme: dark)").matches,
    buildId: globalThis.__PREVIEW_BUILD__,
    fontFaces: [...document.fonts].map((f) => ({ family: f.family, weight: f.weight, style: f.style, status: f.status })),
    stylesheets: [...document.styleSheets].map((s) => s.href),
    documentSize: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    activeElement: document.activeElement?.outerHTML.slice(0, 400),
    text: document.body.innerText,
    elements,
    preview: globalThis.__UI_ACCEPTANCE__,
  };
})()
