"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmModal } from "./modal";

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  isDangerous?: boolean;
}

// `const { confirm, dialog } = useConfirm()`; render `dialog`, then
// `if (await confirm({...}))` before a destructive or status-changing action.
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);
  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const dialog = options ? (
    <ConfirmModal
      isOpen
      title={options.title}
      message={options.message}
      confirmLabel={options.confirmLabel}
      isDangerous={options.isDangerous}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null;
  return { confirm, dialog };
}
