"use client";

import { useState } from "react";
import { BrandHeader } from "./BrandHeader";
import { Stepper } from "./Stepper";
import { REVIEW_SECTION_TITLES } from "@/lib/documentTypes";
import { ApiError, updateApplicationProfile } from "@/lib/api";
import type { ApplicationProfileResponse } from "@/lib/types";
import type { ReviewedData } from "./ReviewStep";

export interface ConfirmStepProps {
  profile: ApplicationProfileResponse;
  reviewed: ReviewedData;
  onSubmitted: () => void;
  onBack: () => void;
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function buildProfilePayload(
  profile: ApplicationProfileResponse,
  reviewed: ReviewedData,
): Record<string, unknown> {
  const documents: Record<string, unknown> = {};
  for (const doc of profile.documents) {
    const fields = reviewed[doc.id];
    if (!fields) continue;
    documents[doc.id] = {
      doc_type: doc.doc_type,
      board_or_university: fields.board_or_university.trim() || null,
      percentage: toNumberOrNull(fields.percentage),
      cgpa: toNumberOrNull(fields.cgpa),
      year: toNumberOrNull(fields.year),
    };
  }
  return { ...profile.profile_data?.data, documents };
}

export function ConfirmStep({
  profile,
  reviewed,
  onSubmitted,
  onBack,
}: ConfirmStepProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await updateApplicationProfile(
        profile.application.id,
        buildProfilePayload(profile, reviewed),
      );
      onSubmitted();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Couldn't submit your application: ${err.message}`
          : "Couldn't submit your application. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const reviewableDocs = profile.documents.filter(
    (doc) => REVIEW_SECTION_TITLES[doc.doc_type] !== undefined,
  );

  return (
    <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
      <BrandHeader />
      <Stepper
        steps={[
          { label: "Basic Info", status: "done" },
          { label: "Review", status: "done" },
          { label: "Submit", status: "active" },
        ]}
      />

      <h1 className="font-serif text-[27px] font-semibold mb-1.5">
        Confirm & submit
      </h1>
      <div className="text-[13.5px] text-text-muted mb-8">
        Take one last look — once submitted, you&apos;ll move on to the next
        stage of the admissions process.
      </div>

      {error && (
        <div className="mb-5 rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {error}
        </div>
      )}

      <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
        <div className="font-serif text-[16.5px] font-semibold mb-4">
          Applicant
        </div>
        <div className="flex justify-between py-[11px] border-b border-border text-[13.5px]">
          <span className="text-xs text-text-muted">Full Name</span>
          <span className="font-semibold">{profile.applicant.full_name}</span>
        </div>
        <div className="flex justify-between py-[11px] border-b border-border text-[13.5px]">
          <span className="text-xs text-text-muted">Mobile</span>
          <span className="font-semibold">{profile.applicant.phone}</span>
        </div>
        <div className="flex justify-between py-[11px] text-[13.5px]">
          <span className="text-xs text-text-muted">Email</span>
          <span className="font-semibold">{profile.applicant.email}</span>
        </div>
      </div>

      {reviewableDocs.map((doc) => {
        const fields = reviewed[doc.id];
        if (!fields) return null;
        return (
          <div
            key={doc.id}
            className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5"
          >
            <div className="font-serif text-[16.5px] font-semibold mb-1">
              {REVIEW_SECTION_TITLES[doc.doc_type]}
            </div>
            <div className="flex justify-between py-[11px] border-b border-border text-[13.5px]">
              <span className="text-xs text-text-muted">Board / University</span>
              <span className="font-semibold">
                {fields.board_or_university || "—"}
              </span>
            </div>
            <div className="flex justify-between py-[11px] border-b border-border text-[13.5px]">
              <span className="text-xs text-text-muted">Percentage</span>
              <span className="font-semibold">{fields.percentage || "—"}</span>
            </div>
            <div className="flex justify-between py-[11px] border-b border-border text-[13.5px]">
              <span className="text-xs text-text-muted">CGPA</span>
              <span className="font-semibold">{fields.cgpa || "—"}</span>
            </div>
            <div className="flex justify-between py-[11px] text-[13.5px]">
              <span className="text-xs text-text-muted">Year</span>
              <span className="font-semibold">{fields.year || "—"}</span>
            </div>
          </div>
        );
      })}

      <div className="flex justify-between mt-7">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="px-[26px] py-3 rounded-[10px] border-[1.5px] border-border text-text-muted text-sm font-semibold hover:border-ink hover:text-ink disabled:opacity-60 cursor-pointer"
        >
          ← Back to review
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="px-[26px] py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark disabled:opacity-60 cursor-pointer"
        >
          {submitting ? "Submitting…" : "Confirm & Submit"}
        </button>
      </div>
    </div>
  );
}
