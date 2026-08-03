"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  endGdSession,
  getGdSession,
  listGdSessions,
  startGdSession,
  type GdSessionAdmin,
} from "@/lib/adminApi";
import { PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusTone(status: string) {
  if (status === "live") return "bg-gold-soft text-[#8a5a12]";
  if (status === "completed" || status === "scored") return "bg-forest-soft text-forest";
  if (status === "invited" || status === "meeting_ready") return "bg-[#E4EDEE] text-text-muted";
  return "bg-[#E4EDEE] text-text-muted";
}

export default function GroupDiscussionHostPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["gd-sessions", PROGRAM_ID],
    queryFn: () => listGdSessions(PROGRAM_ID),
    refetchInterval: 5000,
  });

  const sessions = useMemo(() => {
    const rows = [...(listQuery.data ?? [])];
    rows.sort((a, b) => {
      const at = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const bt = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return bt - at;
    });
    return rows;
  }, [listQuery.data]);

  const activeId = selectedId ?? sessions[0]?.id ?? null;

  const detailQuery = useQuery({
    queryKey: ["gd-session", activeId],
    queryFn: () => getGdSession(activeId!),
    enabled: Boolean(activeId),
    refetchInterval: 3000,
  });

  const session: GdSessionAdmin | undefined = detailQuery.data;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["gd-sessions", PROGRAM_ID] });
    if (activeId) {
      void queryClient.invalidateQueries({ queryKey: ["gd-session", activeId] });
    }
  }

  const startMutation = useMutation({
    mutationFn: () => startGdSession(activeId!),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const endMutation = useMutation({
    mutationFn: () => endGdSession(activeId!),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const canStart =
    Boolean(session) &&
    Boolean(session?.topic) &&
    ["invited", "meeting_ready", "live"].includes(session?.status ?? "") &&
    session?.status !== "live";

  const canEnd =
    Boolean(session) && ["live", "invited", "meeting_ready"].includes(session?.status ?? "");

  return (
    <div>
      <AdminTopbar
        title="Group Discussion"
        subtitle={`${PROGRAM_LABEL} · Moderator host controls`}
      />

      {error && (
        <div className="mb-4 rounded-[11px] border border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="rounded-[14px] border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-[12px] font-semibold text-text-muted uppercase tracking-wide">
            Sessions
          </div>
          {listQuery.isLoading && (
            <div className="px-4 py-6 text-[13px] text-text-muted">Loading…</div>
          )}
          {listQuery.isError && (
            <div className="px-4 py-6 text-[13px] text-brick">Could not load sessions.</div>
          )}
          <ul className="max-h-[70vh] overflow-y-auto">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border cursor-pointer ${
                    activeId === s.id ? "bg-[#F3F6F6]" : "hover:bg-[#F8FAFA]"
                  }`}
                >
                  <div className="font-semibold text-[13.5px] text-text truncate">
                    {s.label || "Untitled GD"}
                  </div>
                  <div className="text-[12px] text-text-muted mt-0.5">
                    {formatWhen(s.scheduled_at)}
                  </div>
                  <span
                    className={`inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusTone(s.status)}`}
                  >
                    {s.status}
                  </span>
                </button>
              </li>
            ))}
            {!listQuery.isLoading && sessions.length === 0 && (
              <li className="px-4 py-6 text-[13px] text-text-muted">No GD sessions yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-[14px] border border-border bg-surface px-6 py-5">
          {!session ? (
            <div className="text-[13.5px] text-text-muted">Select a session to host.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-serif text-[22px] font-semibold text-text">
                    {session.label || "Group Discussion"}
                  </h2>
                  <p className="text-[13px] text-text-muted mt-1">
                    {formatWhen(session.scheduled_at)} · {session.duration_minutes} min ·{" "}
                    {session.participants?.length ?? 0} candidates
                  </p>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusTone(session.status)}`}
                >
                  {session.status}
                </span>
              </div>

              <div className="rounded-[11px] border border-border bg-bg px-4 py-3 mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                  Topic (shown to candidates after Start)
                </div>
                <div className="font-serif text-[16px] font-semibold text-text">
                  {session.topic || (
                    <span className="text-brick font-medium text-[13.5px]">
                      No topic set — set topic via API/admin before starting.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-5">
                <button
                  type="button"
                  disabled={!canStart || startMutation.isPending}
                  onClick={() => startMutation.mutate()}
                  className="px-5 py-2.5 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink-dark disabled:opacity-40 cursor-pointer"
                >
                  {session.status === "live"
                    ? "Discussion started"
                    : startMutation.isPending
                      ? "Starting…"
                      : "Start discussion"}
                </button>
                <button
                  type="button"
                  disabled={!canEnd || endMutation.isPending}
                  onClick={() => endMutation.mutate()}
                  className="px-5 py-2.5 rounded-[9px] border border-border bg-surface text-[13px] font-semibold text-brick hover:bg-brick-soft disabled:opacity-40 cursor-pointer"
                >
                  {endMutation.isPending ? "Ending…" : "End discussion"}
                </button>
                {session.join_url && (
                  <a
                    href={session.join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-[9px] border border-border bg-surface text-[13px] font-semibold text-text hover:bg-[#F3F6F6]"
                  >
                    Open in Teams
                  </a>
                )}
                <Link
                  href={`/campus/group-discussion?session=${session.id}`}
                  className="px-5 py-2.5 rounded-[9px] border border-border bg-surface text-[13px] font-semibold text-text hover:bg-[#F3F6F6]"
                >
                  Candidate page link
                </Link>
              </div>

              {session.status === "live" && (
                <div className="mb-5 rounded-[11px] border border-forest bg-forest-soft px-4 py-3 text-[13px] text-forest font-medium">
                  Live — candidates now see the topic and timer on their GD page.
                </div>
              )}

              <div className="text-[12px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                Participants
              </div>
              <ul className="divide-y divide-border rounded-[11px] border border-border overflow-hidden">
                {(session.participants ?? []).map((p) => (
                  <li key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 bg-surface">
                    <div>
                      <div className="text-[13.5px] font-semibold text-text">
                        {p.applicant_name || "Candidate"}
                      </div>
                      <div className="text-[12px] text-text-muted">
                        {p.application_number || p.application_id}
                        {p.applicant_email ? ` · ${p.applicant_email}` : ""}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-text-muted">
                      {p.invite_status || "—"}
                    </span>
                  </li>
                ))}
                {(session.participants ?? []).length === 0 && (
                  <li className="px-4 py-4 text-[13px] text-text-muted">No participants assigned.</li>
                )}
              </ul>

              <p className="mt-4 text-[12.5px] text-text-muted leading-relaxed">
                Flow: candidates join from the campus portal into the room first. When everyone is
                ready, click <span className="font-semibold text-text">Start discussion</span> — that
                reveals the topic and starts the timer on their screens. Use{" "}
                <span className="font-semibold text-text">Open in Teams</span> to join as the
                organizer/moderator.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
