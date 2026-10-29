"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Spinner } from "./loading";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "text";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  href?: string;
  target?: string;
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      href,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    // Map variant to existing CSS classes for complete style alignment
    const variantClass =
      variant === "secondary"
        ? "secondary"
        : variant === "danger"
          ? "danger"
          : variant === "ghost"
            ? "ghost"
            : variant === "text"
              ? "text-button"
              : "";

    const sizeClass = size === "sm" ? "small" : "";
    const baseClass = variant === "text" ? "text-button" : "button";

    const combinedClassName = [
      baseClass,
      variantClass,
      sizeClass,
      loading ? "is-loading" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const content = (
      <>
        {loading && <Spinner size={size === "sm" ? "sm" : "md"} />}
        {!loading && leftIcon && <span className="btn-icon left">{leftIcon}</span>}
        <span>{children}</span>
        {!loading && rightIcon && <span className="btn-icon right">{rightIcon}</span>}
      </>
    );

    if (href) {
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={combinedClassName}
          aria-disabled={disabled || loading}
          onClick={(e) => {
            if (disabled || loading) e.preventDefault();
          }}
          {...(props as any)}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        disabled={disabled || loading}
        className={combinedClassName}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button";
