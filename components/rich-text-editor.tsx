"use client";
import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  plainRichText,
  richDocument,
  safeColor,
  sanitizeRichText,
} from "../lib/rich-text";

export function RichText({ value }: { value: unknown }) {
  const text = String(value ?? "");
  const [content, setContent] = useState<ReactNode>(null);
  useEffect(() => {
    function render(node: Node, key: string): ReactNode {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      const el = node as HTMLElement;
      const style: Record<string, string> = {};
      if (el.style.color) style.color = el.style.color;
      if (el.style.fontWeight) style.fontWeight = el.style.fontWeight;
      if (el.style.fontStyle) style.fontStyle = el.style.fontStyle;
      if (el.style.textDecoration)
        style.textDecoration = el.style.textDecoration;
      return createElement(
        el.tagName.toLowerCase(),
        { key, style },
        el.tagName === "BR"
          ? undefined
          : Array.from(el.childNodes).map((child, i) =>
              render(child, `${key}-${i}`),
            ),
      );
    }
    setContent(
      Array.from(richDocument(text).body.childNodes).map((node, i) =>
        render(node, String(i)),
      ),
    );
  }, [text]);
  return (
    <div className="rich-content">
      {content ??
        text
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .trim()}
    </div>
  );
}

export function RichTextEditor({
  id,
  name,
  label,
  initial,
  disabled = false,
  required = false,
  describedBy,
}: {
  id: string;
  name: string;
  label: string;
  initial: string;
  disabled?: boolean;
  required?: boolean;
  describedBy?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const [html, setHtml] = useState(initial);
  const [color, setColor] = useState("#343434");
  const [active, setActive] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (root.current) {
      const body = richDocument(initial).body;
      root.current.replaceChildren(...Array.from(body.childNodes));
      setHtml(sanitizeRichText(initial));
    }
  }, [initial]);
  function remember() {
    const current = window.getSelection();
    if (!root.current || !current?.rangeCount) return;
    const range = current.getRangeAt(0);
    if (!root.current.contains(range.commonAncestorContainer)) return;
    selection.current = range.cloneRange();
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
    });
  }
  function sync() {
    if (root.current) setHtml(sanitizeRichText(root.current.innerHTML));
    remember();
  }
  function command(action: string, value?: string) {
    if (disabled || !root.current) return;
    root.current.focus();
    const current = window.getSelection();
    if (
      selection.current &&
      root.current.contains(selection.current.commonAncestorContainer)
    ) {
      current?.removeAllRanges();
      current?.addRange(selection.current);
    }
    // Native editing commands preserve the browser's selection and undo history.
    // Reference: https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(action, false, value);
    sync();
  }
  return (
    <div className={`rich-editor ${disabled ? "is-disabled" : ""}`}>
      <div
        className="rich-toolbar"
        role="group"
        aria-label={`${label} formatting`}
      >
        {(["bold", "italic", "underline"] as const).map((action) => (
          <button
            key={action}
            type="button"
            className="rich-tool"
            aria-label={action[0].toUpperCase() + action.slice(1)}
            title={action[0].toUpperCase() + action.slice(1)}
            aria-pressed={!!active[action]}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command(action)}
          >
            {action === "bold" ? (
              <strong>B</strong>
            ) : action === "italic" ? (
              <em>I</em>
            ) : (
              <u>U</u>
            )}
          </button>
        ))}
        <label className="rich-color" htmlFor={`${id}-color`}>
          Text color
          <input
            id={`${id}-color`}
            type="color"
            value={color}
            disabled={disabled}
            onPointerDown={remember}
            onChange={(event) => {
              const value = event.target.value;
              if (safeColor(value)) {
                setColor(value);
                command("foreColor", value);
              }
            }}
          />
        </label>
        <button
          type="button"
          className="rich-tool"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("insertUnorderedList")}
        >
          Bullets
        </button>
        <button
          type="button"
          className="rich-tool"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("removeFormat")}
        >
          Clear formatting
        </button>
      </div>
      <div
        id={id}
        ref={root}
        className="rich-editor-body"
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        aria-required={required}
        aria-disabled={disabled}
        aria-describedby={describedBy}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder="Write your question here…"
        onInput={sync}
        onKeyUp={remember}
        onMouseUp={remember}
        onBlur={sync}
        onPaste={(event) => {
          event.preventDefault();
          if (disabled) return;
          const rich = event.clipboardData.getData("text/html");
          if (rich) command("insertHTML", sanitizeRichText(rich));
          else command("insertText", event.clipboardData.getData("text/plain"));
        }}
        onDrop={(event) => event.preventDefault()}
      />
      <input
        type="hidden"
        name={name}
        value={html}
        disabled={disabled}
        readOnly
      />
      <div className="rich-editor-hint">
        Select text to format it. Use Ctrl/⌘ + B or I for bold or italic.
      </div>
    </div>
  );
}
