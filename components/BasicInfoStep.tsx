"use client";

import { useState } from "react";
import { Stepper } from "./Stepper";
import { DocumentUploadCard, type DocSlotStatus } from "./DocumentUploadCard";
import {
  CERTIFICATIONS_DOC_TYPE,
  FIXED_DOCUMENT_SLOTS,
} from "@/lib/documentTypes";
import { ApiError, createApplication, uploadDocument } from "@/lib/api";
import type { DocType } from "@/lib/types";

interface FixedSlotState {
  status: DocSlotStatus;
  fileName?: string;
  documentId?: string;
  errorMessage?: string;
}

interface CertSlot {
  id: string;
  status: DocSlotStatus;
  fileName?: string;
  documentId?: string;
  errorMessage?: string;
}

type FixedSlots = Record<string, FixedSlotState>;

function initialFixedSlots(): FixedSlots {
  const slots: FixedSlots = {};
  for (const config of FIXED_DOCUMENT_SLOTS) {
    slots[config.docType] = { status: "idle" };
  }
  return slots;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, "").length >= 10;
}

export interface BasicInfoStepProps {
  onComplete: (applicationId: string) => void;
}

export function BasicInfoStep({ onComplete }: BasicInfoStepProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [creatingApplication, setCreatingApplication] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [fixedSlots, setFixedSlots] = useState<FixedSlots>(initialFixedSlots());
  const [certSlots, setCertSlots] = useState<CertSlot[]>([
    { id: crypto.randomUUID(), status: "idle" },
  ]);

  const [consentAccurate, setConsentAccurate] = useState(false);
  const [consentProcessing, setConsentProcessing] = useState(false);
  const [attemptedContinue, setAttemptedContinue] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isLocked = applicationId !== null;

  function validateBasicInfo(): boolean {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = "Full name is required";
    if (!phone.trim() || !isValidPhone(phone)) {
      errors.phone = "Enter a valid mobile number";
    }
    if (!email.trim() || !isValidEmail(email)) {
      errors.email = "Enter a valid email address";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function ensureApplication(): Promise<string | null> {
    if (applicationId) return applicationId;
    if (!validateBasicInfo()) return null;

    setCreatingApplication(true);
    setFormError(null);
    try {
      const result = await createApplication({ fullName, phone, email });
      setApplicationId(result.application.id);
      return result.application.id;
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? `Couldn't start your application: ${error.message}`
          : "Couldn't start your application. Check your connection and try again.",
      );
      return null;
    } finally {
      setCreatingApplication(false);
    }
  }

  async function handleFixedUpload(docType: DocType, file: File) {
    const appId = await ensureApplication();
    if (!appId) return;

    setFixedSlots((prev) => ({
      ...prev,
      [docType]: { status: "uploading", fileName: file.name },
    }));

    try {
      const document = await uploadDocument(appId, docType, file);
      setFixedSlots((prev) => ({
        ...prev,
        [docType]: {
          status: "uploaded",
          fileName: file.name,
          documentId: document.id,
        },
      }));
    } catch (error) {
      setFixedSlots((prev) => ({
        ...prev,
        [docType]: {
          status: "error",
          fileName: file.name,
          errorMessage:
            error instanceof ApiError ? error.message : "Upload failed. Try again.",
        },
      }));
    }
  }

  async function handleCertUpload(slotId: string, file: File) {
    const appId = await ensureApplication();
    if (!appId) return;

    setCertSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? { ...slot, status: "uploading", fileName: file.name }
          : slot,
      ),
    );

    try {
      const document = await uploadDocument(
        appId,
        CERTIFICATIONS_DOC_TYPE,
        file,
      );
      setCertSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                status: "uploaded",
                fileName: file.name,
                documentId: document.id,
              }
            : slot,
        ),
      );
    } catch (error) {
      setCertSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                status: "error",
                fileName: file.name,
                errorMessage:
                  error instanceof ApiError
                    ? error.message
                    : "Upload failed. Try again.",
              }
            : slot,
        ),
      );
    }
  }

  function addCertSlot() {
    setCertSlots((prev) => [...prev, { id: crypto.randomUUID(), status: "idle" }]);
  }

  function removeCertSlot(slotId: string) {
    setCertSlots((prev) => {
      const next = prev.filter((slot) => slot.id !== slotId);
      return next.length > 0 ? next : [{ id: crypto.randomUUID(), status: "idle" }];
    });
  }

  const requiredSlotsUploaded = FIXED_DOCUMENT_SLOTS.filter((c) => c.required).every(
    (c) => fixedSlots[c.docType]?.status === "uploaded",
  );
  const noUploadsInFlight =
    Object.values(fixedSlots).every((s) => s.status !== "uploading") &&
    certSlots.every((s) => s.status !== "uploading");
  const canContinue =
    requiredSlotsUploaded &&
    consentAccurate &&
    consentProcessing &&
    noUploadsInFlight &&
    !submitting;

  async function handleContinue() {
    setAttemptedContinue(true);
    if (!canContinue) return;
    const appId = await ensureApplication();
    if (!appId) return;
    setSubmitting(true);
    onComplete(appId);
  }

  const missingRequired = FIXED_DOCUMENT_SLOTS.filter(
    (c) => c.required && fixedSlots[c.docType]?.status !== "uploaded",
  );

  return (
    <div>
      <Stepper
        steps={[
          { label: "Basic Info", status: "active" },
          { label: "Review", status: "upcoming" },
          { label: "Submit", status: "upcoming" },
        ]}
      />

      <h1 className="font-serif text-[27px] font-semibold mb-1.5">
        Start your application
      </h1>
      <div className="text-[13.5px] text-text-muted mb-8">
        Just a few details, then upload your documents — we&apos;ll fill in the
        rest.
      </div>

      {formError && (
        <div className="mb-5 rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {formError}
        </div>
      )}

      <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
        <div className="font-serif text-[16.5px] font-semibold mb-1">
          Basic Information
        </div>
        <div className="text-xs text-text-muted mb-5">
          We&apos;ll use these to send your application updates and login
          details.
        </div>

        <div className="mb-4">
          <label className="block text-[12.5px] font-semibold mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            disabled={isLocked}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="As per your official documents"
            className="w-full px-[13px] py-[11px] border-[1.5px] border-border rounded-[9px] text-sm bg-white focus:outline-none focus:border-ink-light disabled:bg-[#F5FAFA] disabled:text-text-muted"
          />
          {fieldErrors.fullName && (
            <div className="text-brick text-[11.5px] font-medium mt-1.5">
              {fieldErrors.fullName}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-[12.5px] font-semibold mb-1.5">
            Mobile Number
          </label>
          <input
            type="tel"
            value={phone}
            disabled={isLocked}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full px-[13px] py-[11px] border-[1.5px] border-border rounded-[9px] text-sm bg-white focus:outline-none focus:border-ink-light disabled:bg-[#F5FAFA] disabled:text-text-muted"
          />
          {fieldErrors.phone && (
            <div className="text-brick text-[11.5px] font-medium mt-1.5">
              {fieldErrors.phone}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[12.5px] font-semibold mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            disabled={isLocked}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-[13px] py-[11px] border-[1.5px] border-border rounded-[9px] text-sm bg-white focus:outline-none focus:border-ink-light disabled:bg-[#F5FAFA] disabled:text-text-muted"
          />
          {fieldErrors.email && (
            <div className="text-brick text-[11.5px] font-medium mt-1.5">
              {fieldErrors.email}
            </div>
          )}
        </div>

        {isLocked && (
          <div className="text-[11px] text-text-muted mt-3">
            Locked after your first document upload.
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
        <div className="font-serif text-[16.5px] font-semibold mb-1">
          Upload Your Documents
        </div>
        <div className="text-xs text-text-muted mb-5">
          We&apos;ll read these automatically and pre-fill your academic
          details — you&apos;ll get a chance to review everything before
          submitting.
        </div>

        <div className="flex flex-col gap-3">
          {FIXED_DOCUMENT_SLOTS.map((config) => {
            const slot = fixedSlots[config.docType];
            return (
              <DocumentUploadCard
                key={config.docType}
                label={config.label}
                helperText={config.required ? "Required" : "Optional"}
                status={slot.status}
                fileName={slot.fileName}
                errorMessage={slot.errorMessage}
                onSelectFile={(file) => handleFixedUpload(config.docType, file)}
              />
            );
          })}

          {certSlots.map((slot, index) => (
            <DocumentUploadCard
              key={slot.id}
              label={
                certSlots.length > 1 ? `Certification ${index + 1}` : "Certifications"
              }
              helperText="Optional · add as many as you like"
              status={slot.status}
              fileName={slot.fileName}
              errorMessage={slot.errorMessage}
              onSelectFile={(file) => handleCertUpload(slot.id, file)}
              onRemove={
                slot.status === "uploaded"
                  ? () => removeCertSlot(slot.id)
                  : undefined
              }
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addCertSlot}
          className="text-[12.5px] font-semibold text-ink-light mt-3 inline-block cursor-pointer"
        >
          + Add another certification
        </button>
      </div>

      <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] mb-5">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={consentAccurate}
            onChange={(e) => setConsentAccurate(e.target.checked)}
            className="mt-[3px]"
          />
          <span className="text-xs text-text-muted leading-relaxed">
            I confirm the information provided is accurate to the best of my
            knowledge.
          </span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer mt-2.5">
          <input
            type="checkbox"
            checked={consentProcessing}
            onChange={(e) => setConsentProcessing(e.target.checked)}
            className="mt-[3px]"
          />
          <span className="text-xs text-text-muted leading-relaxed">
            I consent to my documents being processed by AI for verification,
            and to my campus test and interview being recorded and evaluated
            as part of this admissions process.
          </span>
        </label>
      </div>

      {attemptedContinue && !canContinue && (
        <div className="text-[12.5px] text-brick font-medium mb-3 text-right">
          {missingRequired.length > 0
            ? `Please upload: ${missingRequired.map((c) => c.label).join(", ")}`
            : !noUploadsInFlight
              ? "Please wait for uploads to finish"
              : "Please accept both consent checkboxes"}
        </div>
      )}

      <div className="flex justify-end mt-7">
        <button
          type="button"
          onClick={handleContinue}
          disabled={creatingApplication || submitting}
          className="px-[26px] py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {creatingApplication ? "Starting…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
