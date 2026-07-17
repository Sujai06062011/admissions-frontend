"use client";

import { useRef } from "react";

export type DocSlotStatus = "idle" | "uploading" | "uploaded" | "error";

export interface DocSlotViewProps {
  label: string;
  helperText: string;
  status: DocSlotStatus;
  fileName?: string;
  errorMessage?: string;
  onSelectFile: (file: File) => void;
  onRemove?: () => void;
}

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png";

export function DocumentUploadCard({
  label,
  helperText,
  status,
  fileName,
  errorMessage,
  onSelectFile,
  onRemove,
}: DocSlotViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const isUploaded = status === "uploaded";
  const isError = status === "error";
  const isUploading = status === "uploading";

  const borderClasses = isUploaded
    ? "border-solid border-forest bg-forest-soft"
    : isError
      ? "border-solid border-brick bg-brick-soft"
      : "border-dashed border-border";

  const iconClasses = isUploaded
    ? "bg-forest text-white"
    : isError
      ? "bg-brick text-white"
      : "bg-[#E9EDF5]";

  const buttonClasses = isUploaded
    ? "border-forest text-forest"
    : isError
      ? "border-brick text-brick"
      : "border-ink text-ink";

  const helper = isError
    ? errorMessage || "Upload failed"
    : isUploading
      ? "Uploading…"
      : isUploaded
        ? fileName
        : helperText;

  const helperClasses = isUploaded
    ? "text-forest font-semibold"
    : isError
      ? "text-brick font-semibold"
      : "text-text-muted";

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onSelectFile(file);
    event.target.value = "";
  }

  return (
    <div
      className={`flex items-center justify-between border-[1.5px] rounded-[11px] px-[18px] py-[15px] ${borderClasses}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-[9px] flex items-center justify-center text-[15px] shrink-0 ${iconClasses}`}
        >
          {isUploaded ? "✓" : isError ? "!" : "📄"}
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold truncate">{label}</div>
          <div className={`text-[11px] mt-px truncate ${helperClasses}`}>{helper}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isUploaded && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[12px] font-semibold text-text-muted hover:text-brick"
          >
            Remove
          </button>
        )}
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className={`px-3.5 py-[7px] rounded-lg text-xs font-semibold border-[1.5px] bg-white disabled:opacity-60 disabled:cursor-not-allowed ${buttonClasses}`}
        >
          {isUploading ? "Uploading…" : isUploaded ? "Replace" : isError ? "Retry" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
