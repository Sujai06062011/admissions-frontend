"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BrandHeader } from "@/components/BrandHeader";
import { CampusGuard } from "@/components/campus/CampusGuard";
import { useCampusSession } from "@/components/campus/CampusSessionProvider";
import { ApiError, getCandidateStatus } from "@/lib/candidateApi";
import type { CandidateStatus } from "@/lib/candidateTypes";

function StatusPill({ tone, children }: { tone: "muted" | "active" | "done"; children: React.ReactNode }) {
  const classes =
    tone === "done"
      ? "bg-forest-soft text-forest"
      : tone === "active"
        ? "bg-gold-soft text-[#8a5a12]"
        : "bg-[#E4EDEE] text-text-muted";
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${classes}`}>
      {children}
    </span>
  );
}

function PortalContent({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const { clearSession } = useCampusSession();

  const { data, isLoading, isError, error, refetch } = useQuery<CandidateStatus>({
    queryKey: ["candidate-status", applicationId],
    queryFn: () => getCandidateStatus(applicationId),
    refetchOnWindowFocus: true,
  });

  function handleLogout() {
    clearSession();
    router.push("/campus");
  }

  return (
    <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
      <div className="flex items-start justify-between gap-4">
        <BrandHeader />
        <button
          type="button"
          onClick={handleLogout}
          className="text-[12px] font-semibold text-text-muted hover:text-brick cursor-pointer mt-1 shrink-0"
        >
          Sign out
        </button>
      </div>

      {data && (data.applicant_name || data.application_number) && (
        <div className="mb-6 -mt-4 rounded-[11px] border border-border bg-surface px-4 py-3">
          {data.applicant_name && (
            <div className="font-serif text-[16px] font-semibold text-text leading-snug">
              {data.applicant_name}
            </div>
          )}
          {data.application_number && (
            <div className="text-[12.5px] text-text-muted mt-0.5">
              Application No.{" "}
              <span className="font-semibold text-text tracking-wide">
                {data.application_number}
              </span>
            </div>
          )}
        </div>
      )}

      <h1 className="font-serif text-[24px] font-semibold mb-1.5">Your campus assessments</h1>
      <p className="text-[13.5px] text-text-muted mb-8 leading-relaxed">
        Complete both steps below. You can do them in either order, but most candidates take the
        written test first.
      </p>

      {isLoading && <div className="text-sm text-text-muted">Loading your status…</div>}

      {isError && (
        <div className="rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {error instanceof ApiError ? error.message : "Couldn't load your status."}{" "}
          <button type="button" onClick={() => refetch()} className="underline font-semibold">
            Retry
          </button>
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-4">
          {/* Test A */}
          <div className="bg-surface border border-border rounded-[14px] px-[24px] py-[22px]">
            <div className="flex items-center justify-between mb-2">
              <div className="font-serif text-[16.5px] font-semibold">Campus Test</div>
              {data.test_a.submitted ? (
                <StatusPill tone="done">Submitted</StatusPill>
              ) : data.test_a.in_progress ? (
                <StatusPill tone="active">In progress</StatusPill>
              ) : (
                <StatusPill tone="muted">Not started</StatusPill>
              )}
            </div>
            <p className="text-[13px] text-text-muted mb-4 leading-relaxed">
              A timed, multiple-choice assessment. Once you start, the clock keeps running even if
              you close the page — so make sure you&apos;re ready before you begin.
            </p>
            {data.test_a.submitted ? (
              <div className="text-[13px] font-semibold text-forest">
                Your responses have been recorded.
              </div>
            ) : (
              <Link
                href="/campus/test-a"
                className="inline-block px-5 py-2.5 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink-dark"
              >
                {data.test_a.in_progress ? "Resume Test →" : "Start Test →"}
              </Link>
            )}
          </div>

          {/* Test B */}
          <div className="bg-surface border border-border rounded-[14px] px-[24px] py-[22px]">
            <div className="flex items-center justify-between mb-2">
              <div className="font-serif text-[16.5px] font-semibold">Video Interview</div>
              {data.test_b.submitted ? (
                <StatusPill tone="done">Submitted</StatusPill>
              ) : (
                <StatusPill tone="muted">Not started</StatusPill>
              )}
            </div>
            <p className="text-[13px] text-text-muted mb-4 leading-relaxed">
              You&apos;ll be shown a short prompt and asked to record a video response using your
              camera and microphone.
            </p>
            {!data.campus_session_assigned ? (
              <div className="text-[13px] text-text-muted italic">
                Your interview slot hasn&apos;t been assigned yet — check back after your campus
                schedule is confirmed.
              </div>
            ) : data.test_b.submitted ? (
              <div className="text-[13px] font-semibold text-forest">
                Your recording has been submitted.
              </div>
            ) : (
              <Link
                href="/campus/test-b"
                className="inline-block px-5 py-2.5 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink-dark"
              >
                Record Response →
              </Link>
            )}
          </div>

          {/* Group Discussion — shown only when assigned */}
          {data.group_discussion?.assigned && (
            <div className="bg-surface border border-border rounded-[14px] px-[24px] py-[22px]">
              <div className="flex items-center justify-between mb-2">
                <div className="font-serif text-[16.5px] font-semibold">Group Discussion</div>
                {data.group_discussion.completed ? (
                  <StatusPill tone="done">Completed</StatusPill>
                ) : data.group_discussion.status === "live" ? (
                  <StatusPill tone="active">In progress</StatusPill>
                ) : data.group_discussion.join_enabled ? (
                  <StatusPill tone="active">Join open</StatusPill>
                ) : (
                  <StatusPill tone="muted">Scheduled</StatusPill>
                )}
              </div>
              <p className="text-[13px] text-text-muted mb-3 leading-relaxed">
                {data.group_discussion.track === "manual"
                  ? "You have been scheduled for an in-person group discussion on campus."
                  : "Join online from this portal. The discussion topic is shown only after the host starts the session."}
              </p>
              {data.group_discussion.scheduled_at && (
                <p className="text-[13px] text-text mb-4">
                  <span className="text-text-muted">Scheduled: </span>
                  {new Date(data.group_discussion.scheduled_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {data.group_discussion.duration_minutes
                    ? ` · ${data.group_discussion.duration_minutes} min`
                    : ""}
                </p>
              )}
              {data.group_discussion.completed ? (
                <div className="text-[13px] font-semibold text-forest">
                  Your group discussion has ended.
                </div>
              ) : data.group_discussion.track === "manual" ? (
                <div className="text-[13px] text-text-muted italic">
                  Please attend in person at the scheduled time. Details will be shared by the college.
                </div>
              ) : data.group_discussion.join_enabled && data.group_discussion.session_id ? (
                <Link
                  href={`/campus/group-discussion?session=${data.group_discussion.session_id}`}
                  className="inline-block px-5 py-2.5 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink-dark"
                >
                  Join discussion →
                </Link>
              ) : (
                <div className="text-[13px] text-text-muted italic">
                  Join opens{" "}
                  {data.group_discussion.join_opens_minutes_before ?? 10} minutes before the
                  scheduled time
                  {data.group_discussion.join_opens_at
                    ? ` (${new Date(data.group_discussion.join_opens_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })})`
                    : ""}
                  .
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CampusPortalPage() {
  return (
    <CampusGuard>{(session) => <PortalContent applicationId={session.applicationId} />}</CampusGuard>
  );
}
