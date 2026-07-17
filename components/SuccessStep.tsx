"use client";

import { useState } from "react";
import { BrandHeader } from "./BrandHeader";
import { Stepper } from "./Stepper";
import type { ApplicationProfileResponse } from "@/lib/types";

export interface SuccessStepProps {
  profile: ApplicationProfileResponse;
}

export function SuccessStep({ profile }: SuccessStepProps) {
  const [copied, setCopied] = useState(false);

  const applicationNumber = profile.application.application_number;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(applicationNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access can fail silently (e.g. insecure context); the number is still visible to copy manually
    }
  }

  return (
    <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
      <BrandHeader />
      <Stepper
        steps={[
          { label: "Basic Info", status: "done" },
          { label: "Review", status: "done" },
          { label: "Submit", status: "done" },
        ]}
      />
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-forest-soft text-forest flex items-center justify-center text-3xl mx-auto mb-6">
          ✓
        </div>
        <h2 className="font-serif text-xl font-semibold mb-2">
          Application submitted
        </h2>
        <p className="text-[13.5px] text-text-muted max-w-[380px] mx-auto mb-6">
          Thank you — we&apos;ve received your application. We&apos;ll be in
          touch by email with the next steps.
        </p>
        <div className="inline-flex flex-col items-center gap-2 bg-surface border border-border rounded-[11px] px-6 py-4">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
            Application Number
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-serif font-semibold text-ink">
              {applicationNumber}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] font-semibold text-ink-light hover:text-ink cursor-pointer"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <span className="text-[11px] text-text-muted">
            Save this for reference in any future correspondence.
          </span>
        </div>
      </div>
    </div>
  );
}
