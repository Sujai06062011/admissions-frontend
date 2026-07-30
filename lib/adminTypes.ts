import type { Application, Applicant, ApplicationStatus, ProfileData, UploadedDocument } from "./types";

// --- Auth ---

export interface AdminProfile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export interface AdminLoginInput {
  email: string;
  password: string;
}

// --- Dashboard / funnel ---

export interface FunnelResponse {
  program_id: string;
  received: number;
  rejected_on_preference_match: number;
  moved_to_campus: number;
  test_a_complete: number;
  test_b_complete: number;
  called_for_interview: number;
  offered: number;
}

export interface CandidateListItem {
  application_id: string;
  applicant_name: string | null;
  program_id: string;
  status: ApplicationStatus;
  preference_match_score: number | null;
  test_a_score: number | null;
  test_b_score: number | null;
  proctoring_flagged: boolean | null;
  /** True when the candidate consented to submit despite name/field mismatches
   * vs OCR — stored under profile_data.data.data_mismatches. */
  has_data_mismatch: boolean;
}

export type CandidateSortBy = "preference_match_score" | "test_a_score" | "test_b_score";

export interface ListCandidatesParams {
  program_id?: string;
  status?: string;
  sort_by?: CandidateSortBy;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface RubricScore {
  grammar?: number;
  fluency?: number;
  reasoning?: number;
  coherence?: number;
}

export interface TestASessionResponse {
  application_id: string;
  generated_questions: unknown;
  answers: unknown;
  score: number | null;
  started_at: string | null;
  submitted_at: string | null;
}

export type TabSwitchEventType = "hidden" | "visible" | "blur" | "focus";

export interface TabSwitchEvent {
  type: TabSwitchEventType;
  at: string;
  away_ms: number | null;
}

export interface ProctoringReview {
  flagged: boolean;
  faces_per_snapshot: number[];
  notes: string | null;
  reviewed_at: string | null;
}

export interface TestBSessionResponse {
  application_id: string;
  prompt_id: string;
  recording_url: string | null;
  transcript: string | null;
  rubric_score: RubricScore | null;
  rationale: string | null;
  recorded_at: string | null;
  snapshot_urls: string[] | null;
  tab_switch_events: TabSwitchEvent[] | null;
  proctoring_review: ProctoringReview | null;
}

export type CheckInStatus = "not_checked_in" | "checked_in";

export interface CampusSessionResponse {
  application_id: string;
  schedule_id: string;
  session_date: string;
  slot_time: string | null;
  check_in_status: CheckInStatus | null;
  device_id: string | null;
}

export interface PreferenceMatchReason {
  field: string;
  expected: number | null;
  actual: number | string | null;
  passed: boolean;
}

export interface PreferenceMatchResultResponse {
  application_id: string;
  composite_score: number | null;
  hard_pass: boolean | null;
  reasons: PreferenceMatchReason[];
  computed_at: string | null;
}

export type DecisionStage = "stage2_move_to_campus" | "stage3_call_for_interview";
export type DecisionOutcome = "approved" | "rejected" | "manual_override";

export interface AdminDecisionResponse {
  id: string;
  application_id: string;
  stage: DecisionStage;
  decision: DecisionOutcome;
  decided_by: string | null;
  decided_at: string | null;
  notes: string | null;
}

export interface AdminDecisionCreateInput {
  application_id: string;
  stage: DecisionStage;
  decision: DecisionOutcome;
  notes?: string | null;
}

export interface CandidateProfileResponse {
  application: Application;
  applicant: Applicant;
  profile_data: ProfileData | null;
  documents: UploadedDocument[];
  preference_match: PreferenceMatchResultResponse | null;
  admin_decisions: AdminDecisionResponse[];
  campus_session: CampusSessionResponse | null;
  test_a_session: TestASessionResponse | null;
  test_b_session: TestBSessionResponse | null;
}

export interface SignedUrlResponse {
  url: string;
  expires_at: string;
}

// --- Preferences ---

export interface PreferenceConfigResponse {
  id: string;
  program_id: string;
  field_name: string;
  is_hard_cutoff: boolean;
  cutoff_value: number | null;
  soft_weight: number;
  created_at: string | null;
}

export interface PreferenceConfigCreateInput {
  field_name: string;
  is_hard_cutoff?: boolean;
  cutoff_value?: number | null;
  soft_weight?: number;
}

export interface PreferenceMatchResultListItem {
  application: Application;
  match_result: PreferenceMatchResultResponse | null;
}

// --- Call for interview (batch outreach) ---

export interface CallForInterviewResult {
  application_id: string;
  success: boolean;
  detail?: string | null;
}

export interface CallForInterviewResponse {
  results: CallForInterviewResult[];
}

// --- Question bank / test blueprints ---

export type QuestionCategory =
  | "quant"
  | "verbal"
  | "logical_reasoning"
  | "english_grammar"
  | "reading_comp";

export interface QuestionBankResponse {
  id: string;
  program_id: string;
  name: string;
}

export type QuestionAnswerType = "single" | "multi";

export interface QuestionResponse {
  id: string;
  bank_id: string;
  category: QuestionCategory;
  question_text: string;
  options: string[] | null;
  answer_type: QuestionAnswerType;
  correct_answer: string | null;
  correct_answers: string[] | null;
  difficulty: string;
  created_at: string | null;
}

export interface QuestionCreateInput {
  category: QuestionCategory;
  question_text: string;
  options?: string[] | null;
  answer_type?: QuestionAnswerType;
  correct_answer?: string | null;
  correct_answers?: string[] | null;
  difficulty?: string;
}

export interface BulkUploadError {
  row: number;
  reason: string;
}

export interface BulkUploadResult {
  created_count: number;
  questions: QuestionResponse[];
  errors: BulkUploadError[];
}

export interface TestBlueprintResponse {
  id: string;
  program_id: string;
  category: QuestionCategory;
  question_count: number;
  duration_minutes: number;
  pass_threshold: number | null;
}

export interface TestBlueprintCreateInput {
  category: QuestionCategory;
  question_count: number;
  duration_minutes: number;
  pass_threshold?: number | null;
}

// --- Interview prompts (Test B) ---

export type PromptType = "image" | "video" | "question";

export interface PromptBankResponse {
  id: string;
  program_id: string;
  name: string;
}

export interface PromptResponse {
  id: string;
  bank_id: string;
  prompt_type: PromptType;
  media_url: string | null;
  prompt_text: string | null;
  category: string | null;
  created_at: string | null;
}

export interface PromptCreateInput {
  prompt_type: PromptType;
  media_url?: string | null;
  prompt_text?: string | null;
  category?: string | null;
}

// --- Campus schedules ---

export interface CampusScheduleResponse {
  id: string;
  program_id: string;
  session_date: string;
  capacity: number;
  booked_count: number;
}

export interface CampusScheduleCreateInput {
  session_date: string;
  capacity: number;
}
