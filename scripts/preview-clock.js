;(() => {
  const value = new URLSearchParams(location.search).get("at");
  if (value === null) return;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("Preview at= must be a UTC ISO instant");
  }
  const NativeDate = Date;
  const now = NativeDate.parse(value);
  // Proxy preserves Date() as a function, constructor overloads and instanceof.
  globalThis.Date = new Proxy(NativeDate, {
    construct(target, args) { return Reflect.construct(target, args.length ? args : [now]); },
    apply() { return new NativeDate(now).toString(); },
    get(target, key) { return key === "now" ? () => now : Reflect.get(target, key); },
  });
  globalThis.__PREVIEW_CLOCK__ = value;
})();
