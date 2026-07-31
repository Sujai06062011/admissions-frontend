import type { Application } from "./types";
import type {
  CandidateListItem,
  PreferenceMatchReason,
  PreferenceMatchResultListItem,
} from "./adminTypes";

/**
 * Client-side heuristics that paper over real gaps in the backend's data
 * model. None of these are authoritative — they exist so the Applications
 * page can render something useful today. Revisit if the backend ever adds
 * explicit sub-stage fields, a stored rank, or a rejection-reason aggregate.
 */

export type PipelineStage =
  | "screening_passed"
  | "screening_rejected"
  | "campus_test"
  | "campus_interview"
  | "final_interview"
  | "offered";

export const STAGE_TAB_LABELS: Record<
  "screening" | "campus_test" | "campus_interview" | "final_interview" | "offered",
  string
> = {
  screening: "Screening",
  campus_test: "Campus Test",
  campus_interview: "Campus Interview",
  final_interview: "Final Interview",
  offered: "Offered",
};

export interface CandidateWithMatch extends CandidateListItem {
  hard_pass: boolean | null;
  stage: PipelineStage;
  /** Sourced from the merged preference-match-results item — /candidates itself doesn't return it. */
  application_number: string | null;
  reasons: PreferenceMatchReason[];
}

/**
 * The backend's ApplicationStatus enum has a single "moved_to_campus" value
 * covering what the Figma design splits into two tabs (Campus Test, Campus
 * Interview). This further splits that one status using Test A/B score
 * presence as a proxy for "which of the two campus activities is this
 * candidate currently at" — a heuristic, not a stored fact.
 *
 * isOverridden marks a candidate an admin has manually cleared past a
 * hard-cutoff rejection (a "manual_override" AdminDecision). That decision
 * deliberately does NOT touch application.status on the backend (see
 * _apply_status_transition in app/preferences/router.py) — it's a two-step
 * flow: override only clears them into the normal Passed Screening pool,
 * and a separate "Move to Campus Test" click is what actually advances
 * status. match_result.hard_pass is an objective computed fact the override
 * doesn't change, so without this flag such a candidate would otherwise
 * keep showing as screening_rejected forever, with no action available to
 * move them forward.
 *
 * has_data_mismatch (candidate consented after name / auto-fill edits) also
 * forces screening_rejected until overridden, even when hard_pass is true —
 * admins must review the mismatch drawer before the candidate can advance.
 */
export function deriveStage(
  candidate: CandidateListItem,
  hardPass: boolean | null,
  isOverridden = false,
): PipelineStage {
  const { status, test_a_score } = candidate;

  if (status === "offered") return "offered";
  if (status === "called_for_interview") return "final_interview";
  if (status === "moved_to_campus" || status === "testing_complete") {
    return test_a_score == null ? "campus_test" : "campus_interview";
  }
  if (isOverridden) return "screening_passed";
  if (candidate.has_data_mismatch) return "screening_rejected";
  if (status === "rejected") {
    return hardPass === false ? "screening_rejected" : "screening_passed";
  }
  // submitted / under_review — not yet decided at screening
  return hardPass === false ? "screening_rejected" : "screening_passed";
}

export function attachMatchResults(
  candidates: CandidateListItem[],
  matchResults: PreferenceMatchResultListItem[],
  overriddenIds: Set<string> = new Set(),
): CandidateWithMatch[] {
  const byApplicationId = new Map<string, PreferenceMatchResultListItem>();
  for (const item of matchResults) {
    byApplicationId.set(item.application.id, item);
  }

  return candidates.map((candidate) => {
    const match = byApplicationId.get(candidate.application_id);
    const hardPass = match?.match_result?.hard_pass ?? null;
    const isOverridden = overriddenIds.has(candidate.application_id);
    return {
      ...candidate,
      hard_pass: hardPass,
      stage: deriveStage(candidate, hardPass, isOverridden),
      application_number: match?.application.application_number ?? null,
      reasons: match?.match_result?.reasons ?? [],
    };
  });
}

export function countByStage(candidates: CandidateWithMatch[]) {
  return {
    screening: candidates.length,
    campus_test: candidates.filter((c) => c.stage === "campus_test").length,
    campus_interview: candidates.filter((c) => c.stage === "campus_interview").length,
    final_interview: candidates.filter((c) => c.stage === "final_interview").length,
    offered: candidates.filter((c) => c.stage === "offered").length,
  };
}

/** Rank is not persisted by the backend — computed per rendered list, sorted by composite score desc (nulls last). */
export function withRank<T extends { preference_match_score: number | null }>(
  items: T[],
): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => {
    if (a.preference_match_score == null) return 1;
    if (b.preference_match_score == null) return -1;
    return b.preference_match_score - a.preference_match_score;
  });
  return sorted.map((item, index) => ({ ...item, rank: index + 1 }));
}

export type ScoreBand = "high" | "mid" | "low" | "unscored";

/**
 * composite_score is an open-ended weighted sum, not an inherent 0-100
 * scale, so absolute thresholds would be meaningless. Colors are assigned by
 * percentile within whatever list is currently loaded instead.
 */
export function computeScoreBands(
  scores: (number | null)[],
): Map<number | null, ScoreBand> {
  const numeric = scores.filter((s): s is number => s != null).sort((a, b) => b - a);
  const bandFor = (score: number | null): ScoreBand => {
    if (score == null) return "unscored";
    const rank = numeric.indexOf(score);
    const percentile = numeric.length <= 1 ? 0 : rank / (numeric.length - 1);
    if (percentile <= 1 / 3) return "high";
    if (percentile <= 2 / 3) return "mid";
    return "low";
  };
  const map = new Map<number | null, ScoreBand>();
  for (const score of scores) map.set(score, bandFor(score));
  return map;
}

export function searchCandidates<
  T extends {
    applicant_name: string | null;
    application_id?: string;
    application_number?: string | null;
  },
>(items: T[], query: string): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => {
    const name = (item.applicant_name ?? "").toLowerCase();
    const number = (item.application_number ?? "").toLowerCase();
    const id = (item.application_id ?? "").toLowerCase();
    return name.includes(trimmed) || number.includes(trimmed) || id.includes(trimmed);
  });
}

export function applicationNumberOf(application: Application | undefined | null): string {
  return application?.application_number ?? "—";
}

/**
 * Best-effort lookup of a scoring field's raw value from a candidate's
 * preference-match reasons. These column values only render if the program
 * happens to have a PreferenceConfig row using this exact field_name — the
 * candidate-facing app currently nests 10th%/12th%/experience/certs under
 * documents[].ocr_result.parsed rather than writing these flat profile_data
 * keys, so on a fresh/unreconciled dataset these will legitimately show
 * "—" instead of fabricating a number.
 */
export function reasonValue(reasons: PreferenceMatchReason[], fieldName: string): number | string | null {
  return reasons.find((r) => r.field === fieldName)?.actual ?? null;
}

export const SCREENING_FIELD_NAMES = {
  tenthPercentage: "10th_percentage",
  twelfthPercentage: "12th_percentage",
  ugPercentage: "ug_percentage",
  experienceYears: "experience_years",
  certificationsCount: "certifications_count",
} as const;

export const STAGE_BADGE_LABELS: Record<PipelineStage, string> = {
  screening_passed: "Passed Screening",
  screening_rejected: "Hard Reject",
  campus_test: "Campus Test",
  campus_interview: "Campus Interview",
  final_interview: "Final Interview",
  offered: "Offered",
};

export const STAGE_BADGE_COLORS: Record<PipelineStage, string> = {
  screening_passed: "bg-border/50 text-text-muted",
  screening_rejected: "bg-brick-soft text-brick",
  campus_test: "bg-gold-soft text-gold",
  campus_interview: "bg-ink-light/15 text-ink-light",
  final_interview: "bg-forest-soft text-forest",
  offered: "bg-forest text-white",
};

export type ScreeningActionKey =
  | "move_to_campus"
  | "awaiting_campus_test"
  | "move_to_final"
  | "mark_offered"
  | "override";

export const SCREENING_ACTION_LABELS: Record<ScreeningActionKey, string> = {
  move_to_campus: "Move to Campus Test",
  awaiting_campus_test: "Awaiting Campus Test",
  move_to_final: "Move to Final Interview",
  mark_offered: "Mark as Offered",
  override: "Override & Accept",
};

export function screeningActionKey(candidate: CandidateWithMatch): ScreeningActionKey | null {
  switch (candidate.stage) {
    case "screening_rejected":
      return "override";
    case "screening_passed":
      return "move_to_campus";
    case "campus_test":
      return "awaiting_campus_test";
    case "campus_interview":
      return "move_to_final";
    case "final_interview":
      return "mark_offered";
    default:
      return null;
  }
}

export function matchesScreeningFilters(
  candidate: CandidateWithMatch,
  filters: {
    stages: ReadonlySet<PipelineStage>;
    actions: ReadonlySet<ScreeningActionKey>;
    bands: ReadonlySet<ScoreBand>;
    bandOf: (score: number | null) => ScoreBand;
  },
): boolean {
  if (filters.stages.size > 0 && !filters.stages.has(candidate.stage)) return false;
  if (filters.actions.size > 0) {
    const action = screeningActionKey(candidate);
    if (!action || !filters.actions.has(action)) return false;
  }
  if (filters.bands.size > 0) {
    if (!filters.bands.has(filters.bandOf(candidate.preference_match_score))) return false;
  }
  return true;
}
