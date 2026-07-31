"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  callForInterview,
  createAdminDecision,
  listAdminDecisions,
  listCandidates,
  listPreferenceMatchResults,
} from "@/lib/adminApi";
import { PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import {
  STAGE_BADGE_COLORS,
  STAGE_BADGE_LABELS,
  SCREENING_ACTION_LABELS,
  SCREENING_FIELD_NAMES,
  attachMatchResults,
  computeScoreBands,
  countByStage,
  matchesScreeningFilters,
  reasonValue,
  searchCandidates,
  withRank,
  type CandidateWithMatch,
  type PipelineStage,
  type ScreeningActionKey,
} from "@/lib/adminPipeline";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { StageTabs, type StageTabDef } from "@/components/admin/StageTabs";
import { ScoreGauge } from "@/components/admin/ScoreGauge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CandidateDrawer } from "@/components/admin/CandidateDrawer";
import { ChevronDownIcon, CloseIcon, SearchIcon, SlidersIcon } from "@/components/admin/icons";

type StageTabKey = "screening" | "campus_test" | "campus_interview" | "final_interview" | "offered";

type PendingAction =
  | { type: "move_to_campus"; candidate: CandidateWithMatch }
  | { type: "override"; candidate: CandidateWithMatch }
  | { type: "move_to_final"; candidate: CandidateWithMatch }
  | { type: "mark_offered"; candidate: CandidateWithMatch };

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatPercentage(value: number | string | null): string {
  if (value == null || value === "") return "—";
  return `${value}%`;
}

function formatScoreOutOf100(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value)}/100`;
}

function CandidateCell({
  candidate,
  isTopPick,
  isOverridden = false,
}: {
  candidate: CandidateWithMatch;
  isTopPick: boolean;
  isOverridden?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-ink-light/15 text-ink-light flex items-center justify-center text-[11px] font-bold shrink-0">
        {initials(candidate.applicant_name)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold text-text truncate">
            {candidate.applicant_name || "Unnamed applicant"}
          </span>
          {isTopPick && (
            <span className="text-[9.5px] font-bold uppercase tracking-wide bg-gold-soft text-gold rounded-full px-1.5 py-0.5 shrink-0">
              Top Pick
            </span>
          )}
          {isOverridden && <OverriddenBadge />}
          {candidate.has_data_mismatch && <MismatchBadge />}
          {candidate.proctoring_flagged && <ProctoringFlaggedBadge />}
        </div>
        <div className="text-[11px] text-text-muted truncate">
          {candidate.application_number ?? candidate.application_id.slice(0, 8).toUpperCase()}
        </div>
      </div>
    </div>
  );
}

function StageBadge({ candidate }: { candidate: CandidateWithMatch }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STAGE_BADGE_COLORS[candidate.stage]}`}
    >
      {STAGE_BADGE_LABELS[candidate.stage]}
    </span>
  );
}

/** Small visual cue alongside the stage badge — the row's light-purple
 * background (see OVERRIDDEN_ROW_CLASS) already signals this, but a text
 * label keeps it legible for anyone relying on high-contrast/no-color
 * viewing and reads clearly in a screenshot or printout. */
function OverriddenBadge() {
  return (
    <span
      title="This candidate failed a hard-cutoff rule and was manually overridden into the pipeline."
      className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EEE3FB] text-[#7A4FC4]"
    >
      Overridden
    </span>
  );
}

/** Flags a Test B interview Claude's vision review found suspicious (e.g. a
 * second person visible in a snapshot) — surfaced right in the candidate
 * cell since this is the kind of thing an admin should notice at a glance,
 * not only after opening the drawer. */
function ProctoringFlaggedBadge() {
  return (
    <span
      title="The AI interview's proctoring review flagged a possible academic-integrity concern — see the candidate drawer for details."
      className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-brick/10 text-brick"
    >
      ⚠ Flagged
    </span>
  );
}

function MismatchBadge() {
  return (
    <span
      title="Candidate submitted with name or field mismatches vs their documents — review the drawer before overriding."
      className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-gold-soft text-gold"
    >
      Mismatch
    </span>
  );
}

const OVERRIDDEN_ROW_CLASS = "bg-[#F7F2FD]";
const PROCTORING_FLAGGED_ROW_CLASS = "bg-brick-soft";
const MISMATCH_ROW_CLASS = "bg-[#FFF8E8]";

/** Priority: proctoring integrity > active mismatch hold > override highlight. */
function rowHighlightClass(candidate: CandidateWithMatch, overriddenIds: Set<string>): string {
  if (candidate.proctoring_flagged) return PROCTORING_FLAGGED_ROW_CLASS;
  if (overriddenIds.has(candidate.application_id)) return OVERRIDDEN_ROW_CLASS;
  if (candidate.has_data_mismatch) return MISMATCH_ROW_CLASS;
  return "";
}

const SCREENING_STAGE_FILTERS: PipelineStage[] = [
  "screening_passed",
  "campus_test",
  "campus_interview",
  "final_interview",
  "offered",
  "screening_rejected",
];

const SCREENING_ACTION_FILTERS: ScreeningActionKey[] = [
  "move_to_campus",
  "awaiting_campus_test",
  "move_to_final",
  "mark_offered",
  "override",
];

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function ScreeningFilterMenu({
  stageFilters,
  actionFilters,
  onApply,
  onClear,
}: {
  stageFilters: Set<PipelineStage>;
  actionFilters: Set<ScreeningActionKey>;
  onApply: (stages: Set<PipelineStage>, actions: Set<ScreeningActionKey>) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStages, setDraftStages] = useState<Set<PipelineStage>>(new Set());
  const [draftActions, setDraftActions] = useState<Set<ScreeningActionKey>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  const activeCount = stageFilters.size + actionFilters.size;

  useEffect(() => {
    if (!open) return;
    setDraftStages(new Set(stageFilters));
    setDraftActions(new Set(actionFilters));
  }, [open, stageFilters, actionFilters]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-[13px] font-semibold transition ${
          activeCount > 0
            ? "border-ink bg-ink text-white"
            : "border-border bg-surface text-text hover:border-ink/30"
        }`}
      >
        <SlidersIcon className="w-4 h-4" />
        Filter
        {activeCount > 0 && (
          <span
            className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
              activeCount > 0 ? "bg-white/20 text-white" : "bg-ink/10 text-ink"
            }`}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-[320px] bg-surface border border-border rounded-xl shadow-lg p-3.5 space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
              Stage
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {SCREENING_STAGE_FILTERS.map((stage) => (
                <label
                  key={stage}
                  className="flex items-center gap-2 text-[13px] text-text cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={draftStages.has(stage)}
                    onChange={() => setDraftStages((prev) => toggleInSet(prev, stage))}
                    className="w-3.5 h-3.5 accent-ink"
                  />
                  {STAGE_BADGE_LABELS[stage]}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
              Action
            </div>
            <div className="space-y-1.5">
              {SCREENING_ACTION_FILTERS.map((action) => (
                <label
                  key={action}
                  className="flex items-center gap-2 text-[13px] text-text cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={draftActions.has(action)}
                    onChange={() => setDraftActions((prev) => toggleInSet(prev, action))}
                    className="w-3.5 h-3.5 accent-ink"
                  />
                  {SCREENING_ACTION_LABELS[action]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => {
                setDraftStages(new Set());
                setDraftActions(new Set());
                onClear();
                setOpen(false);
              }}
              className="text-[12.5px] font-semibold text-text-muted hover:text-text"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(new Set(draftStages), new Set(draftActions));
                setOpen(false);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-ink text-white text-[12.5px] font-semibold hover:bg-ink-dark"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<StageTabKey>("screening");
  const [search, setSearch] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [rejectedExpanded, setRejectedExpanded] = useState(true);
  const [passedExpanded, setPassedExpanded] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [stageFilters, setStageFilters] = useState<Set<PipelineStage>>(new Set());
  const [actionFilters, setActionFilters] = useState<Set<ScreeningActionKey>>(new Set());

  const candidatesQuery = useQuery({
    queryKey: ["candidates", PROGRAM_ID],
    queryFn: () =>
      listCandidates({
        program_id: PROGRAM_ID,
        sort_by: "preference_match_score",
        order: "desc",
        limit: 500,
      }),
  });

  const matchResultsQuery = useQuery({
    queryKey: ["preference-match-results", PROGRAM_ID],
    queryFn: () => listPreferenceMatchResults({ program_id: PROGRAM_ID, limit: 500 }),
  });

  const overridesQuery = useQuery({
    queryKey: ["admin-decisions", PROGRAM_ID, "manual_override"],
    queryFn: () => listAdminDecisions({ program_id: PROGRAM_ID, decision: "manual_override" }),
  });

  const isLoading = candidatesQuery.isLoading || matchResultsQuery.isLoading;
  const isError = candidatesQuery.isError || matchResultsQuery.isError;

  const overriddenIds = useMemo(
    () => new Set((overridesQuery.data ?? []).map((d) => d.application_id)),
    [overridesQuery.data],
  );

  // overriddenIds feeds into stage derivation itself (an overridden
  // candidate displays as "screening_passed" so they get the same "Move to
  // Campus Test" action as anyone else, per app/preferences/router.py's
  // two-step override flow — see the isOverridden param on deriveStage) —
  // not just the badge/highlight below.
  const allCandidates = useMemo(() => {
    if (!candidatesQuery.data) return [];
    return attachMatchResults(candidatesQuery.data, matchResultsQuery.data ?? [], overriddenIds);
  }, [candidatesQuery.data, matchResultsQuery.data, overriddenIds]);

  const filtered = useMemo(() => searchCandidates(allCandidates, search), [allCandidates, search]);
  const counts = useMemo(() => countByStage(allCandidates), [allCandidates]);

  const screeningFiltered = useMemo(() => {
    if (stageFilters.size === 0 && actionFilters.size === 0) {
      return filtered;
    }
    return filtered.filter((c) =>
      matchesScreeningFilters(c, {
        stages: stageFilters,
        actions: actionFilters,
        bands: new Set(),
        bandOf: () => "unscored",
      }),
    );
  }, [filtered, stageFilters, actionFilters]);

  const passedTotal = useMemo(
    () => filtered.filter((c) => c.stage !== "screening_rejected").length,
    [filtered],
  );
  const rejectedTotal = useMemo(
    () => filtered.filter((c) => c.stage === "screening_rejected").length,
    [filtered],
  );

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["candidates", PROGRAM_ID] });
    queryClient.invalidateQueries({ queryKey: ["preference-match-results", PROGRAM_ID] });
    queryClient.invalidateQueries({ queryKey: ["funnel", PROGRAM_ID] });
    queryClient.invalidateQueries({ queryKey: ["admin-decisions", PROGRAM_ID] });
  }

  const moveToCampusMutation = useMutation({
    mutationFn: (applicationId: string) =>
      createAdminDecision({ application_id: applicationId, stage: "stage2_move_to_campus", decision: "approved" }),
    onSuccess: () => {
      invalidateAll();
      setPendingAction(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const overrideMutation = useMutation({
    mutationFn: ({ applicationId, notes }: { applicationId: string; notes: string }) =>
      createAdminDecision({
        application_id: applicationId,
        stage: "stage2_move_to_campus",
        decision: "manual_override",
        notes,
      }),
    onSuccess: () => {
      invalidateAll();
      setPendingAction(null);
      setOverrideReason("");
    },
    onError: (err: Error) => setActionError(err.message),
  });

  // Two backend records (AdminDecision + FinalDecision) currently track this
  // transition independently and can desync the funnel's called_for_interview
  // count, so both are written together to keep them consistent.
  const moveToFinalMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      await createAdminDecision({
        application_id: applicationId,
        stage: "stage3_call_for_interview",
        decision: "approved",
      });
      await callForInterview([applicationId]);
    },
    onSuccess: () => {
      invalidateAll();
      setPendingAction(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const markOfferedMutation = useMutation({
    mutationFn: (applicationId: string) =>
      createAdminDecision({
        application_id: applicationId,
        stage: "stage4_offer",
        decision: "approved",
      }),
    onSuccess: () => {
      invalidateAll();
      setPendingAction(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const actionLoading =
    moveToCampusMutation.isPending ||
    overrideMutation.isPending ||
    moveToFinalMutation.isPending ||
    markOfferedMutation.isPending;

  const tabs: StageTabDef[] = [
    { key: "screening", label: "Screening", count: counts.screening },
    { key: "campus_test", label: "Campus Test", count: counts.campus_test },
    { key: "campus_interview", label: "Campus Interview", count: counts.campus_interview },
    { key: "final_interview", label: "Final Interview", count: counts.final_interview },
    { key: "offered", label: "Offered", count: counts.offered },
  ];

  const passedRows = withRank(screeningFiltered.filter((c) => c.stage !== "screening_rejected"));
  const rejectedRows = withRank(screeningFiltered.filter((c) => c.stage === "screening_rejected"));
  const passedScoreBands = computeScoreBands(passedRows.map((c) => c.preference_match_score));
  const rejectedScoreBands = computeScoreBands(rejectedRows.map((c) => c.preference_match_score));

  const stageRows =
    tab === "screening" ? [] : withRank(filtered.filter((c) => c.stage === tab));
  const stageScoreBands = computeScoreBands(stageRows.map((c) => c.preference_match_score));

  const filtersActive = stageFilters.size > 0 || actionFilters.size > 0;

  function confirmCopy(action: PendingAction) {
    const name = action.candidate.applicant_name || "this candidate";
    switch (action.type) {
      case "move_to_campus":
        return {
          title: "Move to Campus?",
          description: `${name} will be moved to the campus stage (Campus Test / Campus Interview).`,
          confirmLabel: "Move to Campus",
        };
      case "override":
        return {
          title: "Override screening rejection?",
          description: `${name} failed one or more hard-cutoff rules. Overriding moves them directly to the campus stage.`,
          confirmLabel: "Override & Accept",
        };
      case "move_to_final":
        return {
          title: "Move to Final Interview?",
          description: `${name} will be called for the final interview. This writes both the admin decision and the interview-call record.`,
          confirmLabel: "Move to Final Interview",
        };
      case "mark_offered":
        return {
          title: "Mark as Offered?",
          description: `${name} will be marked as offered and move to the Offered stage.`,
          confirmLabel: "Mark as Offered",
        };
    }
  }

  const passedColumns: TableColumn<CandidateWithMatch & { rank: number }>[] = [
    { key: "rank", header: "Rank", render: (c) => <span className="text-text-muted font-semibold">#{c.rank}</span> },
    {
      key: "candidate",
      header: "Candidate",
      render: (c) => (
        <CandidateCell candidate={c} isTopPick={c.rank === 1} isOverridden={overriddenIds.has(c.application_id)} />
      ),
    },
    {
      key: "composite",
      header: "Composite",
      render: (c) => (
        <ScoreGauge score={c.preference_match_score} band={passedScoreBands.get(c.preference_match_score) ?? "unscored"} />
      ),
    },
    {
      key: "tenth",
      header: "10th %",
      render: (c) => formatPercentage(reasonValue(c.reasons, SCREENING_FIELD_NAMES.tenthPercentage)),
    },
    {
      key: "twelfth",
      header: "12th %",
      render: (c) => formatPercentage(reasonValue(c.reasons, SCREENING_FIELD_NAMES.twelfthPercentage)),
    },
    {
      key: "ug",
      header: "UG %",
      render: (c) => formatPercentage(reasonValue(c.reasons, SCREENING_FIELD_NAMES.ugPercentage)),
    },
    {
      key: "exp",
      header: "Exp",
      render: (c) => {
        const v = reasonValue(c.reasons, SCREENING_FIELD_NAMES.experienceYears);
        return v == null ? "—" : `${v}yr`;
      },
    },
    {
      key: "certs",
      header: "Certs",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.certificationsCount) ?? "—",
    },
    { key: "stage", header: "Stage", render: (c) => <StageBadge candidate={c} /> },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => {
        if (c.stage === "screening_passed") {
          return (
            <button
              type="button"
              onClick={() => setPendingAction({ type: "move_to_campus", candidate: c })}
              className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
            >
              Move to Campus Test
            </button>
          );
        }
        if (c.stage === "campus_test") {
          return <span className="text-[12px] text-text-muted">Awaiting Campus Test</span>;
        }
        if (c.stage === "campus_interview") {
          return (
            <button
              type="button"
              onClick={() => setPendingAction({ type: "move_to_final", candidate: c })}
              className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
            >
              Move to Final Interview
            </button>
          );
        }
        if (c.stage === "final_interview") {
          return (
            <button
              type="button"
              onClick={() => setPendingAction({ type: "mark_offered", candidate: c })}
              className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
            >
              Mark as Offered
            </button>
          );
        }
        return <span className="text-text-muted">—</span>;
      },
    },
  ];

  const rejectedColumns: TableColumn<CandidateWithMatch & { rank: number }>[] = [
    { key: "rank", header: "Rank", render: (c) => <span className="text-text-muted font-semibold">#{c.rank}</span> },
    {
      key: "candidate",
      header: "Candidate",
      render: (c) => <CandidateCell candidate={c} isTopPick={false} />,
    },
    {
      key: "composite",
      header: "Composite",
      render: (c) => (
        <ScoreGauge
          score={c.preference_match_score}
          band={rejectedScoreBands.get(c.preference_match_score) ?? "unscored"}
        />
      ),
    },
    {
      key: "tenth",
      header: "10th %",
      render: (c) => formatPercentage(reasonValue(c.reasons, SCREENING_FIELD_NAMES.tenthPercentage)),
    },
    {
      key: "twelfth",
      header: "12th %",
      render: (c) => formatPercentage(reasonValue(c.reasons, SCREENING_FIELD_NAMES.twelfthPercentage)),
    },
    {
      key: "ug",
      header: "UG %",
      render: (c) => formatPercentage(reasonValue(c.reasons, SCREENING_FIELD_NAMES.ugPercentage)),
    },
    {
      key: "exp",
      header: "Exp",
      render: (c) => {
        const v = reasonValue(c.reasons, SCREENING_FIELD_NAMES.experienceYears);
        return v == null ? "—" : `${v}yr`;
      },
    },
    {
      key: "certs",
      header: "Certs",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.certificationsCount) ?? "—",
    },
    { key: "stage", header: "Stage", render: (c) => <StageBadge candidate={c} /> },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => (
        <button
          type="button"
          onClick={() => setPendingAction({ type: "override", candidate: c })}
          className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
        >
          Override &amp; Accept
        </button>
      ),
    },
  ];

  const stageColumns: TableColumn<CandidateWithMatch & { rank: number }>[] = [
    { key: "rank", header: "Rank", render: (c) => <span className="text-text-muted font-semibold">#{c.rank}</span> },
    {
      key: "candidate",
      header: "Candidate",
      render: (c) => (
        <CandidateCell candidate={c} isTopPick={c.rank === 1} isOverridden={overriddenIds.has(c.application_id)} />
      ),
    },
    {
      key: "composite",
      header: "Composite",
      render: (c) => (
        <ScoreGauge score={c.preference_match_score} band={stageScoreBands.get(c.preference_match_score) ?? "unscored"} />
      ),
    },
    {
      key: "tenth",
      header: "10th %",
      render: (c) => formatPercentage(reasonValue(c.reasons, SCREENING_FIELD_NAMES.tenthPercentage)),
    },
    {
      key: "twelfth",
      header: "12th %",
      render: (c) => formatPercentage(reasonValue(c.reasons, SCREENING_FIELD_NAMES.twelfthPercentage)),
    },
    {
      key: "ug",
      header: "UG %",
      render: (c) => formatPercentage(reasonValue(c.reasons, SCREENING_FIELD_NAMES.ugPercentage)),
    },
    {
      key: "test_a",
      header: "Campus Test",
      render: (c) => formatScoreOutOf100(c.test_a_score),
    },
    {
      key: "test_b",
      header: "Video Interview",
      render: (c) => formatScoreOutOf100(c.test_b_score),
    },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => {
        if (tab === "campus_interview") {
          return (
            <button
              type="button"
              onClick={() => setPendingAction({ type: "move_to_final", candidate: c })}
              className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
            >
              Move to Final Interview
            </button>
          );
        }
        if (tab === "campus_test") {
          return <span className="text-[12px] text-text-muted">Awaiting Campus Test</span>;
        }
        if (tab === "final_interview") {
          return (
            <button
              type="button"
              onClick={() => setPendingAction({ type: "mark_offered", candidate: c })}
              className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
            >
              Mark as Offered
            </button>
          );
        }
        return <span className="text-text-muted">—</span>;
      },
    },
  ];

  const pendingCopy = pendingAction ? confirmCopy(pendingAction) : null;

  return (
    <div>
      <AdminTopbar
        title="Applications"
        subtitle={`${PROGRAM_LABEL} · ${allCandidates.length} total received`}
      >
        <div className="flex items-center gap-2">
          {tab === "screening" && (
            <ScreeningFilterMenu
              stageFilters={stageFilters}
              actionFilters={actionFilters}
              onApply={(stages, actions) => {
                setStageFilters(stages);
                setActionFilters(actions);
              }}
              onClear={() => {
                setStageFilters(new Set());
                setActionFilters(new Set());
              }}
            />
          )}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID..."
              className="pl-9 pr-9 py-2 border border-border rounded-lg text-[13px] w-64 bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
            />
            {search.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </AdminTopbar>

      <div className="mb-5">
        <StageTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as StageTabKey)} />
      </div>

      {actionError && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {isLoading && <div className="text-sm text-text-muted">Loading applications…</div>}
      {isError && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3">
          Couldn&apos;t load applications. The backend may be unreachable — try refreshing.
        </div>
      )}

      {!isLoading && !isError && tab === "screening" && (
        <div className="space-y-5">
          {filtersActive && (
            <div className="flex items-center justify-between gap-3 text-[12.5px] text-text-muted">
              <span>
                Filtering by{" "}
                {[
                  ...Array.from(stageFilters).map((s) => STAGE_BADGE_LABELS[s]),
                  ...Array.from(actionFilters).map((a) => SCREENING_ACTION_LABELS[a]),
                ].join(" · ")}
              </span>
              <button
                type="button"
                onClick={() => {
                  setStageFilters(new Set());
                  setActionFilters(new Set());
                }}
                className="font-semibold text-ink-light hover:text-ink shrink-0"
              >
                Clear
              </button>
            </div>
          )}

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPassedExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <span className="flex items-center gap-2 font-serif font-bold text-text text-[15px]">
                <span className="text-forest">✓</span> Passed Screening
                <span className="text-text-muted text-[12.5px] font-sans font-normal">
                  {filtersActive
                    ? `${passedRows.length} of ${passedTotal} candidates`
                    : `${passedRows.length} candidates`}
                </span>
              </span>
              <ChevronDownIcon className={`w-4 h-4 text-text-muted transition ${passedExpanded ? "" : "-rotate-90"}`} />
            </button>
            {passedExpanded && (
              <Table
                columns={passedColumns}
                rows={passedRows}
                rowKey={(c) => c.application_id}
                emptyMessage={
                  filtersActive
                    ? "No passed candidates match these filters."
                    : "No candidates have passed screening yet."
                }
                onRowClick={(c) => setDrawerId(c.application_id)}
                rowClassName={(c) => rowHighlightClass(c, overriddenIds)}
              />
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setRejectedExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <span className="flex items-center gap-2 font-serif font-bold text-text text-[15px]">
                <span className="text-brick">⊘</span> Rejected at Screening
                <span className="text-text-muted text-[12.5px] font-sans font-normal">
                  {filtersActive
                    ? `${rejectedRows.length} of ${rejectedTotal} candidates`
                    : `${rejectedRows.length} candidates`}
                </span>
              </span>
              <ChevronDownIcon className={`w-4 h-4 text-text-muted transition ${rejectedExpanded ? "" : "-rotate-90"}`} />
            </button>
            {rejectedExpanded && (
              <Table
                columns={rejectedColumns}
                rows={rejectedRows}
                rowKey={(c) => c.application_id}
                emptyMessage={
                  filtersActive
                    ? "No rejected candidates match these filters."
                    : "No candidates rejected at screening."
                }
                onRowClick={(c) => setDrawerId(c.application_id)}
                rowClassName={(c) => rowHighlightClass(c, overriddenIds)}
              />
            )}
          </div>
        </div>
      )}

      {!isLoading && !isError && tab !== "screening" && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <Table
            columns={stageColumns}
            rows={stageRows}
            rowKey={(c) => c.application_id}
            emptyMessage="No candidates at this stage yet."
            onRowClick={(c) => setDrawerId(c.application_id)}
            rowClassName={(c) => rowHighlightClass(c, overriddenIds)}
          />
        </div>
      )}

      <CandidateDrawer applicationId={drawerId} onClose={() => setDrawerId(null)} />

      {pendingAction && pendingCopy && (
        <ConfirmDialog
          open
          title={pendingCopy.title}
          description={pendingCopy.description}
          confirmLabel={pendingCopy.confirmLabel}
          loading={actionLoading}
          confirmDisabled={pendingAction.type === "override" && overrideReason.trim().length === 0}
          onCancel={() => {
            setPendingAction(null);
            setOverrideReason("");
          }}
          onConfirm={() => {
            const id = pendingAction.candidate.application_id;
            setActionError(null);
            if (pendingAction.type === "move_to_campus") moveToCampusMutation.mutate(id);
            if (pendingAction.type === "override")
              overrideMutation.mutate({ applicationId: id, notes: overrideReason.trim() });
            if (pendingAction.type === "move_to_final") moveToFinalMutation.mutate(id);
            if (pendingAction.type === "mark_offered") markOfferedMutation.mutate(id);
          }}
        >
          {pendingAction.type === "override" && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
                Reason for override <span className="text-brick">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Strong prior work experience offsets a marginal 10th percentage."
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15 resize-none"
              />
              <p className="text-[11px] text-text-muted mt-1.5">
                Recorded against this candidate for audit purposes.
              </p>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
