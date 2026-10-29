// Only this small formatting vocabulary is persisted or rendered. No links,
// event handlers, images, classes, or arbitrary CSS survive normalization.
const tags = new Set([
  "p",
  "div",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "span",
  "font",
  "ul",
  "ol",
  "li",
  "sup",
  "sub",
  "blockquote",
]);
const discard = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "template",
  "noscript",
]);
export function safeColor(value: string): string | undefined {
  const color = value.trim();
  return /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%/+-]+\)|black|white|red|green|blue|orange|purple|gray|grey|yellow|teal|navy|maroon|brown|pink|transparent|inherit)$/i.test(
    color,
  )
    ? color
    : undefined;
}
export function richDocument(value: string): Document {
  const parsed = new DOMParser().parseFromString(value, "text/html");
  const output = document.implementation.createHTMLDocument("");
  function append(source: Node, parent: Node) {
    if (source.nodeType === Node.TEXT_NODE) {
      parent.appendChild(output.createTextNode(source.textContent || ""));
      return;
    }
    if (source.nodeType !== Node.ELEMENT_NODE) return;
    const element = source as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (discard.has(tag)) return;
    if (!tags.has(tag)) {
      for (const child of Array.from(source.childNodes)) append(child, parent);
      return;
    }
    const target = output.createElement(tag === "font" ? "span" : tag);
    const color = safeColor(
      element.style.color || element.getAttribute("color") || "",
    );
    if (color) target.style.color = color;
    if (
      ["bold", "bolder", "600", "700", "800", "900"].includes(
        element.style.fontWeight,
      )
    )
      target.style.fontWeight = "bold";
    if (element.style.fontStyle === "italic") target.style.fontStyle = "italic";
    if (element.style.textDecoration.includes("underline"))
      target.style.textDecoration = "underline";
    for (const child of Array.from(source.childNodes)) append(child, target);
    parent.appendChild(target);
  }
  if (
    !/<\/?[a-z][^>]*>/i.test(value) &&
    !/&(?:#\d+|#x[\da-f]+|[a-z]+);/i.test(value)
  )
    output.body.textContent = value;
  else
    for (const child of Array.from(parsed.body.childNodes))
      append(child, output.body);
  return output;
}
export function sanitizeRichText(value: string): string {
  return richDocument(value).body.innerHTML;
}
export function plainRichText(value: unknown): string {
  const text = String(value ?? "");
  if (typeof DOMParser === "undefined")
    return text
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim();
  return (richDocument(text).body.textContent || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}
export function isRichColumn(key: string) {
  return (
    key === "question_text" ||
    key === "questionText" ||
    /^option[1-4](?:_text|Text)$/.test(key)
  );
}
