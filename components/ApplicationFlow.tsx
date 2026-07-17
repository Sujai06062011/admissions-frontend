"use client";

import { useState } from "react";
import { BrandHeader } from "./BrandHeader";
import { BasicInfoStep } from "./BasicInfoStep";
import { ProcessingStep } from "./ProcessingStep";
import { ReviewStep, type ReviewedData } from "./ReviewStep";
import { ConfirmStep } from "./ConfirmStep";
import { SuccessStep } from "./SuccessStep";
import type { ApplicationProfileResponse } from "@/lib/types";

type FlowStep = "form" | "processing" | "review" | "confirm" | "success";

export function ApplicationFlow() {
  const [step, setStep] = useState<FlowStep>("form");
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ApplicationProfileResponse | null>(null);
  const [reviewed, setReviewed] = useState<ReviewedData | null>(null);

  if (step === "form") {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
        <BrandHeader />
        <BasicInfoStep
          onComplete={(id) => {
            setApplicationId(id);
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
        onContinue={(fields) => {
          setReviewed(fields);
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
        onBack={() => setStep("review")}
        onSubmitted={() => setStep("success")}
      />
    );
  }

  if (step === "success") {
    return <SuccessStep />;
  }

  return null;
}
