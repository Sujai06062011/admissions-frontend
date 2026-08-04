"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listGdSessions, type GdSessionAdmin } from "@/lib/adminApi";
import { PROGRAM_ID } from "@/lib/adminConfig";
import type { CandidateWithMatch } from "@/lib/adminPipeline";
import { ChevronDownIcon } from "@/components/admin/icons";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusTone(status: string) {
  if (status === "live") return "bg-gold-soft text-[#8a5a12]";
  if (status === "completed" || status === "scored") return "bg-forest-soft text-forest";
  return "bg-[#E4EDEE] text-text-muted";
}

type Props = {
  candidates: CandidateWithMatch[];
  onOpenCandidate: (applicationId: string) => void;
  onMoveToFinal: (candidate: CandidateWithMatch) => void;
};

type GroupBucket = {
  session: GdSessionAdmin;
  members: CandidateWithMatch[];
};

function CandidateRow({
  candidate,
  onOpenCandidate,
  onMoveToFinal,
}: {
  candidate: CandidateWithMatch;
  onOpenCandidate: (applicationId: string) => void;
  onMoveToFinal: (candidate: CandidateWithMatch) => void;
}) {
  return (
    <li className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onOpenCandidate(candidate.application_id)}
        className="text-left min-w-0"
      >
        <div className="text-[13.5px] font-semibold text-text">
          {candidate.applicant_name || "Unnamed applicant"}
        </div>
        <div className="text-[12px] text-text-muted">
          {candidate.application_number || candidate.application_id.slice(0, 8)}
        </div>
      </button>
      <button
        type="button"
        onClick={() => onMoveToFinal(candidate)}
        className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
      >
        Move to Final Interview
      </button>
    </li>
  );
}

function TrackSection({
  title,
  sessions,
  onOpenCandidate,
  onMoveToFinal,
}: {
  title: string;
  sessions: GroupBucket[];
  onOpenCandidate: (applicationId: string) => void;
  onMoveToFinal: (candidate: CandidateWithMatch) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sectionOpen, setSectionOpen] = useState(true);

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = sessions.reduce((n, g) => n + g.members.length, 0);

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <span className="flex items-center gap-2 font-serif font-bold text-text text-[15px]">
          {title}
          <span className="text-text-muted text-[12.5px] font-sans font-normal">
            {total} candidate{total === 1 ? "" : "s"} · {sessions.length} group
            {sessions.length === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 text-text-muted transition ${sectionOpen ? "" : "-rotate-90"}`}
        />
      </button>

      {sectionOpen && (
        <div className="border-t border-border">
          {sessions.length === 0 && (
            <div className="px-5 py-6 text-[13px] text-text-muted">
              No {title.toLowerCase()} groups yet.
            </div>
          )}

          {sessions.map(({ session, members }) => {
            const open = expanded.has(session.id);
            return (
              <div key={session.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(session.id)}
                  className="w-full flex items-start justify-between gap-3 px-5 py-3.5 text-left hover:bg-[#F8FAFA]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-text">
                        {session.label || "Untitled group"}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusTone(session.status)}`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <div className="text-[12px] text-text-muted mt-0.5">
                      {formatWhen(session.scheduled_at)}
                      {session.professor_name ? ` · ${session.professor_name}` : ""}
                      {session.topic ? ` · ${session.topic}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] text-text-muted font-medium">
                      {members.length}
                    </span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-text-muted transition ${open ? "" : "-rotate-90"}`}
                    />
                  </div>
                </button>

                {open && (
                  <ul className="bg-bg border-t border-border divide-y divide-border">
                    {members.map((c) => (
                      <CandidateRow
                        key={c.application_id}
                        candidate={c}
                        onOpenCandidate={onOpenCandidate}
                        onMoveToFinal={onMoveToFinal}
                      />
                    ))}
                    {members.length === 0 && (
                      <li className="px-5 py-3 text-[13px] text-text-muted">
                        No matched candidates in this group for the current list.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GroupDiscussionStagePanel({
  candidates,
  onOpenCandidate,
  onMoveToFinal,
}: Props) {
  const sessionsQuery = useQuery({
    queryKey: ["gd-sessions", PROGRAM_ID],
    queryFn: () => listGdSessions(PROGRAM_ID),
    refetchInterval: 5000,
  });
  const [unassignedOpen, setUnassignedOpen] = useState(true);

  const { onlineGroups, inPersonGroups, unassigned } = useMemo(() => {
    const sessions = sessionsQuery.data ?? [];
    const active = sessions.filter((s) =>
      ["draft", "meeting_ready", "invited", "live"].includes(s.status),
    );
    const byApp = new Map<string, GdSessionAdmin>();
    for (const s of active) {
      for (const p of s.participants ?? []) {
        byApp.set(p.application_id, s);
      }
    }

    const onlineBuckets = new Map<string, GroupBucket>();
    const inPersonBuckets = new Map<string, GroupBucket>();
    const unassignedList: CandidateWithMatch[] = [];

    for (const c of candidates) {
      const session = byApp.get(c.application_id);
      if (!session) {
        unassignedList.push(c);
        continue;
      }
      const map = session.track === "manual" ? inPersonBuckets : onlineBuckets;
      const existing = map.get(session.id);
      if (existing) existing.members.push(c);
      else map.set(session.id, { session, members: [c] });
    }

    for (const s of active) {
      const map = s.track === "manual" ? inPersonBuckets : onlineBuckets;
      if (!map.has(s.id)) map.set(s.id, { session: s, members: [] });
    }

    const sortBuckets = (rows: GroupBucket[]) =>
      rows.sort((a, b) => {
        const at = a.session.scheduled_at ? new Date(a.session.scheduled_at).getTime() : 0;
        const bt = b.session.scheduled_at ? new Date(b.session.scheduled_at).getTime() : 0;
        return bt - at;
      });

    return {
      onlineGroups: sortBuckets([...onlineBuckets.values()]),
      inPersonGroups: sortBuckets([...inPersonBuckets.values()]),
      unassigned: unassignedList,
    };
  }, [candidates, sessionsQuery.data]);

  if (sessionsQuery.isLoading) {
    return <div className="text-sm text-text-muted">Loading group assignments…</div>;
  }

  if (sessionsQuery.isError) {
    return (
      <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3">
        Couldn&apos;t load Group Discussion sessions.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TrackSection
        title="Online"
        sessions={onlineGroups}
        onOpenCandidate={onOpenCandidate}
        onMoveToFinal={onMoveToFinal}
      />
      <TrackSection
        title="In-person"
        sessions={inPersonGroups}
        onOpenCandidate={onOpenCandidate}
        onMoveToFinal={onMoveToFinal}
      />

      {unassigned.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setUnassignedOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <span className="flex items-center gap-2 font-serif font-bold text-text text-[15px]">
              Unassigned
              <span className="text-text-muted text-[12.5px] font-sans font-normal">
                {unassigned.length} candidate{unassigned.length === 1 ? "" : "s"} · not in an active
                group
              </span>
            </span>
            <ChevronDownIcon
              className={`w-4 h-4 text-text-muted transition ${unassignedOpen ? "" : "-rotate-90"}`}
            />
          </button>
          {unassignedOpen && (
            <ul className="border-t border-border divide-y divide-border bg-bg">
              {unassigned.map((c) => (
                <CandidateRow
                  key={c.application_id}
                  candidate={c}
                  onOpenCandidate={onOpenCandidate}
                  onMoveToFinal={onMoveToFinal}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
