"use client";

import { useEffect, useRef, useState } from "react";
import { BrandHeader } from "./BrandHeader";
import { ApiError, getApplication } from "@/lib/api";
import { dedupeSingletonDocuments, DOC_TYPE_LABELS } from "@/lib/documentTypes";
import type { ApplicationProfileResponse } from "@/lib/types";

const POLL_INTERVAL_MS = 3000;
/** Show "Continue anyway" once waiting gets slow — don't make applicants guess. */
const SLOW_AFTER_MS = 20000;
/**
 * Hard client-side escape hatch for demo/reliability: if any OCR job is still
 * null after this (backend hung, Railway killed a background task mid-run,
 * Claude timeout race, etc.), advance automatically so the spinner never
 * traps the applicant. Remaining fields show as "Enter manually" on Review.
 */
const AUTO_CONTINUE_MS = 75000;

export interface ProcessingStepProps {
  applicationId: string;
  onComplete: (profile: ApplicationProfileResponse) => void;
}

export function ProcessingStep({ applicationId, onComplete }: ProcessingStepProps) {
  const [profile, setProfile] = useState<ApplicationProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    startedAtRef.current = Date.now();

    async function poll() {
      if (stoppedRef.current) return;
      const elapsed = Date.now() - (startedAtRef.current ?? Date.now());

      try {
        const result = await getApplication(applicationId);
        setProfile(result);
        setError(null);

        // Experience certificates have no review fields — don't block on their OCR.
        const docsAwaitingOcr = result.documents.filter(
          (doc) => doc.doc_type !== "experience_certificate",
        );
        const allDone = docsAwaitingOcr.every((doc) => doc.ocr_result !== null);
        if (allDone) {
          stoppedRef.current = true;
          onComplete(result);
          return;
        }

        // Hard timeout — move on even if one document is still null so a
        // single hung OCR job can't block the whole application flow.
        if (elapsed > AUTO_CONTINUE_MS) {
          stoppedRef.current = true;
          onComplete(result);
          return;
        }
      } catch (err) {
        setError(
          err instanceof ApiError
            ? `Couldn't check processing status: ${err.message}`
            : "Couldn't reach the server. Retrying…",
        );
      }

      if (elapsed > SLOW_AFTER_MS) {
        setIsSlow(true);
      }

      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      stoppedRef.current = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  function handleContinueAnyway() {
    if (profile) {
      stoppedRef.current = true;
      onComplete(profile);
    }
  }

  const documents = dedupeSingletonDocuments(profile?.documents ?? []);

  return (
    <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
      <BrandHeader />
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full border-4 border-border border-t-gold mx-auto mb-6 animate-spin" />
        <h2 className="font-serif text-xl font-semibold mb-2">
          Reading your documents…
        </h2>
        <p className="text-[13.5px] text-text-muted max-w-[380px] mx-auto">
          This usually takes under a minute. We&apos;re extracting your
          academic details so you don&apos;t have to type them in.
        </p>

        {error && (
          <div className="mt-6 mx-auto max-w-[380px] rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
            {error}
          </div>
        )}

        {documents.length > 0 && (
          <div className="mt-8 flex flex-col gap-2.5 max-w-[320px] mx-auto text-left">
            {documents.map((doc) => {
              const done = doc.ocr_result !== null;
              const failed = Boolean(doc.ocr_result?.error);
              return (
                <div key={doc.id} className="flex items-center gap-2.5 text-[13px]">
                  <div
                    className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] ${
                      failed ? "bg-brick" : done ? "bg-forest" : "bg-border"
                    }`}
                  >
                    {failed ? "!" : done ? "✓" : ""}
                  </div>
                  <span className={done && !failed ? "" : "text-text-muted"}>
                    {DOC_TYPE_LABELS[doc.doc_type]}
                    {failed
                      ? " — couldn't read (enter manually)"
                      : done
                        ? " — extracted"
                        : " — processing…"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {isSlow && profile && (
          <div className="mt-8">
            <p className="text-[12.5px] text-text-muted mb-3">
              This is taking longer than usual. You can keep waiting, or
              continue and verify the remaining fields manually.
            </p>
            <button
              type="button"
              onClick={handleContinueAnyway}
              className="px-5 py-2.5 rounded-[10px] border-[1.5px] border-ink text-ink text-sm font-semibold hover:bg-ink hover:text-white cursor-pointer"
            >
              Continue anyway →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
