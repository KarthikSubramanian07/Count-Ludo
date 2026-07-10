// Tiny DOM helpers so the rest of the UI reads as markup, not as a wall of
// document.createElement calls. No framework, no virtual DOM: this is a small
// enough app that plain elements are faster to ship and to understand.

type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(node: Element, attrs: Attrs, children: Child[]): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.setAttribute('class', String(value));
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
}

/** Create an HTML element. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  apply(node, attrs, children);
  return node;
}

/** Create an SVG element. */
export function s(
  tag: string,
  attrs: Attrs = {},
  ...children: Child[]
): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  apply(node, attrs, children);
  return node;
}

/** Remove all children of a node. */
export function clear(node: Element): void {
  node.replaceChildren();
}

/** querySelector that throws instead of returning null (fail loud, fail early). */
export function must<T extends Element = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Expected element "${selector}" to exist`);
  return el;
}

/** "red" -> "Red". Used for the color names shown throughout the UI. */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
