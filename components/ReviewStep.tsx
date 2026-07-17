"use client";

import { useState } from "react";
import { BrandHeader } from "./BrandHeader";
import { Stepper } from "./Stepper";
import { REVIEW_SECTION_TITLES } from "@/lib/documentTypes";
import type { ApplicationProfileResponse, UploadedDocument } from "@/lib/types";

export interface ReviewedFields {
  board_or_university: string;
  percentage: string;
  cgpa: string;
  year: string;
}

export type ReviewedData = Record<string, ReviewedFields>;

export interface ReviewStepProps {
  profile: ApplicationProfileResponse;
  onContinue: (reviewed: ReviewedData) => void;
}

const CONFIDENCE_THRESHOLD = 0.7;

function initialFieldsFor(doc: UploadedDocument): ReviewedFields {
  const parsed = doc.ocr_result?.parsed;
  return {
    board_or_university: parsed?.board_or_university ?? "",
    percentage: parsed?.percentage != null ? String(parsed.percentage) : "",
    cgpa: parsed?.cgpa != null ? String(parsed.cgpa) : "",
    year: parsed?.year != null ? String(parsed.year) : "",
  };
}

function ConfidenceTag({
  confidence,
  hasValue,
}: {
  confidence: number | null;
  hasValue: boolean;
}) {
  if (confidence == null || !hasValue) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-text-muted bg-[#E4EDEE] px-[7px] py-[2px] rounded-full ml-2">
        Enter manually
      </span>
    );
  }
  const isConfident = confidence >= CONFIDENCE_THRESHOLD;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-[7px] py-[2px] rounded-full ml-2 ${
        isConfident ? "text-gold bg-gold-soft" : "text-brick bg-brick-soft"
      }`}
    >
      {isConfident ? "Auto-filled" : "Please verify"}
    </span>
  );
}

function ReviewField({
  label,
  value,
  confidence,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  confidence: number | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center justify-between py-[11px] border-b border-border last:border-b-0 gap-4">
      <span className="text-xs text-text-muted shrink-0">{label}</span>
      <div className="flex items-center min-w-0">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="text-[13.5px] font-semibold text-right bg-transparent border-b border-transparent hover:border-border focus:border-ink-light focus:outline-none px-1 py-0.5 w-[140px]"
        />
        <ConfidenceTag confidence={confidence} hasValue={value.trim() !== ""} />
      </div>
    </div>
  );
}

export function ReviewStep({ profile, onContinue }: ReviewStepProps) {
  const reviewableDocs = profile.documents.filter(
    (doc) => REVIEW_SECTION_TITLES[doc.doc_type] !== undefined,
  );

  const [fields, setFields] = useState<ReviewedData>(() => {
    const initial: ReviewedData = {};
    for (const doc of reviewableDocs) {
      initial[doc.id] = initialFieldsFor(doc);
    }
    return initial;
  });

  function updateField(docId: string, key: keyof ReviewedFields, value: string) {
    setFields((prev) => ({
      ...prev,
      [docId]: { ...prev[docId], [key]: value },
    }));
  }

  return (
    <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
      <BrandHeader />
      <Stepper
        steps={[
          { label: "Basic Info", status: "done" },
          { label: "Review", status: "active" },
          { label: "Submit", status: "upcoming" },
        ]}
      />

      <h1 className="font-serif text-[27px] font-semibold mb-1.5">
        Review your details
      </h1>
      <div className="text-[13.5px] text-text-muted mb-8">
        We&apos;ve pre-filled this from your documents — please check
        everything carefully before submitting.
      </div>

      {reviewableDocs.length === 0 && (
        <div className="text-[13.5px] text-text-muted mb-5">
          No marksheets to review.
        </div>
      )}

      {reviewableDocs.map((doc) => {
        const values = fields[doc.id];
        const confidence = doc.ocr_result ? doc.ocr_confidence : null;
        return (
          <div
            key={doc.id}
            className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5"
          >
            <div className="font-serif text-[16.5px] font-semibold mb-1">
              {REVIEW_SECTION_TITLES[doc.doc_type]}
            </div>
            <ReviewField
              label="Board / University"
              value={values.board_or_university}
              confidence={confidence}
              placeholder="Enter manually"
              onChange={(v) => updateField(doc.id, "board_or_university", v)}
            />
            <ReviewField
              label="Percentage"
              value={values.percentage}
              confidence={confidence}
              placeholder="Enter manually"
              onChange={(v) => updateField(doc.id, "percentage", v)}
            />
            <ReviewField
              label="CGPA"
              value={values.cgpa}
              confidence={confidence}
              placeholder="Enter manually"
              onChange={(v) => updateField(doc.id, "cgpa", v)}
            />
            <ReviewField
              label="Year"
              value={values.year}
              confidence={confidence}
              placeholder="Enter manually"
              onChange={(v) => updateField(doc.id, "year", v)}
            />
          </div>
        );
      })}

      <div className="flex justify-end mt-7">
        <button
          type="button"
          onClick={() => onContinue(fields)}
          className="px-[26px] py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark cursor-pointer"
        >
          Looks good, continue →
        </button>
      </div>
    </div>
  );
}
