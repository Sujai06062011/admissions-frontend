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

  if (step === "form") {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
        <BrandHeader />
        <BasicInfoStep
          onComplete={(id, entries) => {
            setApplicationId(id);
            setExperienceEntries(entries);
            setStep("processing");
          }}
        />
      </div>
    );
  }

  if (step === "processing" && applicationId) {
    return (
      <ProcessingStep
        applicationId={applicationId}
        onComplete={(result) => {
          setProfile(result);
          setStep("review");
        }}
      />
    );
  }

  if (step === "review" && profile) {
    return (
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
      />
    );
  }

  if (step === "confirm" && profile && reviewed) {
    return (
      <ConfirmStep
        profile={profile}
        reviewed={reviewed}
        experienceEntries={experienceEntries}
        onBack={() => setStep("review")}
        onSubmitted={() => setStep("success")}
      />
    );
  }

  if (step === "success" && profile) {
    return <SuccessStep profile={profile} />;
  }

  return null;
}
