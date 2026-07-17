import type { PreferenceMatchReason } from "./adminTypes";

/**
 * Client-side reimplementation of the backend's compute_preference_match
 * formula (admissions-backend/app/preferences/matching.py), used ONLY for
 * the Preferences page's "Impact Preview" simulation. It must stay in sync
 * with that file if the real formula ever changes.
 *
 * This works from each candidate's already-computed `reasons[]` (which
 * carries the raw `actual` value per field) rather than re-fetching raw
 * profile_data, so it can only simulate hypothetical cutoff/weight changes
 * on fields that were already part of some prior compute-match run for that
 * candidate. A brand-new field_name with no history will show as "missing"
 * for everyone until a real compute-match is run against raw profile data.
 */

export interface HypotheticalPreferenceConfig {
  field_name: string;
  is_hard_cutoff: boolean;
  cutoff_value: number | null;
  soft_weight: number;
}

export interface SimulatedMatchResult {
  composite_score: number;
  hard_pass: boolean;
}

function numericActual(reasons: PreferenceMatchReason[], fieldName: string): number | null {
  const reason = reasons.find((r) => r.field === fieldName);
  if (!reason) return null;
  return typeof reason.actual === "number" ? reason.actual : null;
}

export function simulateMatch(
  reasons: PreferenceMatchReason[],
  hypotheticalConfigs: HypotheticalPreferenceConfig[],
): SimulatedMatchResult {
  let hardPass = true;
  let compositeScore = 0;

  for (const config of hypotheticalConfigs) {
    const actual = numericActual(reasons, config.field_name);

    if (config.is_hard_cutoff) {
      const passed = actual != null && config.cutoff_value != null && actual >= config.cutoff_value;
      if (!passed) hardPass = false;
    }

    if (actual != null && config.soft_weight) {
      compositeScore += config.soft_weight * actual;
    }
  }

  return { composite_score: compositeScore, hard_pass: hardPass };
}

export interface ImpactPreviewSummary {
  totalCandidates: number;
  wouldPassCount: number;
  wouldRejectCount: number;
  passRate: number;
  averageCompositeScore: number;
}

export function simulateImpact(
  candidates: { application_id: string; reasons: PreferenceMatchReason[] }[],
  hypotheticalConfigs: HypotheticalPreferenceConfig[],
): ImpactPreviewSummary {
  const results = candidates.map((c) => simulateMatch(c.reasons, hypotheticalConfigs));
  const wouldPassCount = results.filter((r) => r.hard_pass).length;
  const totalCandidates = candidates.length;
  const averageCompositeScore =
    results.length === 0 ? 0 : results.reduce((sum, r) => sum + r.composite_score, 0) / results.length;

  return {
    totalCandidates,
    wouldPassCount,
    wouldRejectCount: totalCandidates - wouldPassCount,
    passRate: totalCandidates === 0 ? 0 : wouldPassCount / totalCandidates,
    averageCompositeScore,
  };
}
