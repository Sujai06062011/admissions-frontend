"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import type { CallCompositePage } from "@azure/communication-react";
import { BrandHeader } from "@/components/BrandHeader";
import { CampusGuard } from "@/components/campus/CampusGuard";
import { GdCallClient } from "@/components/campus/GdCallClient";
import { ApiError, getGdSessionState, joinGdSessionAcs } from "@/lib/candidateApi";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function timerLabel(endsAt: string | null | undefined, nowMs: number) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - nowMs;
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isConnectedToMeeting(page: CallCompositePage | null): boolean {
  return page === "call" || page === "lobby";
}

function GdContent({ applicationId }: { applicationId: string }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [callPage, setCallPage] = useState<CallCompositePage | null>(null);

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
    refetchInterval: 3000,
  });

  const state = stateQuery.data;
  const topic = state?.topic ?? null;
  const hostStarted = Boolean(state?.started_at) && state?.status === "live";
  const completed =
    state?.status === "completed" || state?.status === "scored" || Boolean(state?.ended_at);

  // Topic + timer only after moderator Host Start, and only while candidate is in the meeting.
  const showTopicTimer =
    hostStarted && Boolean(topic) && isConnectedToMeeting(callPage);
  const endsAt = showTopicTimer ? (state?.ends_at ?? null) : null;

  useEffect(() => {
    if (!endsAt) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

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

  return (
    <div className="max-w-[920px] mx-auto px-6 pt-14 pb-20">
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
            {showTopicTimer ? (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                  Topic
                </div>
                <div className="font-serif text-[18px] font-semibold text-text leading-snug mb-3">
                  {topic}
                </div>
                <div className="text-[13px] text-text-muted">
                  Time remaining:{" "}
                  <span className="font-semibold text-text">
                    {timerLabel(endsAt, nowMs) ?? "—"}
                  </span>
                </div>
              </>
            ) : callPage === "leftCall" || callPage === "leaving" ? (
              <div className="text-[13.5px] text-text-muted leading-relaxed">
                You left the call. Re-join below if that was a mistake.
              </div>
            ) : isConnectedToMeeting(callPage) && !hostStarted ? (
              <div className="text-[13.5px] text-text-muted leading-relaxed">
                You&apos;re in the room. Waiting for the <span className="font-semibold text-text">moderator</span>{" "}
                to start the discussion — the topic and timer will appear then.
              </div>
            ) : (
              <div className="text-[13.5px] text-text-muted leading-relaxed">
                Join below to enter the discussion room. The topic stays hidden until the moderator
                starts the session.
              </div>
            )}
          </div>

          {!joined ? (
            <>
              <div className="rounded-[14px] border border-border bg-surface px-[24px] py-[22px] mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3">
                  Important etiquette
                </div>
                <ul className="space-y-2.5 text-[13.5px] text-text leading-relaxed list-disc pl-5">
                  <li>
                    Join from a quiet, well-lit place with a stable internet connection.
                  </li>
                  <li>
                    Keep your <span className="font-semibold">camera on</span> and face visible
                    throughout the discussion.
                  </li>
                  <li>
                    Mute your microphone when you are not speaking to reduce background noise.
                  </li>
                  <li>
                    Speak clearly, one at a time — do not interrupt or talk over others.
                  </li>
                  <li>
                    Be respectful and professional; listen actively and build on others&apos;
                    points.
                  </li>
                  <li>
                    Stay on topic once the moderator reveals it; avoid side conversations or chat
                    distractions.
                  </li>
                  <li>
                    Do not record, screenshot, or share the discussion outside this session.
                  </li>
                  <li>
                    Use <span className="font-semibold">Raise hand</span> if you wish to speak and
                    wait to be acknowledged.
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setJoinError(null);
                  setCallPage(null);
                  try {
                    await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                  } catch {
                    // Still allow join; in-call controls can request again.
                  }
                  setJoined(true);
                }}
                className="px-5 py-2.5 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink-dark cursor-pointer"
              >
                Join discussion
              </button>
            </>
          ) : joinQuery.isLoading ? (
            <div className="text-sm text-text-muted">Joining…</div>
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
            <GdCallClient
              acsUserId={joinQuery.data.acs_user_id}
              acsToken={joinQuery.data.acs_token}
              teamsJoinUrl={joinQuery.data.teams_join_url}
              displayName={joinQuery.data.display_name}
              onPageChange={setCallPage}
            />
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
