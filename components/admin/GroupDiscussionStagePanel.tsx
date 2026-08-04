"use client";

import { useMemo, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listGdSessions,
  moveGdParticipants,
  type GdSessionAdmin,
} from "@/lib/adminApi";
import { PROGRAM_ID } from "@/lib/adminConfig";
import type { CandidateWithMatch } from "@/lib/adminPipeline";
import { ChevronDownIcon } from "@/components/admin/icons";

const REASSIGNABLE = new Set(["draft", "meeting_ready"]);
const DND_MIME = "application/x-admit-gd-move";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusTone(status: string) {
  if (status === "live") return "bg-gold-soft text-[#8a5a12]";
  if (status === "completed" || status === "scored") return "bg-forest-soft text-forest";
  return "bg-[#E4EDEE] text-text-muted";
}

function canReassign(status: string) {
  return REASSIGNABLE.has(status);
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

type DragPayload = {
  applicationIds: string[];
  fromSessionId: string | null;
};

function parseDrag(e: DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function CandidateRow({
  candidate,
  sessionId,
  locked,
  selected,
  onToggleSelect,
  onOpenCandidate,
  onMoveToFinal,
  onDragIds,
}: {
  candidate: CandidateWithMatch;
  sessionId: string | null;
  locked: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenCandidate: (applicationId: string) => void;
  onMoveToFinal: (candidate: CandidateWithMatch) => void;
  onDragIds: (applicationId: string) => string[];
}) {
  return (
    <li
      draggable={!locked}
      onDragStart={(e) => {
        if (locked) {
          e.preventDefault();
          return;
        }
        const ids = onDragIds(candidate.application_id);
        const payload: DragPayload = {
          applicationIds: ids,
          fromSessionId: sessionId,
        };
        e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
        e.dataTransfer.setData("text/plain", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 ${
        locked ? "opacity-70" : "cursor-grab active:cursor-grabbing"
      } ${selected ? "bg-[#EEF3F8]" : ""}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {!locked && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(candidate.application_id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 accent-ink"
            aria-label={`Select ${candidate.applicant_name || "candidate"}`}
          />
        )}
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
      </div>
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

function GroupBlock({
  bucket,
  selectedIds,
  onToggleSelect,
  onOpenCandidate,
  onMoveToFinal,
  onDragIds,
  onDropMove,
  busy,
}: {
  bucket: GroupBucket;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenCandidate: (applicationId: string) => void;
  onMoveToFinal: (candidate: CandidateWithMatch) => void;
  onDragIds: (applicationId: string) => string[];
  onDropMove: (payload: DragPayload, toSessionId: string | null) => void;
  busy: boolean;
}) {
  const { session, members } = bucket;
  const [open, setOpen] = useState(true);
  const [over, setOver] = useState(false);
  const locked = !canReassign(session.status) || busy;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
            {!canReassign(session.status) && (
              <span className="text-[11px] text-text-muted">Drag locked</span>
            )}
          </div>
          <div className="text-[12px] text-text-muted mt-0.5">
            {formatWhen(session.scheduled_at)}
            {session.professor_name ? ` · ${session.professor_name}` : ""}
            {session.topic ? ` · ${session.topic}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] text-text-muted font-medium">{members.length}</span>
          <ChevronDownIcon
            className={`w-4 h-4 text-text-muted transition ${open ? "" : "-rotate-90"}`}
          />
        </div>
      </button>

      {open && (
        <div
          onDragOver={(e) => {
            if (locked) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            if (locked) return;
            e.preventDefault();
            setOver(false);
            const payload = parseDrag(e);
            if (!payload) return;
            if (payload.fromSessionId === session.id) return;
            onDropMove(payload, session.id);
          }}
          className={`bg-bg border-t border-border ${over ? "ring-2 ring-inset ring-ink/20" : ""}`}
        >
          <ul className="divide-y divide-border">
            {members.map((c) => (
              <CandidateRow
                key={c.application_id}
                candidate={c}
                sessionId={session.id}
                locked={locked}
                selected={selectedIds.has(c.application_id)}
                onToggleSelect={onToggleSelect}
                onOpenCandidate={onOpenCandidate}
                onMoveToFinal={onMoveToFinal}
                onDragIds={onDragIds}
              />
            ))}
            {members.length === 0 && (
              <li className="px-5 py-6 text-[13px] text-text-muted text-center">
                {locked ? "No candidates in this group." : "Drop candidates here"}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrackSection({
  title,
  sessions,
  selectedIds,
  onToggleSelect,
  onOpenCandidate,
  onMoveToFinal,
  onDragIds,
  onDropMove,
  busy,
}: {
  title: string;
  sessions: GroupBucket[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenCandidate: (applicationId: string) => void;
  onMoveToFinal: (candidate: CandidateWithMatch) => void;
  onDragIds: (applicationId: string) => string[];
  onDropMove: (payload: DragPayload, toSessionId: string | null) => void;
  busy: boolean;
}) {
  const [sectionOpen, setSectionOpen] = useState(true);
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
          {sessions.map((bucket) => (
            <GroupBlock
              key={bucket.session.id}
              bucket={bucket}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onOpenCandidate={onOpenCandidate}
              onMoveToFinal={onMoveToFinal}
              onDragIds={onDragIds}
              onDropMove={onDropMove}
              busy={busy}
            />
          ))}
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
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ["gd-sessions", PROGRAM_ID],
    queryFn: () => listGdSessions(PROGRAM_ID),
    refetchInterval: 5000,
  });
  const [unassignedOpen, setUnassignedOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [dropHintOver, setDropHintOver] = useState(false);

  const moveMutation = useMutation({
    mutationFn: moveGdParticipants,
    onSuccess: () => {
      setError(null);
      setSelectedIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ["gd-sessions", PROGRAM_ID] });
      void queryClient.invalidateQueries({ queryKey: ["candidates", PROGRAM_ID] });
    },
    onError: (err: Error) => setError(err.message),
  });

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function dragIdsFor(applicationId: string): string[] {
    if (selectedIds.has(applicationId) && selectedIds.size > 0) {
      return Array.from(selectedIds);
    }
    return [applicationId];
  }

  function handleMove(payload: DragPayload, toSessionId: string | null) {
    if (payload.fromSessionId === toSessionId) return;
    moveMutation.mutate({
      application_ids: payload.applicationIds,
      to_session_id: toSessionId,
    });
  }

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

  const busy = moveMutation.isPending;

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-text-muted">
        Drag candidates into any Online or In-person group to move them (no swap). Select multiple
        with checkboxes, then drag. Drop onto Unassigned to remove from a group. Online groups with
        a Teams meeting go back to draft after a roster change so the meeting can be recreated.
        Locked after invites are sent.
      </p>

      {error && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-semibold shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {busy && (
        <div className="text-[13px] text-text-muted font-medium">Updating group membership…</div>
      )}

      <TrackSection
        title="Online"
        sessions={onlineGroups}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onOpenCandidate={onOpenCandidate}
        onMoveToFinal={onMoveToFinal}
        onDragIds={dragIdsFor}
        onDropMove={handleMove}
        busy={busy}
      />
      <TrackSection
        title="In-person"
        sessions={inPersonGroups}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onOpenCandidate={onOpenCandidate}
        onMoveToFinal={onMoveToFinal}
        onDragIds={dragIdsFor}
        onDropMove={handleMove}
        busy={busy}
      />

      <div
        className={`bg-surface border border-border rounded-xl overflow-hidden ${
          dropHintOver ? "ring-2 ring-ink/25" : ""
        }`}
        onDragOver={(e) => {
          if (busy) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropHintOver(true);
        }}
        onDragLeave={() => setDropHintOver(false)}
        onDrop={(e) => {
          if (busy) return;
          e.preventDefault();
          setDropHintOver(false);
          const payload = parseDrag(e);
          if (!payload || payload.fromSessionId === null) return;
          handleMove(payload, null);
        }}
      >
        <button
          type="button"
          onClick={() => setUnassignedOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <span className="flex items-center gap-2 font-serif font-bold text-text text-[15px]">
            Unassigned
            <span className="text-text-muted text-[12.5px] font-sans font-normal">
              {unassigned.length} candidate{unassigned.length === 1 ? "" : "s"}
              {unassigned.length === 0 ? " · drop here to unassign" : " · not in an active group"}
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
                sessionId={null}
                locked={busy}
                selected={selectedIds.has(c.application_id)}
                onToggleSelect={toggleSelect}
                onOpenCandidate={onOpenCandidate}
                onMoveToFinal={onMoveToFinal}
                onDragIds={dragIdsFor}
              />
            ))}
            {unassigned.length === 0 && (
              <li className="px-5 py-6 text-[13px] text-text-muted text-center">
                Drop candidates here to unassign from a group
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
