"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { CampusGuard } from "@/components/campus/CampusGuard";
import {
  ApiError,
  getCandidateStatus,
  startTestASession,
  submitTestASession,
} from "@/lib/candidateApi";
import {
  clearTestASessionCache,
  loadTestASessionCache,
  saveTestASessionCache,
  type TestASessionCache,
} from "@/lib/candidateSession";

type ViewState =
  | { kind: "loading" }
  | { kind: "blocked"; expiresAt: string }
  | { kind: "fatal"; message: string }
  | { kind: "active"; cache: TestASessionCache }
  | { kind: "submitted" };

function formatClock(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

function TestARunner({
  applicationId,
  cache,
  onSubmitted,
}: {
  applicationId: string;
  cache: TestASessionCache;
  onSubmitted: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number[]>>(cache.answers);
  // null until the first tick below runs — Date.now() is impure and can't be
  // called during render (including in a useState lazy initializer).
  const [msRemaining, setMsRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submittedRef = useRef(false);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Score isn't surfaced to the candidate — result.score is intentionally
      // unused here; grading is for admin/screening purposes only.
      await submitTestASession(applicationId, answers);
      clearTestASessionCache();
      onSubmitted();
    } catch (err) {
      submittedRef.current = false;
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 410) {
        // Time limit elapsed server-side too — the session can never be
        // submitted again, but start_test_a_session allows restarting once
        // expired, so send them back to get a fresh question set.
        clearTestASessionCache();
        setSubmitError(
          "Your time ran out before the submission reached the server. Refresh this page to start a fresh attempt with a new timer.",
        );
      } else {
        setSubmitError(
          err instanceof ApiError ? err.message : "Couldn't submit your test. Try again.",
        );
      }
    }
  }, [applicationId, answers, onSubmitted]);

  useEffect(() => {
    function tick() {
      const remaining = new Date(cache.expiresAt).getTime() - Date.now();
      setMsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        doSubmit();
      }
    }
    // Fires almost immediately (a real callback, not a synchronous call in
    // the effect body) so the clock shows a correct value right away, then
    // every second after.
    const immediate = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [cache.expiresAt, doSubmit]);

  function selectSingleAnswer(questionId: string, optionIndex: number) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: [optionIndex] };
      saveTestASessionCache({ ...cache, answers: next });
      return next;
    });
  }

  function toggleMultiAnswer(questionId: string, optionIndex: number) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const nextForQuestion = current.includes(optionIndex)
        ? current.filter((i) => i !== optionIndex)
        : [...current, optionIndex];
      const next = { ...prev, [questionId]: nextForQuestion };
      saveTestASessionCache({ ...cache, answers: next });
      return next;
    });
  }

  const answeredCount = Object.values(answers).filter((a) => a.length > 0).length;
  const totalCount = cache.questions.length;
  const isLow = msRemaining != null && msRemaining < 2 * 60 * 1000;

  return (
    <div className="max-w-[680px] mx-auto px-6 pt-10 pb-28">
      <BrandHeader />

      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur -mx-6 px-6 pb-4 mb-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-[19px] font-semibold">Written Test</div>
            <div className="text-[12px] text-text-muted">
              {answeredCount} of {totalCount} answered
            </div>
          </div>
          <div
            className={`text-lg font-serif font-bold tabular-nums ${isLow ? "text-brick" : "text-ink"}`}
          >
            {msRemaining == null ? "—:--" : formatClock(msRemaining)}
          </div>
        </div>
      </div>

      {submitError && (
        <div className="mb-5 rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {submitError}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {cache.questions.map((question, index) => (
          <div
            key={question.question_id}
            className="bg-surface border border-border rounded-[14px] px-[24px] py-[20px]"
          >
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="text-[13px] font-semibold text-text-muted">
                Question {index + 1} of {totalCount}
              </div>
              {question.answer_type === "multi" && (
                <span className="text-[10.5px] font-semibold uppercase tracking-wide bg-gold-soft text-gold rounded-full px-2 py-0.5 shrink-0">
                  Select all that apply
                </span>
              )}
            </div>
            <div className="text-[15px] font-medium mb-4 leading-relaxed">
              {question.question_text}
            </div>
            <div className="flex flex-col gap-2">
              {question.options.map((option, optionIndex) => {
                const selected = (answers[question.question_id] ?? []).includes(optionIndex);
                const isMulti = question.answer_type === "multi";
                return (
                  <label
                    key={optionIndex}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-[9px] border-[1.5px] cursor-pointer text-[13.5px] ${
                      selected
                        ? "border-ink-light bg-[#F0FAFB] font-medium"
                        : "border-border hover:border-ink-light/50"
                    }`}
                  >
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      name={isMulti ? undefined : question.question_id}
                      checked={selected}
                      onChange={() =>
                        isMulti
                          ? toggleMultiAnswer(question.question_id, optionIndex)
                          : selectSingleAnswer(question.question_id, optionIndex)
                      }
                      className="shrink-0"
                    />
                    <span className="text-text-muted font-semibold">
                      {OPTION_LETTERS[optionIndex] ?? optionIndex + 1}.
                    </span>
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-6 py-4">
        <div className="max-w-[680px] mx-auto flex items-center justify-between">
          <div className="text-[12.5px] text-text-muted">
            {answeredCount < totalCount
              ? `${totalCount - answeredCount} question(s) unanswered`
              : "All questions answered"}
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => (answeredCount < totalCount ? setConfirmOpen(true) : doSubmit())}
            className="px-6 py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Submitting…" : "Submit Test"}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-20">
          <div className="bg-surface rounded-[14px] px-6 py-5 max-w-[400px]">
            <div className="font-serif text-[16px] font-semibold mb-2">
              Submit with unanswered questions?
            </div>
            <p className="text-[13px] text-text-muted mb-5 leading-relaxed">
              You have {totalCount - answeredCount} unanswered question(s). Unanswered questions
              are marked incorrect. Submit anyway?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="text-[13px] font-semibold text-text-muted hover:text-text cursor-pointer"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  doSubmit();
                }}
                className="px-4 py-2 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink-dark cursor-pointer"
              >
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TestAPageContent({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    async function resolve() {
      try {
        const status = await getCandidateStatus(applicationId);
        if (!active) return;

        if (status.test_a.submitted) {
          setState({ kind: "submitted" });
          return;
        }

        const cached = loadTestASessionCache(applicationId);
        if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
          setState({ kind: "active", cache: cached });
          return;
        }
        clearTestASessionCache();

        if (status.test_a.in_progress && status.test_a.expires_at) {
          // Session in progress per the backend but no local cache for
          // it (different device/browser, or storage was cleared) —
          // calling start again would 409, so there's no way to recover
          // the exact question set until it expires.
          setState({ kind: "blocked", expiresAt: status.test_a.expires_at });
          return;
        }

        const started = await startTestASession(applicationId);
        if (!active) return;
        const cache: TestASessionCache = {
          applicationId,
          questions: started.questions,
          expiresAt: started.expires_at,
          answers: {},
        };
        saveTestASessionCache(cache);
        setState({ kind: "active", cache });
      } catch (err) {
        if (!active) return;
        setState({
          kind: "fatal",
          message:
            err instanceof ApiError
              ? err.message
              : "Couldn't load your test. Check your connection and try again.",
        });
      }
    }

    resolve();
    return () => {
      active = false;
    };
  }, [applicationId]);

  if (state.kind === "loading") {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-24 text-center text-sm text-text-muted">
        Preparing your test…
      </div>
    );
  }

  if (state.kind === "blocked") {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
        <BrandHeader />
        <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] text-center">
          <div className="font-serif text-[18px] font-semibold mb-2">
            A test session is already in progress
          </div>
          <p className="text-[13.5px] text-text-muted leading-relaxed mb-4">
            It looks like you already started this test on another device or browser. It will
            expire at {new Date(state.expiresAt).toLocaleTimeString()}. Please continue there, or
            wait until it expires and refresh this page to start over.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-[13px] font-semibold text-ink-light hover:text-ink cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "fatal") {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
        <BrandHeader />
        <div className="rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {state.message}
        </div>
      </div>
    );
  }

  if (state.kind === "submitted") {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20 text-center">
        <BrandHeader />
        <div className="w-16 h-16 rounded-full bg-forest-soft text-forest flex items-center justify-center text-3xl mx-auto mb-6">
          ✓
        </div>
        <h2 className="font-serif text-xl font-semibold mb-2">Written test submitted</h2>
        <p className="text-[13.5px] text-text-muted max-w-[380px] mx-auto mb-6">
          Your responses have been recorded. Results will be communicated as part of the
          admissions process.
        </p>
        <button
          type="button"
          onClick={() => router.push("/campus/portal")}
          className="px-6 py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark cursor-pointer"
        >
          Back to portal
        </button>
      </div>
    );
  }

  return (
    <TestARunner
      applicationId={applicationId}
      cache={state.cache}
      onSubmitted={() => setState({ kind: "submitted" })}
    />
  );
}

export default function CampusTestAPage() {
  return (
    <CampusGuard>
      {(session) => <TestAPageContent applicationId={session.applicationId} />}
    </CampusGuard>
  );
}
