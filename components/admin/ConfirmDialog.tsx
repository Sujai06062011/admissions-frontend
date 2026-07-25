"use client";

import type { ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  /** Disables the confirm button independently of `loading` — e.g. while a required field (like an override reason) is still empty. */
  confirmDisabled?: boolean;
  /** Optional extra content (e.g. a reason field) rendered between the description and the action buttons. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-bold text-text mb-2">{title}</h3>
        {description && <p className="text-sm text-text-muted mb-5">{description}</p>}
        {children && <div className="mb-5">{children}</div>}
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text hover:bg-bg transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed ${
              tone === "danger" ? "bg-brick hover:bg-brick/90" : "bg-ink hover:bg-ink-dark"
            }`}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
