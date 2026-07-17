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
 */
export function deriveStage(
  candidate: CandidateListItem,
  hardPass: boolean | null,
): PipelineStage {
  const { status, test_a_score } = candidate;

  if (status === "offered") return "offered";
  if (status === "called_for_interview") return "final_interview";
  if (status === "moved_to_campus" || status === "testing_complete") {
    return test_a_score == null ? "campus_test" : "campus_interview";
  }
  if (status === "rejected") {
    return hardPass === false ? "screening_rejected" : "screening_passed";
  }
  // submitted / under_review — not yet decided at screening
  return hardPass === false ? "screening_rejected" : "screening_passed";
}

export function attachMatchResults(
  candidates: CandidateListItem[],
  matchResults: PreferenceMatchResultListItem[],
): CandidateWithMatch[] {
  const byApplicationId = new Map<string, PreferenceMatchResultListItem>();
  for (const item of matchResults) {
    byApplicationId.set(item.application.id, item);
  }

  return candidates.map((candidate) => {
    const match = byApplicationId.get(candidate.application_id);
    const hardPass = match?.match_result?.hard_pass ?? null;
    return {
      ...candidate,
      hard_pass: hardPass,
      stage: deriveStage(candidate, hardPass),
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

export function searchCandidates<T extends { applicant_name: string | null }>(
  items: T[],
  query: string,
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => (item.applicant_name ?? "").toLowerCase().includes(trimmed));
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
