"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGdMeeting,
  endGdSession,
  getGdSession,
  getGdSettings,
  listCandidates,
  listGdSessions,
  packGdSessions,
  previewGdPack,
  startGdSession,
  updateGdSession,
  type GdSessionAdmin,
  type PackGroupSpec,
  type PackPreviewGroup,
} from "@/lib/adminApi";
import { PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

/** API track value stays `manual`; UI label is In-person. */
type TrackTab = "online" | "manual";

function trackLabel(track: TrackTab | string) {
  return track === "online" ? "Online" : "In-person";
}

type DraftGroup = {
  label: string;
  scheduled_at: string;
  duration_minutes: number;
  professor_name: string;
  professor_email: string;
  topic: string;
  application_ids: string[];
  applicants: { application_id: string; applicant_name: string | null; application_number: string | null }[];
};

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

function toDatetimeLocalValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function PackWizard({
  track,
  applicationIds,
  onDone,
  onCancel,
}: {
  track: TrackTab;
  applicationIds: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const settingsQuery = useQuery({
    queryKey: ["gd-settings", PROGRAM_ID],
    queryFn: () => getGdSettings(PROGRAM_ID),
  });
  const candidatesQuery = useQuery({
    queryKey: ["candidates", PROGRAM_ID],
    queryFn: () =>
      listCandidates({
        program_id: PROGRAM_ID,
        sort_by: "preference_match_score",
        order: "desc",
        limit: 500,
      }),
    enabled: track === "manual",
  });
  const [drafts, setDrafts] = useState<DraftGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Date.now());

  const previewMutation = useMutation({
    mutationFn: () =>
      previewGdPack({
        program_id: PROGRAM_ID,
        application_ids: applicationIds,
        min_size: settingsQuery.data?.min_group_size,
        max_size: settingsQuery.data?.max_group_size,
        seed,
      }),
    onSuccess: (preview) => {
      setError(null);
      const duration = settingsQuery.data?.default_duration_minutes ?? 30;
      const when = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
      setDrafts(
        preview.groups.map((g: PackPreviewGroup, i) => ({
          label: `GD-${trackLabel(track)}-${i + 1}`,
          scheduled_at: when,
          duration_minutes: duration,
          professor_name: "",
          professor_email: "",
          topic: "",
          application_ids: g.application_ids,
          applicants: g.applicants.map((a) => ({
            application_id: a.application_id,
            applicant_name: a.applicant_name,
            application_number: a.application_number,
          })),
        })),
      );
    },
    onError: (err: Error) => setError(err.message),
  });

  useEffect(() => {
    if (!settingsQuery.data || drafts) return;
    if (track === "online") {
      previewMutation.mutate();
      return;
    }
    // In-person: one group with selected people — resolve names from candidates list.
    if (candidatesQuery.isLoading || !candidatesQuery.data) return;
    const byId = new Map(
      candidatesQuery.data.map((c) => [c.application_id, c] as const),
    );
    const duration = settingsQuery.data.default_duration_minutes;
    setDrafts([
      {
        label: "GD-In-person-1",
        scheduled_at: toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
        duration_minutes: duration,
        professor_name: "",
        professor_email: "",
        topic: "",
        application_ids: applicationIds,
        applicants: applicationIds.map((id) => {
          const c = byId.get(id);
          return {
            application_id: id,
            applicant_name: c?.applicant_name ?? null,
            application_number: null,
          };
        }),
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when drafts cleared / settings load
  }, [settingsQuery.data, track, applicationIds, drafts, seed, candidatesQuery.data, candidatesQuery.isLoading]);

  const packMutation = useMutation({
    mutationFn: (groups: PackGroupSpec[]) =>
      packGdSessions({
        program_id: PROGRAM_ID,
        track,
        groups,
        auto_create_meetings: track === "online",
        move_status: true,
      }),
    onSuccess: () => onDone(),
    onError: (err: Error) => setError(err.message),
  });

  function updateDraft(index: number, patch: Partial<DraftGroup>) {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((g, i) => (i === index ? { ...g, ...patch } : g));
    });
  }

  function submit() {
    if (!drafts?.length) return;
    for (const g of drafts) {
      if (!g.label.trim()) {
        setError("Each group needs a name.");
        return;
      }
      if (!g.topic.trim()) {
        setError("Each group needs a topic.");
        return;
      }
    }
    packMutation.mutate(
      drafts.map((g) => ({
        label: g.label.trim(),
        scheduled_at: fromDatetimeLocalValue(g.scheduled_at),
        duration_minutes: g.duration_minutes,
        professor_name: g.professor_name.trim() || null,
        professor_email: g.professor_email.trim() || null,
        topic: g.topic.trim(),
        application_ids: g.application_ids,
      })),
    );
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface px-6 py-5 mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-serif text-[20px] font-semibold text-text">
            Create {trackLabel(track)} groups
          </h2>
          <p className="text-[13px] text-text-muted mt-1">
            {applicationIds.length} candidates selected
            {track === "online" && settingsQuery.data
              ? ` · pack size ${settingsQuery.data.min_group_size}–${settingsQuery.data.max_group_size}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {track === "online" && (
            <button
              type="button"
              onClick={() => {
                setDrafts(null);
                setSeed(Date.now());
                previewMutation.reset();
              }}
              className="px-3.5 py-2 rounded-[9px] border border-border text-[12.5px] font-semibold"
            >
              Re-shuffle
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-[9px] border border-border text-[12.5px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!drafts?.length || packMutation.isPending}
            onClick={submit}
            className="px-4 py-2 rounded-[9px] bg-ink text-white text-[12.5px] font-semibold disabled:opacity-40"
          >
            {packMutation.isPending ? "Creating…" : "Create groups"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[11px] border border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {error}
        </div>
      )}

      {(previewMutation.isPending ||
        settingsQuery.isLoading ||
        (track === "manual" && candidatesQuery.isLoading)) && (
        <div className="text-[13px] text-text-muted">Preparing groups…</div>
      )}

      {drafts?.map((g, index) => (
        <div key={index} className="rounded-[11px] border border-border bg-bg px-4 py-4 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <label className="text-[12px] font-semibold text-text-muted">
              Group name
              <input
                value={g.label}
                onChange={(e) => updateDraft(index, { label: e.target.value })}
                className="mt-1 w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-text"
              />
            </label>
            <label className="text-[12px] font-semibold text-text-muted">
              Date & time
              <input
                type="datetime-local"
                value={g.scheduled_at}
                onChange={(e) => updateDraft(index, { scheduled_at: e.target.value })}
                className="mt-1 w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-text"
              />
            </label>
            <label className="text-[12px] font-semibold text-text-muted">
              Moderator name
              <input
                value={g.professor_name}
                onChange={(e) => updateDraft(index, { professor_name: e.target.value })}
                className="mt-1 w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-text"
              />
            </label>
            <label className="text-[12px] font-semibold text-text-muted">
              Moderator email
              <input
                type="email"
                value={g.professor_email}
                onChange={(e) => updateDraft(index, { professor_email: e.target.value })}
                className="mt-1 w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-text"
              />
            </label>
          </div>
          <label className="text-[12px] font-semibold text-text-muted block mb-3">
            Topic
            <input
              value={g.topic}
              onChange={(e) => updateDraft(index, { topic: e.target.value })}
              className="mt-1 w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-text"
            />
          </label>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
            Candidates ({g.application_ids.length})
          </div>
          <ul className="text-[12.5px] text-text space-y-0.5">
            {g.applicants.map((a) => (
              <li key={a.application_id}>
                {a.applicant_name || "Unnamed applicant"}
                {a.application_number ? ` · ${a.application_number}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function HostPageInner() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [trackTab, setTrackTab] = useState<TrackTab>("online");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    label: "",
    scheduled_at: "",
    professor_name: "",
    professor_email: "",
    topic: "",
  });

  const packIds = useMemo(() => {
    const raw = searchParams.get("ids");
    if (!raw) return [] as string[];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }, [searchParams]);
  const packTrack = (searchParams.get("track") as TrackTab | null) ?? "online";
  const [wizardOpen, setWizardOpen] = useState(packIds.length > 0);

  useEffect(() => {
    if (packIds.length > 0) {
      setTrackTab(packTrack === "manual" ? "manual" : "online");
      setWizardOpen(true);
    }
  }, [packIds, packTrack]);

  const listQuery = useQuery({
    queryKey: ["gd-sessions", PROGRAM_ID],
    queryFn: () => listGdSessions(PROGRAM_ID),
    refetchInterval: 5000,
  });

  const sessions = useMemo(() => {
    const rows = [...(listQuery.data ?? [])].filter((s) => s.track === trackTab);
    rows.sort((a, b) => {
      const at = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const bt = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return bt - at;
    });
    return rows;
  }, [listQuery.data, trackTab]);

  const activeId = selectedId && sessions.some((s) => s.id === selectedId) ? selectedId : sessions[0]?.id ?? null;

  const detailQuery = useQuery({
    queryKey: ["gd-session", activeId],
    queryFn: () => getGdSession(activeId!),
    enabled: Boolean(activeId),
    refetchInterval: 3000,
  });

  const session: GdSessionAdmin | undefined = detailQuery.data;

  useEffect(() => {
    if (!session) return;
    setEditForm({
      label: session.label || "",
      scheduled_at: session.scheduled_at
        ? toDatetimeLocalValue(new Date(session.scheduled_at))
        : "",
      professor_name: session.professor_name || "",
      professor_email: session.professor_email || "",
      topic: session.topic || "",
    });
    setEditing(false);
  }, [session?.id]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["gd-sessions", PROGRAM_ID] });
    if (activeId) void queryClient.invalidateQueries({ queryKey: ["gd-session", activeId] });
    void queryClient.invalidateQueries({ queryKey: ["candidates", PROGRAM_ID] });
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

  const saveMutation = useMutation({
    mutationFn: () =>
      updateGdSession(activeId!, {
        label: editForm.label.trim() || null,
        scheduled_at: fromDatetimeLocalValue(editForm.scheduled_at),
        professor_name: editForm.professor_name.trim() || null,
        professor_email: editForm.professor_email.trim() || null,
        topic: editForm.topic.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      setEditing(false);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const createMeetingMutation = useMutation({
    mutationFn: () => createGdMeeting(activeId!),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const canStart =
    Boolean(session) &&
    Boolean(session?.topic) &&
    ["invited", "meeting_ready"].includes(session?.status ?? "");

  const canCreateMeeting =
    trackTab === "online" &&
    Boolean(session) &&
    Boolean(session?.scheduled_at) &&
    (session?.participants?.length ?? 0) > 0 &&
    (session?.status === "draft" || (session?.status === "meeting_ready" && !session?.join_url));

  const canEnd =
    Boolean(session) && ["live", "invited", "meeting_ready"].includes(session?.status ?? "");

  return (
    <div>
      <AdminTopbar
        title="Group Discussion"
        subtitle={`${PROGRAM_LABEL} · Online & In-person groups`}
      >
        <Link
          href="/admin/preferences"
          className="px-3.5 py-2 rounded-lg border border-border bg-surface text-[12.5px] font-semibold text-text hover:bg-[#F3F6F6]"
        >
          GD settings
        </Link>
      </AdminTopbar>

      {error && (
        <div className="mb-4 rounded-[11px] border border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {error}
        </div>
      )}

      {wizardOpen && packIds.length > 0 && (
        <PackWizard
          track={packTrack === "manual" ? "manual" : "online"}
          applicationIds={packIds}
          onCancel={() => setWizardOpen(false)}
          onDone={() => {
            setWizardOpen(false);
            invalidate();
            window.history.replaceState({}, "", "/admin/group-discussion");
          }}
        />
      )}

      <div className="flex gap-2 mb-4">
        {(["online", "manual"] as TrackTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTrackTab(t);
              setSelectedId(null);
            }}
            className={`px-4 py-2 rounded-[9px] text-[13px] font-semibold ${
              trackTab === t ? "bg-ink text-white" : "border border-border bg-surface text-text"
            }`}
          >
            {t === "online" ? "Online / Virtual" : "In-person"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="rounded-[14px] border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-[12px] font-semibold text-text-muted uppercase tracking-wide">
            {trackLabel(trackTab)} sessions
          </div>
          {listQuery.isLoading && (
            <div className="px-4 py-6 text-[13px] text-text-muted">Loading…</div>
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
              <li className="px-4 py-6 text-[13px] text-text-muted">
                No {trackLabel(trackTab).toLowerCase()} sessions yet. Select candidates on Campus
                Interview and pack groups.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-[14px] border border-border bg-surface px-6 py-5">
          {!session ? (
            <div className="text-[13.5px] text-text-muted">Select a session to host or edit.</div>
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
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusTone(session.status)}`}
                  >
                    {session.status}
                  </span>
                  {!editing && session.status !== "completed" && session.status !== "scored" && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="rounded-[11px] border border-border bg-bg px-4 py-4 mb-4 space-y-3">
                  {(
                    [
                      ["label", "Group name"],
                      ["scheduled_at", "Date & time"],
                      ["professor_name", "Moderator name"],
                      ["professor_email", "Moderator email"],
                      ["topic", "Topic"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-[12px] font-semibold text-text-muted">
                      {label}
                      <input
                        type={key === "scheduled_at" ? "datetime-local" : key === "professor_email" ? "email" : "text"}
                        value={editForm[key]}
                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="mt-1 w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-text"
                      />
                    </label>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={saveMutation.isPending}
                      onClick={() => saveMutation.mutate()}
                      className="px-4 py-2 rounded-[9px] bg-ink text-white text-[12.5px] font-semibold disabled:opacity-40"
                    >
                      {saveMutation.isPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 rounded-[9px] border border-border text-[12.5px] font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[11px] border border-border bg-bg px-4 py-3 mb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                    Topic
                  </div>
                  <div className="font-serif text-[16px] font-semibold text-text mb-2">
                    {session.topic || (
                      <span className="text-brick font-medium text-[13.5px]">No topic set</span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-text-muted">
                    Moderator: {session.professor_name || "—"}
                    {session.professor_email ? ` · ${session.professor_email}` : ""}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 mb-5">
                {canCreateMeeting && (
                  <button
                    type="button"
                    disabled={createMeetingMutation.isPending}
                    onClick={() => createMeetingMutation.mutate()}
                    className="px-5 py-2.5 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink-dark disabled:opacity-40 cursor-pointer"
                  >
                    {createMeetingMutation.isPending ? "Creating meeting…" : "Create Teams meeting"}
                  </button>
                )}
                {trackTab === "online" && (
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
                )}
                {session.status === "draft" && trackTab === "online" && !canCreateMeeting && (
                  <p className="w-full text-[12.5px] text-text-muted">
                    Roster changed or meeting not ready — set schedule and participants, then Create
                    Teams meeting before Start.
                  </p>
                )}
                <button
                  type="button"
                  disabled={!canEnd || endMutation.isPending}
                  onClick={() => endMutation.mutate()}
                  className="px-5 py-2.5 rounded-[9px] border border-border bg-surface text-[13px] font-semibold text-brick hover:bg-brick-soft disabled:opacity-40 cursor-pointer"
                >
                  {endMutation.isPending ? "Ending…" : "End discussion"}
                </button>
                {session.join_url && trackTab === "online" && (
                  <a
                    href={session.join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-[9px] border border-border bg-surface text-[13px] font-semibold text-text hover:bg-[#F3F6F6]"
                  >
                    Open in Teams
                  </a>
                )}
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
                  <li
                    key={p.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 bg-surface"
                  >
                    <div>
                      <div className="text-[13.5px] font-semibold text-text">
                        {p.applicant_name || "Candidate"}
                      </div>
                      <div className="text-[12px] text-text-muted">
                        {p.application_number || p.application_id}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GroupDiscussionHostPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-text-muted">Loading…</div>}>
      <HostPageInner />
    </Suspense>
  );
}
