"use client";

import { useState } from "react";
import { BrandHeader } from "./BrandHeader";
import { BasicInfoStep } from "./BasicInfoStep";
import { ProcessingStep } from "./ProcessingStep";
import { ReviewStep, type ReviewedData } from "./ReviewStep";
import { ConfirmStep } from "./ConfirmStep";
import { SuccessStep } from "./SuccessStep";
import type { ExperienceEntry } from "@/lib/experience";
import type { ApplicationProfileResponse } from "@/lib/types";

type FlowStep = "form" | "processing" | "review" | "confirm" | "success";

export function ApplicationFlow() {
  const [step, setStep] = useState<FlowStep>("form");
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ApplicationProfileResponse | null>(null);
  const [reviewed, setReviewed] = useState<ReviewedData | null>(null);
  const [experienceEntries, setExperienceEntries] = useState<ExperienceEntry[]>([]);

  return (
    <>
      {/* Kept mounted (just hidden) rather than conditionally rendered, so
          going back from Review doesn't lose already-entered basic info or
          already-uploaded document statuses — BasicInfoStep has no effects
          of its own, so sitting hidden costs nothing. */}
      <div className={step === "form" ? "max-w-[640px] mx-auto px-6 pt-14 pb-20" : "hidden"}>
        <BrandHeader />
        <BasicInfoStep
          active={step === "form"}
          onComplete={(id, entries) => {
            setApplicationId(id);
            setExperienceEntries(entries);
            setStep("processing");
          }}
        />
      </div>

      {step === "processing" && applicationId && (
        <ProcessingStep
          applicationId={applicationId}
          onComplete={(result) => {
            setProfile(result);
            setStep("review");
          }}
        />
      )}

      {step === "review" && profile && (
        <ReviewStep
          profile={profile}
          experienceEntries={experienceEntries}
          initialValues={reviewed ?? undefined}
          initialExperienceEntries={reviewed ? experienceEntries : undefined}
          onContinue={(fields, entries) => {
            setReviewed(fields);
            setExperienceEntries(entries);
            setStep("confirm");
          }}
          onBack={() => setStep("form")}
        />
      )}

      {step === "confirm" && profile && reviewed && (
        <ConfirmStep
          profile={profile}
          reviewed={reviewed}
          experienceEntries={experienceEntries}
          onReviewedChange={setReviewed}
          onExperienceChange={setExperienceEntries}
          onBack={() => setStep("review")}
          onSubmitted={(updatedProfile) => {
            setProfile(updatedProfile);
            setStep("success");
          }}
        />
      )}

      {step === "success" && profile && <SuccessStep profile={profile} />}
    </>
  );
}
