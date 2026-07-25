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
import { ocrFieldsFor, type ReviewedData } from "@/lib/reviewFields";
import { ApiError, updateApplicant, updateApplicationProfile } from "@/lib/api";
import { isMeaningfulExperienceEntry, type ExperienceEntry } from "@/lib/experience";
import type { ApplicationProfileResponse, CertificationEntry, UploadedDocument } from "@/lib/types";

export interface ConfirmStepProps {
  profile: ApplicationProfileResponse;
  reviewed: ReviewedData;
  experienceEntries: ExperienceEntry[];
  onReviewedChange: (reviewed: ReviewedData) => void;
  onExperienceChange: (entries: ExperienceEntry[]) => void;
  onSubmitted: (profile: ApplicationProfileResponse) => void;
  onBack: () => void;
}

const NUMERIC_FIELD_KEYS = new Set(["percentage", "cgpa", "year"]);
/** Only these two numeric fields drive the "you edited an auto-filled value"
 * consent gate — a corrected year or institution spelling isn't the kind of
 * discrepancy that should block submission on its own. */
const MISMATCH_CHECK_KEYS = new Set(["percentage", "cgpa"]);
const MARKSHEET_DOC_TYPES = new Set(["10th_marksheet", "12th_marksheet", "ug_marksheet", "pg_marksheet"]);

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

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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
  documents: UploadedDocument[],
  reviewed: ReviewedData,
  experienceEntries: ExperienceEntry[],
): Record<string, number> {
  const flat: Record<string, number> = {};

  function percentageFor(docType: string): number | null {
    const doc = documents.find((d) => d.doc_type === docType);
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

  const certificationDocs = documents.filter((d) => d.doc_type === "certifications");
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
  documents: UploadedDocument[],
  reviewed: ReviewedData,
  experienceEntries: ExperienceEntry[],
  basicFields: { dob: string; gender: string },
): Record<string, unknown> {
  const documentsPayload: Record<string, unknown> = {};
  for (const doc of documents) {
    const fields = reviewed[doc.id];
    if (!fields) continue;
    const schema = REVIEW_FIELD_SCHEMAS[doc.doc_type] ?? [];
    const docPayload: Record<string, unknown> = { doc_type: doc.doc_type };
    for (const { key } of schema) {
      docPayload[key] = toFieldValue(key, fields[key] ?? "");
    }
    documentsPayload[doc.id] = docPayload;
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
    dob: basicFields.dob || null,
    gender: basicFields.gender || null,
    documents: documentsPayload,
    experience,
    ...computeFlatMatchFields(documents, reviewed, experienceEntries),
  };
}

interface EditedFieldMismatch {
  sectionTitle: string;
  label: string;
  original: string;
  edited: string;
}

interface NameMismatch {
  enteredName: string;
  extractedName: string;
}

interface MismatchSummary {
  nameMismatch: NameMismatch | null;
  editedFields: EditedFieldMismatch[];
}

function SectionHeader({
  title,
  editable,
  editing,
  onToggle,
}: {
  title: string;
  editable: boolean;
  editing: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="font-serif text-[16.5px] font-semibold">{title}</div>
      {editable && (
        <button
          type="button"
          onClick={onToggle}
          className={`text-[12px] font-semibold rounded-full px-3 py-1.5 cursor-pointer ${
            editing
              ? "bg-forest-soft text-forest hover:opacity-80"
              : "bg-[#E4EDEE] text-ink-light hover:bg-ink-light/15"
          }`}
        >
          {editing ? "✓ Save" : "✎ Edit"}
        </button>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  editing,
  onChange,
  type = "text",
  options,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  type?: "text" | "date" | "select";
  options?: { value: string; label: string }[];
}) {
  return (
    <div className="flex justify-between items-center py-[11px] border-b border-border last:border-b-0 text-[13.5px] gap-4">
      <span className="text-xs text-text-muted shrink-0">{label}</span>
      {editing ? (
        type === "select" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-[13px] font-semibold text-right bg-white border-[1.5px] border-border rounded-[7px] px-2 py-1 focus:outline-none focus:border-ink-light"
          >
            <option value="">Select</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-[13px] font-semibold text-right bg-white border-[1.5px] border-border rounded-[7px] px-2 py-1 w-[160px] focus:outline-none focus:border-ink-light"
          />
        )
      ) : (
        <span className="font-semibold text-right">{value || "—"}</span>
      )}
    </div>
  );
}

export function ConfirmStep({
  profile,
  reviewed,
  experienceEntries,
  onReviewedChange,
  onExperienceChange,
  onSubmitted,
  onBack,
}: ConfirmStepProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [stage, setStage] = useState<"editing" | "consent">("editing");
  const [mismatches, setMismatches] = useState<MismatchSummary | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const profileData = profile.profile_data?.data ?? {};

  const [applicantEdits, setApplicantEdits] = useState({
    full_name: profile.applicant.full_name ?? "",
    phone: profile.applicant.phone ?? "",
    email: profile.applicant.email ?? "",
  });
  const [basicEdits, setBasicEdits] = useState({
    dob: typeof profileData.dob === "string" ? profileData.dob : "",
    gender: typeof profileData.gender === "string" ? profileData.gender : "",
  });

  const documents = useMemo(() => dedupeSingletonDocuments(profile.documents), [profile]);

  const reviewableDocs = useMemo(
    () =>
      documents
        .filter((doc) => REVIEW_FIELD_SCHEMAS[doc.doc_type] !== undefined)
        .sort(
          (a, b) =>
            REVIEW_SECTION_ORDER.indexOf(a.doc_type) - REVIEW_SECTION_ORDER.indexOf(b.doc_type),
        ),
    [documents],
  );
  const certificationDocs = documents.filter((doc) => doc.doc_type === "certifications");
  const meaningfulExperience = experienceEntries.filter(isMeaningfulExperienceEntry);

  function updateReviewedField(docId: string, key: string, value: string) {
    onReviewedChange({ ...reviewed, [docId]: { ...reviewed[docId], [key]: value } });
  }

  function updateExperienceField(
    entryId: string,
    key: "company" | "role" | "from" | "to",
    value: string,
  ) {
    onExperienceChange(
      experienceEntries.map((entry) => (entry.id === entryId ? { ...entry, [key]: value } : entry)),
    );
  }

  function toggleSection(sectionId: string) {
    setEditingSection((current) => (current === sectionId ? null : sectionId));
  }

  function computeMismatches(): MismatchSummary {
    const editedFields: EditedFieldMismatch[] = [];
    let nameMismatch: NameMismatch | null = null;

    const enteredName = applicantEdits.full_name.trim();

    for (const doc of reviewableDocs) {
      const original = ocrFieldsFor(doc);
      const edited = reviewed[doc.id] ?? original;
      const schema = REVIEW_FIELD_SCHEMAS[doc.doc_type] ?? [];
      const sectionTitle = REVIEW_SECTION_TITLES[doc.doc_type] ?? doc.doc_type;

      for (const { key, label } of schema) {
        if (!MISMATCH_CHECK_KEYS.has(key)) continue;
        const originalValue = (original[key] ?? "").trim();
        const editedValue = (edited[key] ?? "").trim();
        if (originalValue && editedValue && originalValue !== editedValue) {
          editedFields.push({ sectionTitle, label, original: originalValue, edited: editedValue });
        }
      }

      if (nameMismatch === null && MARKSHEET_DOC_TYPES.has(doc.doc_type) && enteredName) {
        const extractedName = (edited.name_on_certificate ?? "").trim();
        if (extractedName && normalizeName(extractedName) !== normalizeName(enteredName)) {
          nameMismatch = { enteredName, extractedName };
        }
      }
    }

    return { nameMismatch, editedFields };
  }

  async function performSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const applicantChanged =
        applicantEdits.full_name !== (profile.applicant.full_name ?? "") ||
        applicantEdits.phone !== (profile.applicant.phone ?? "") ||
        applicantEdits.email !== (profile.applicant.email ?? "");
      if (applicantChanged) {
        await updateApplicant(profile.application.id, {
          full_name: applicantEdits.full_name || null,
          phone: applicantEdits.phone || null,
          email: applicantEdits.email || null,
        });
      }

      await updateApplicationProfile(
        profile.application.id,
        buildProfilePayload(profile, documents, reviewed, experienceEntries, basicEdits),
      );

      onSubmitted({
        ...profile,
        applicant: { ...profile.applicant, ...applicantEdits },
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Couldn't submit your application: ${err.message}`
          : "Couldn't submit your application. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  function handleConfirmClick() {
    const summary = computeMismatches();
    if (summary.nameMismatch || summary.editedFields.length > 0) {
      setMismatches(summary);
      setConsentChecked(false);
      setStage("consent");
      return;
    }
    performSubmit();
  }

  if (stage === "consent" && mismatches) {
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

        <h1 className="font-serif text-[27px] font-semibold mb-1.5">Please verify before submitting</h1>
        <div className="text-[13.5px] text-text-muted mb-8">
          A few details you entered don&apos;t match what we read from your documents. Double-check
          these before continuing.
        </div>

        {error && (
          <div className="mb-5 rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
            {error}
          </div>
        )}

        {mismatches.nameMismatch && (
          <div className="bg-surface border-[1.5px] border-brick/40 rounded-[14px] px-[28px] py-[26px] mb-5">
            <div className="font-serif text-[15px] font-semibold mb-3 text-brick">Name mismatch</div>
            <div className="flex justify-between py-[11px] border-b border-border text-[13.5px]">
              <span className="text-xs text-text-muted">Name you entered</span>
              <span className="font-semibold">{mismatches.nameMismatch.enteredName}</span>
            </div>
            <div className="flex justify-between py-[11px] text-[13.5px]">
              <span className="text-xs text-text-muted">Name on your documents</span>
              <span className="font-semibold">{mismatches.nameMismatch.extractedName}</span>
            </div>
          </div>
        )}

        {mismatches.editedFields.length > 0 && (
          <div className="bg-surface border-[1.5px] border-gold/40 rounded-[14px] px-[28px] py-[26px] mb-5">
            <div className="font-serif text-[15px] font-semibold mb-3 text-gold">
              Edited auto-filled values
            </div>
            {mismatches.editedFields.map((item, index) => (
              <div
                key={index}
                className="py-[11px] border-b border-border last:border-b-0 text-[13.5px]"
              >
                <div className="text-xs text-text-muted mb-1.5">
                  {item.sectionTitle} — {item.label}
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">
                    Auto-filled from document: <strong className="text-text">{item.original}</strong>
                  </span>
                  <span className="text-text-muted">
                    Your entry: <strong className="text-text">{item.edited}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-[3px]"
            />
            <span className="text-xs text-text-muted leading-relaxed">
              I confirm that all the information above is true to the best of my knowledge, and I
              will clarify any of it if asked. I understand that submitting false or mismatched
              information may lead to my application being rejected.
            </span>
          </label>
        </div>

        <div className="flex justify-between mt-7">
          <button
            type="button"
            onClick={() => setStage("editing")}
            disabled={submitting}
            className="px-[26px] py-3 rounded-[10px] border-[1.5px] border-border text-text-muted text-sm font-semibold hover:border-ink hover:text-ink disabled:opacity-60 cursor-pointer"
          >
            ← Go back and edit
          </button>
          <button
            type="button"
            onClick={performSubmit}
            disabled={!consentChecked || submitting}
            className="px-[26px] py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Submitting…" : "Submit Application →"}
          </button>
        </div>
      </div>
    );
  }

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

      <h1 className="font-serif text-[27px] font-semibold mb-1.5">Confirm & submit</h1>
      <div className="text-[13.5px] text-text-muted mb-8">
        Take one last look — once submitted, you&apos;ll move on to the next stage of the
        admissions process. Use the edit icon on any section to fix a mistake.
      </div>

      {error && (
        <div className="mb-5 rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {error}
        </div>
      )}

      <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
        <SectionHeader
          title="Applicant"
          editable
          editing={editingSection === "applicant"}
          onToggle={() => toggleSection("applicant")}
        />
        <InfoRow
          label="Full Name"
          value={applicantEdits.full_name}
          editing={editingSection === "applicant"}
          onChange={(v) => setApplicantEdits((prev) => ({ ...prev, full_name: v }))}
        />
        <InfoRow
          label="Mobile"
          value={applicantEdits.phone}
          editing={editingSection === "applicant"}
          onChange={(v) => setApplicantEdits((prev) => ({ ...prev, phone: v }))}
        />
        <InfoRow
          label="Email"
          value={applicantEdits.email}
          editing={editingSection === "applicant"}
          onChange={(v) => setApplicantEdits((prev) => ({ ...prev, email: v }))}
        />
        <InfoRow
          label="Date of Birth"
          value={basicEdits.dob}
          type="date"
          editing={editingSection === "applicant"}
          onChange={(v) => setBasicEdits((prev) => ({ ...prev, dob: v }))}
        />
        <InfoRow
          label="Gender"
          value={editingSection === "applicant" ? basicEdits.gender : GENDER_LABELS[basicEdits.gender] ?? basicEdits.gender}
          type="select"
          options={Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }))}
          editing={editingSection === "applicant"}
          onChange={(v) => setBasicEdits((prev) => ({ ...prev, gender: v }))}
        />
      </div>

      {reviewableDocs.map((doc) => {
        const fields = reviewed[doc.id] ?? ocrFieldsFor(doc);
        const schema = REVIEW_FIELD_SCHEMAS[doc.doc_type] ?? [];
        const editing = editingSection === doc.id;
        return (
          <div
            key={doc.id}
            className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5"
          >
            <SectionHeader
              title={REVIEW_SECTION_TITLES[doc.doc_type] ?? doc.doc_type}
              editable
              editing={editing}
              onToggle={() => toggleSection(doc.id)}
            />
            {schema.map(({ key, label }) => (
              <InfoRow
                key={key}
                label={label}
                value={fields[key] ?? ""}
                editing={editing}
                onChange={(v) => updateReviewedField(doc.id, key, v)}
              />
            ))}
          </div>
        );
      })}

      {certificationDocs.length > 0 && (
        <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
          <div className="font-serif text-[16.5px] font-semibold mb-4">Certifications</div>
          {certificationDocs.map((doc, index) => {
            const certifications =
              (doc.ocr_result?.parsed?.certifications as CertificationEntry[] | undefined) ?? [];
            return (
              <div key={doc.id} className="py-[11px] border-b border-border last:border-b-0 text-[13.5px]">
                <div className="flex justify-between">
                  <span className="text-xs text-text-muted">Certification {index + 1}</span>
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
          <SectionHeader
            title="Professional Details"
            editable
            editing={editingSection === "experience"}
            onToggle={() => toggleSection("experience")}
          />
          {meaningfulExperience.map((entry) => {
            const editing = editingSection === "experience";
            return (
              <div key={entry.id} className="py-[11px] border-b border-border last:border-b-0 text-[13.5px]">
                {editing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-semibold mb-1">Company</label>
                      <input
                        type="text"
                        value={entry.company}
                        onChange={(e) => updateExperienceField(entry.id, "company", e.target.value)}
                        className="w-full px-[11px] py-2 border-[1.5px] border-border rounded-[8px] text-[13px] bg-white focus:outline-none focus:border-ink-light"
                      />
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-semibold mb-1">Role</label>
                      <input
                        type="text"
                        value={entry.role}
                        onChange={(e) => updateExperienceField(entry.id, "role", e.target.value)}
                        className="w-full px-[11px] py-2 border-[1.5px] border-border rounded-[8px] text-[13px] bg-white focus:outline-none focus:border-ink-light"
                      />
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-semibold mb-1">From</label>
                      <input
                        type="date"
                        value={entry.from}
                        onChange={(e) => updateExperienceField(entry.id, "from", e.target.value)}
                        className="w-full px-[11px] py-2 border-[1.5px] border-border rounded-[8px] text-[13px] bg-white focus:outline-none focus:border-ink-light"
                      />
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-semibold mb-1">To</label>
                      <input
                        type="date"
                        value={entry.to}
                        onChange={(e) => updateExperienceField(entry.id, "to", e.target.value)}
                        className="w-full px-[11px] py-2 border-[1.5px] border-border rounded-[8px] text-[13px] bg-white focus:outline-none focus:border-ink-light"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-semibold mb-1">
                      {entry.role || "—"} · {entry.company || "—"}
                    </div>
                    <div className="text-xs text-text-muted">
                      {entry.from || "—"} to {entry.to || "—"}
                      {entry.fileName ? ` · ${entry.fileName}` : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
          onClick={handleConfirmClick}
          disabled={submitting}
          className="px-[26px] py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark disabled:opacity-60 cursor-pointer"
        >
          {submitting ? "Submitting…" : "Confirm & Submit"}
        </button>
      </div>
    </div>
  );
}
