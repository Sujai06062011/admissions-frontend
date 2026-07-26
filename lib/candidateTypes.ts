export interface CandidateLoginResponse {
  application_id: string;
  login_status: string | null;
}

export interface CandidateTestAStatus {
  submitted: boolean;
  score: number | null;
  in_progress: boolean;
  expires_at: string | null;
}

export interface CandidateTestBStatus {
  submitted: boolean;
  recorded_at: string | null;
}

export interface CandidateStatus {
  application_id: string;
  program_id: string;
  status: string;
  campus_session_assigned: boolean;
  test_a: CandidateTestAStatus;
  test_b: CandidateTestBStatus;
}

export type TestAAnswerType = "single" | "multi";

export interface TestAQuestion {
  question_id: string;
  question_text: string;
  options: string[];
  answer_type: TestAAnswerType;
}

export interface TestASessionStart {
  application_id: string;
  questions: TestAQuestion[];
  duration_minutes: number;
  started_at: string;
  expires_at: string;
}

export interface TestASubmitResult {
  application_id: string;
  score: number;
  submitted_at: string;
}

export type PromptType = "image" | "video" | "question";

export interface PromptBank {
  id: string;
  program_id: string;
  name: string;
}

export interface Prompt {
  id: string;
  bank_id: string;
  prompt_type: PromptType;
  media_url: string | null;
  prompt_text: string | null;
  category: string | null;
  created_at: string | null;
}

export interface RubricScore {
  grammar?: number | null;
  fluency?: number | null;
  reasoning?: number | null;
  coherence?: number | null;
}

export interface TestBSessionResult {
  application_id: string;
  prompt_id: string | null;
  recording_url: string | null;
  transcript: string | null;
  rubric_score: RubricScore | null;
  rationale: string | null;
  recorded_at: string | null;
}
