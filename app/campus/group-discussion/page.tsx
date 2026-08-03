"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { BrandHeader } from "@/components/BrandHeader";
import { CampusGuard } from "@/components/campus/CampusGuard";
import { GdCallClient } from "@/components/campus/GdCallClient";
import { ApiError, getGdSessionState, joinGdSessionAcs } from "@/lib/candidateApi";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function timerLabel(endsAt: string | null | undefined) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function GdContent({ applicationId }: { applicationId: string }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [callState, setCallState] = useState("Idle");

  const joinQuery = useQuery({
    queryKey: ["gd-acs-join", sessionId, applicationId],
    queryFn: () => joinGdSessionAcs(sessionId!, applicationId),
    enabled: Boolean(sessionId) && joined,
    retry: false,
    staleTime: Infinity,
  });

  const stateQuery = useQuery({
    queryKey: ["gd-session-state", sessionId, applicationId],
    queryFn: () => getGdSessionState(sessionId!, applicationId),
    enabled: Boolean(sessionId),
    refetchInterval: 4000,
  });

  if (!sessionId) {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
        <BrandHeader />
        <p className="text-[13.5px] text-brick">Missing session. Return to the portal and try again.</p>
        <Link href="/campus/portal" className="inline-block mt-4 text-[13px] font-semibold text-ink underline">
          Back to portal
        </Link>
      </div>
    );
  }

  const state = stateQuery.data;
  const topic = state?.topic ?? joinQuery.data?.topic ?? null;
  const started = Boolean(state?.started_at);
  const completed = state?.status === "completed" || state?.status === "scored" || Boolean(state?.ended_at);

  return (
    <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
      <div className="flex items-start justify-between gap-4 mb-6">
        <BrandHeader />
        <Link
          href="/campus/portal"
          className="text-[12px] font-semibold text-text-muted hover:text-brick mt-1 shrink-0"
        >
          Portal
        </Link>
      </div>

      <h1 className="font-serif text-[24px] font-semibold mb-1.5">Group Discussion</h1>
      <p className="text-[13.5px] text-text-muted mb-6 leading-relaxed">
        {formatWhen(state?.scheduled_at) ? `Scheduled ${formatWhen(state?.scheduled_at)}` : "Online session"}
        {state?.duration_minutes ? ` · ${state.duration_minutes} min` : ""}
      </p>

      {completed ? (
        <div className="rounded-[11px] border border-border bg-forest-soft px-4 py-3 text-[13px] font-semibold text-forest">
          This group discussion has ended.
        </div>
      ) : (
        <>
          <div className="rounded-[14px] border border-border bg-surface px-[24px] py-[22px] mb-4">
            {started && topic ? (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                  Topic
                </div>
                <div className="font-serif text-[18px] font-semibold text-text leading-snug mb-3">
                  {topic}
                </div>
                <div className="text-[13px] text-text-muted">
                  Time remaining:{" "}
                  <span className="font-semibold text-text">{timerLabel(state?.ends_at) ?? "—"}</span>
                </div>
              </>
            ) : (
              <div className="text-[13.5px] text-text-muted leading-relaxed">
                Waiting for the host to start the discussion. The topic will appear here when it begins.
              </div>
            )}
          </div>

          {!joined ? (
            <button
              type="button"
              onClick={() => {
                setJoinError(null);
                setJoined(true);
              }}
              className="px-5 py-2.5 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink-dark cursor-pointer"
            >
              Join discussion
            </button>
          ) : joinQuery.isLoading ? (
            <div className="text-sm text-text-muted">Connecting…</div>
          ) : joinQuery.isError ? (
            <div className="rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
              {joinQuery.error instanceof ApiError
                ? joinQuery.error.message
                : joinError || "Could not join."}
              <button
                type="button"
                className="block mt-2 underline font-semibold"
                onClick={() => {
                  setJoined(false);
                  void joinQuery.refetch().then(() => setJoined(true));
                }}
              >
                Retry
              </button>
            </div>
          ) : joinQuery.data ? (
            <>
              <GdCallClient
                acsToken={joinQuery.data.acs_token}
                teamsJoinUrl={joinQuery.data.teams_join_url}
                displayName={joinQuery.data.display_name}
                onStateChange={setCallState}
              />
              <p className="mt-3 text-[12.5px] text-text-muted">Media: {callState}</p>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function CampusGroupDiscussionPage() {
  return (
    <CampusGuard>
      {(session) => (
        <Suspense fallback={<div className="p-8 text-sm text-text-muted">Loading…</div>}>
          <GdContent applicationId={session.applicationId} />
        </Suspense>
      )}
    </CampusGuard>
  );
}
