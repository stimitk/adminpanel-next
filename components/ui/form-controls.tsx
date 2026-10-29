"use client";
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export interface FormFieldProps {
  label: ReactNode;
  id?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}

export function FormField({
  label,
  id,
  required = false,
  hint,
  error,
  children,
  className = "",
  wide = false,
}: FormFieldProps) {
  return (
    <div className={`field ${wide ? "field-wide" : ""} ${className}`.trim()}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <small id={id ? `${id}-help` : undefined}>{hint}</small>}
      {error && (
        <small className="field-error" style={{ color: "var(--danger)" }}>
          {error}
        </small>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return <input ref={ref} className={className} {...props} />;
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", rows = 4, ...props }, ref) => {
    return <textarea ref={ref} rows={rows} className={className} {...props} />;
  }
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <select ref={ref} className={className} {...props}>
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";
