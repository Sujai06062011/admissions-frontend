"use client";

import { useMemo, useState } from "react";
import { BrandHeader } from "./BrandHeader";
import { Stepper } from "./Stepper";
import {
  REVIEW_FIELD_SCHEMAS,
  REVIEW_SECTION_ORDER,
  REVIEW_SECTION_TITLES,
} from "@/lib/documentTypes";
import { ApiError, updateApplicationProfile } from "@/lib/api";
import { isMeaningfulExperienceEntry, type ExperienceEntry } from "@/lib/experience";
import type { ApplicationProfileResponse, CertificationEntry } from "@/lib/types";
import type { ReviewedData } from "./ReviewStep";

export interface ConfirmStepProps {
  profile: ApplicationProfileResponse;
  reviewed: ReviewedData;
  experienceEntries: ExperienceEntry[];
  onSubmitted: () => void;
  onBack: () => void;
}

const NUMERIC_FIELD_KEYS = new Set(["percentage", "cgpa", "year"]);

const GENDER_LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

function toFieldValue(key: string, value: string): string | number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (NUMERIC_FIELD_KEYS.has(key)) {
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return trimmed;
}

function yearsBetween(from: string, to: string): number {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  const ms = end.getTime() - start.getTime();
  return ms > 0 ? ms / (1000 * 60 * 60 * 24 * 365.25) : 0;
}

/**
 * The admissions-backend matching engine (app/preferences/matching.py) reads
 * flat top-level keys like `10th_percentage` straight off profile_data.data —
 * it has no knowledge of the `documents{}`/`experience[]` shape above. Without
 * this, hard-cutoff screening and composite scoring silently treat every
 * applicant as missing all fields. Mirrors the exact field_names configured
 * via the admin Preferences screen (lib/adminMatching.ts / adminApi.ts).
 */
function computeFlatMatchFields(
  profile: ApplicationProfileResponse,
  reviewed: ReviewedData,
  experienceEntries: ExperienceEntry[],
): Record<string, number> {
  const flat: Record<string, number> = {};

  function percentageFor(docType: string): number | null {
    const doc = profile.documents.find((d) => d.doc_type === docType);
    if (!doc) return null;
    const fields = reviewed[doc.id];
    const value = toFieldValue("percentage", fields?.percentage ?? "");
    return typeof value === "number" ? value : null;
  }

  const tenth = percentageFor("10th_marksheet");
  if (tenth !== null) flat["10th_percentage"] = tenth;

  const twelfth = percentageFor("12th_marksheet");
  if (twelfth !== null) flat["12th_percentage"] = twelfth;

  const ug = percentageFor("ug_marksheet");
  if (ug !== null) flat["ug_percentage"] = ug;

  const certificationDocs = profile.documents.filter((d) => d.doc_type === "certifications");
  if (certificationDocs.length > 0) {
    flat["certifications_count"] = certificationDocs.reduce((sum, doc) => {
      const parsed = doc.ocr_result?.parsed?.certifications;
      // Each cert doc may itself list multiple named certifications via OCR;
      // fall back to counting the upload itself if OCR found nothing.
      return sum + (Array.isArray(parsed) && parsed.length > 0 ? parsed.length : 1);
    }, 0);
  }

  const meaningful = experienceEntries.filter(isMeaningfulExperienceEntry);
  if (meaningful.length > 0) {
    const totalYears = meaningful.reduce(
      (sum, entry) => (entry.from ? sum + yearsBetween(entry.from, entry.to) : sum),
      0,
    );
    flat["experience_years"] = Math.round(totalYears * 10) / 10;
  }

  return flat;
}

function buildProfilePayload(
  profile: ApplicationProfileResponse,
  reviewed: ReviewedData,
  experienceEntries: ExperienceEntry[],
): Record<string, unknown> {
  const documents: Record<string, unknown> = {};
  for (const doc of profile.documents) {
    const fields = reviewed[doc.id];
    if (!fields) continue;
    const schema = REVIEW_FIELD_SCHEMAS[doc.doc_type] ?? [];
    const docPayload: Record<string, unknown> = { doc_type: doc.doc_type };
    for (const { key } of schema) {
      docPayload[key] = toFieldValue(key, fields[key] ?? "");
    }
    documents[doc.id] = docPayload;
  }

  const experience = experienceEntries.filter(isMeaningfulExperienceEntry).map((entry) => ({
    company: entry.company.trim() || null,
    role: entry.role.trim() || null,
    from: entry.from || null,
    to: entry.to || null,
    document_id: entry.documentId ?? null,
  }));

  return {
    ...profile.profile_data?.data,
    documents,
    experience,
    ...computeFlatMatchFields(profile, reviewed, experienceEntries),
  };
}

export function ConfirmStep({
  profile,
  reviewed,
  experienceEntries,
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
        buildProfilePayload(profile, reviewed, experienceEntries),
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

  const reviewableDocs = useMemo(
    () =>
      profile.documents
        .filter((doc) => REVIEW_FIELD_SCHEMAS[doc.doc_type] !== undefined)
        .sort(
          (a, b) =>
            REVIEW_SECTION_ORDER.indexOf(a.doc_type) -
            REVIEW_SECTION_ORDER.indexOf(b.doc_type),
        ),
    [profile],
  );
  const certificationDocs = profile.documents.filter(
    (doc) => doc.doc_type === "certifications",
  );
  const meaningfulExperience = experienceEntries.filter(isMeaningfulExperienceEntry);
  const profileData = profile.profile_data?.data ?? {};
  const dob = typeof profileData.dob === "string" ? profileData.dob : null;
  const gender =
    typeof profileData.gender === "string"
      ? (GENDER_LABELS[profileData.gender] ?? profileData.gender)
      : null;

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
        <div className="flex justify-between py-[11px] border-b border-border text-[13.5px]">
          <span className="text-xs text-text-muted">Email</span>
          <span className="font-semibold">{profile.applicant.email}</span>
        </div>
        <div className="flex justify-between py-[11px] border-b border-border text-[13.5px]">
          <span className="text-xs text-text-muted">Date of Birth</span>
          <span className="font-semibold">{dob || "—"}</span>
        </div>
        <div className="flex justify-between py-[11px] text-[13.5px]">
          <span className="text-xs text-text-muted">Gender</span>
          <span className="font-semibold">{gender || "—"}</span>
        </div>
      </div>

      {reviewableDocs.map((doc) => {
        const fields = reviewed[doc.id];
        if (!fields) return null;
        const schema = REVIEW_FIELD_SCHEMAS[doc.doc_type] ?? [];
        return (
          <div
            key={doc.id}
            className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5"
          >
            <div className="font-serif text-[16.5px] font-semibold mb-1">
              {REVIEW_SECTION_TITLES[doc.doc_type]}
            </div>
            {schema.map(({ key, label }) => (
              <div
                key={key}
                className="flex justify-between py-[11px] border-b border-border last:border-b-0 text-[13.5px]"
              >
                <span className="text-xs text-text-muted">{label}</span>
                <span className="font-semibold">{fields[key] || "—"}</span>
              </div>
            ))}
          </div>
        );
      })}

      {certificationDocs.length > 0 && (
        <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
          <div className="font-serif text-[16.5px] font-semibold mb-4">
            Certifications
          </div>
          {certificationDocs.map((doc, index) => {
            const certifications =
              (doc.ocr_result?.parsed?.certifications as CertificationEntry[] | undefined) ??
              [];
            return (
              <div
                key={doc.id}
                className="py-[11px] border-b border-border last:border-b-0 text-[13.5px]"
              >
                <div className="flex justify-between">
                  <span className="text-xs text-text-muted">
                    Certification {index + 1}
                  </span>
                  <span className="font-semibold">Attached</span>
                </div>
                {certifications.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {certifications.map((cert, certIndex) => (
                      <li key={certIndex} className="text-xs text-text-muted">
                        {cert.name}
                        {cert.issuer ? ` — ${cert.issuer}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {meaningfulExperience.length > 0 && (
        <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
          <div className="font-serif text-[16.5px] font-semibold mb-4">
            Professional Details
          </div>
          {meaningfulExperience.map((entry) => (
            <div
              key={entry.id}
              className="py-[11px] border-b border-border last:border-b-0 text-[13.5px]"
            >
              <div className="font-semibold mb-1">
                {entry.role || "—"} · {entry.company || "—"}
              </div>
              <div className="text-xs text-text-muted">
                {entry.from || "—"} to {entry.to || "—"}
                {entry.fileName ? ` · ${entry.fileName}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

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
