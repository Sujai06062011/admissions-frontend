"use client";

import { useMemo, useState } from "react";
import { BrandHeader } from "./BrandHeader";
import { Stepper } from "./Stepper";
import {
  dedupeSingletonDocuments,
  REVIEW_FIELD_SCHEMAS,
  REVIEW_SECTION_ORDER,
  REVIEW_SECTION_TITLES,
} from "@/lib/documentTypes";
import { isMeaningfulExperienceEntry, type ExperienceEntry } from "@/lib/experience";
import { ocrFieldsFor, type ReviewedData, type ReviewedFields } from "@/lib/reviewFields";
import type { ApplicationProfileResponse, CertificationEntry } from "@/lib/types";

export type { ReviewedData, ReviewedFields };

export interface ReviewStepProps {
  profile: ApplicationProfileResponse;
  experienceEntries: ExperienceEntry[];
  initialValues?: ReviewedData;
  initialExperienceEntries?: ExperienceEntry[];
  onContinue: (reviewed: ReviewedData, experienceEntries: ExperienceEntry[]) => void;
  onBack: () => void;
}

const CONFIDENCE_THRESHOLD = 0.7;

function FieldTag({
  touched,
  originalHasValue,
  confidence,
}: {
  touched: boolean;
  originalHasValue: boolean;
  confidence: number | null;
}) {
  if (touched) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-light bg-[#E4EDEE] px-[7px] py-[2px] rounded-full ml-2">
        Edited
      </span>
    );
  }
  if (!originalHasValue || confidence == null) {
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
  touched,
  originalHasValue,
  confidence,
  onChange,
}: {
  label: string;
  value: string;
  touched: boolean;
  originalHasValue: boolean;
  confidence: number | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-[11px] border-b border-border last:border-b-0 gap-4">
      <span className="text-xs text-text-muted shrink-0">{label}</span>
      <div className="flex items-center min-w-0">
        <input
          type="text"
          value={value}
          placeholder="Enter manually"
          onChange={(e) => onChange(e.target.value)}
          className="text-[13.5px] font-semibold text-right bg-transparent border-b border-transparent hover:border-border focus:border-ink-light focus:outline-none px-1 py-0.5 w-[140px]"
        />
        <FieldTag
          touched={touched}
          originalHasValue={originalHasValue}
          confidence={confidence}
        />
      </div>
    </div>
  );
}

export function ReviewStep({
  profile,
  experienceEntries,
  initialValues,
  initialExperienceEntries,
  onContinue,
  onBack,
}: ReviewStepProps) {
  const dedupedDocuments = useMemo(() => dedupeSingletonDocuments(profile.documents), [profile]);

  const reviewableDocs = useMemo(
    () =>
      dedupedDocuments
        .filter((doc) => REVIEW_FIELD_SCHEMAS[doc.doc_type] !== undefined)
        .sort(
          (a, b) =>
            REVIEW_SECTION_ORDER.indexOf(a.doc_type) -
            REVIEW_SECTION_ORDER.indexOf(b.doc_type),
        ),
    [dedupedDocuments],
  );
  const certificationDocs = dedupedDocuments.filter(
    (doc) => doc.doc_type === "certifications",
  );

  const ocrFields = useMemo(() => {
    const initial: ReviewedData = {};
    for (const doc of reviewableDocs) {
      initial[doc.id] = ocrFieldsFor(doc);
    }
    return initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Merged rather than initialValues-or-ocrFields: if the candidate went
  // back and replaced a document (new doc.id for the same doc_type — see
  // dedupeSingletonDocuments), a stale initialValues snapshot keyed by the
  // old id would leave the new document with no entry at all. Spreading
  // fresh ocrFields first, then any still-relevant prior edits on top,
  // keeps edits on untouched documents while giving replaced ones a clean
  // fresh read.
  const [fields, setFields] = useState<ReviewedData>(() => ({
    ...ocrFields,
    ...(initialValues ?? {}),
  }));
  const [entries, setEntries] = useState<ExperienceEntry[]>(
    () => initialExperienceEntries ?? experienceEntries,
  );
  const meaningfulEntries = entries.filter(isMeaningfulExperienceEntry);

  function updateField(docId: string, key: string, value: string) {
    setFields((prev) => ({
      ...prev,
      [docId]: { ...prev[docId], [key]: value },
    }));
  }

  function updateEntry(
    entryId: string,
    key: "company" | "role" | "from" | "to",
    value: string,
  ) {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, [key]: value } : entry)),
    );
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
          No documents to review.
        </div>
      )}

      {reviewableDocs.map((doc) => {
        const original = ocrFields[doc.id];
        const values = fields[doc.id] ?? original;
        const confidence = doc.ocr_result ? doc.ocr_confidence : null;
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
              <ReviewField
                key={key}
                label={label}
                value={values[key]}
                touched={values[key] !== original[key]}
                originalHasValue={original[key].trim() !== ""}
                confidence={confidence}
                onChange={(v) => updateField(doc.id, key, v)}
              />
            ))}
          </div>
        );
      })}

      {certificationDocs.length > 0 && (
        <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
          <div className="font-serif text-[16.5px] font-semibold mb-1">
            Certifications
          </div>
          <div className="text-xs text-text-muted mb-4">
            Names are extracted automatically — no other fields to review
            here.
          </div>
          <div className="flex flex-col gap-2.5">
            {certificationDocs.map((doc, index) => {
              const certifications =
                (doc.ocr_result?.parsed?.certifications as CertificationEntry[] | undefined) ??
                [];
              return (
                <div
                  key={doc.id}
                  className="py-[11px] border-b border-border last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold">
                      Certification {index + 1}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-[7px] py-[2px] rounded-full ${
                        doc.ocr_result
                          ? "text-forest bg-forest-soft"
                          : "text-text-muted bg-[#E4EDEE]"
                      }`}
                    >
                      {doc.ocr_result ? "Processed" : "Processing…"}
                    </span>
                  </div>
                  {certifications.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {certifications.map((cert, certIndex) => (
                        <li key={certIndex} className="text-[12.5px] text-text-muted">
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
        </div>
      )}

      {meaningfulEntries.length > 0 && (
        <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
          <div className="font-serif text-[16.5px] font-semibold mb-1">
            Professional Details
          </div>
          <div className="text-xs text-text-muted mb-4">
            Manually entered — double-check before continuing.
          </div>
          <div className="flex flex-col gap-4">
            {meaningfulEntries.map((entry, index) => (
              <div
                key={entry.id}
                className="border border-border rounded-[11px] px-4 py-4"
              >
                <div className="text-[12.5px] font-semibold mb-3">
                  Experience {index + 1}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11.5px] font-semibold mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      value={entry.company}
                      onChange={(e) => updateEntry(entry.id, "company", e.target.value)}
                      className="w-full px-[11px] py-2 border-[1.5px] border-border rounded-[8px] text-[13px] bg-white focus:outline-none focus:border-ink-light"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-semibold mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={entry.role}
                      onChange={(e) => updateEntry(entry.id, "role", e.target.value)}
                      className="w-full px-[11px] py-2 border-[1.5px] border-border rounded-[8px] text-[13px] bg-white focus:outline-none focus:border-ink-light"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-semibold mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={entry.from}
                      onChange={(e) => updateEntry(entry.id, "from", e.target.value)}
                      className="w-full px-[11px] py-2 border-[1.5px] border-border rounded-[8px] text-[13px] bg-white focus:outline-none focus:border-ink-light"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-semibold mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={entry.to}
                      onChange={(e) => updateEntry(entry.id, "to", e.target.value)}
                      className="w-full px-[11px] py-2 border-[1.5px] border-border rounded-[8px] text-[13px] bg-white focus:outline-none focus:border-ink-light"
                    />
                  </div>
                </div>
                {entry.fileName && (
                  <div className="text-[11px] text-text-muted mt-2.5">
                    Certificate attached: {entry.fileName}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between mt-7">
        <button
          type="button"
          onClick={onBack}
          className="px-[26px] py-3 rounded-[10px] border-[1.5px] border-border text-text-muted text-sm font-semibold hover:border-ink hover:text-ink cursor-pointer"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => onContinue(fields, meaningfulEntries)}
          className="px-[26px] py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark cursor-pointer"
        >
          Looks good, continue →
        </button>
      </div>
    </div>
  );
}
