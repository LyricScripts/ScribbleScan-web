// Tiny DOM helpers: the whole UI is built from h() calls, no framework.

export type Child = Node | string | number | null | undefined | false | Child[];
type Handler = (event: Event) => unknown;
type Attrs = Record<
  string,
  string | number | boolean | null | undefined | Handler | Partial<CSSStyleDeclaration>
>;

export function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`missing element ${selector}`);
  return el;
}

/** Flattens nested children and drops null/undefined/false, so views can use `cond ? h(...) : null`. */
export function flat(kids: Child[], out: (Node | string)[] = []): (Node | string)[] {
  for (const k of kids) {
    if (Array.isArray(k)) flat(k, out);
    else if (k != null && k !== false) out.push(typeof k === "number" ? String(k) : k);
  }
  return out;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...kids: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as Handler);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  el.append(...flat(kids));
  return el;
}

export function render(el: Element, ...kids: Child[]): void {
  el.replaceChildren(...flat(kids));
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string): void {
  const t = $("#toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

export const categoryColor = (c: string) => `var(--c-${c}, var(--c-other))`;
