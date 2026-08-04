import type {
  AdminDecisionCreateInput,
  AdminDecisionResponse,
  AdminLoginInput,
  DecisionOutcome,
  AdminProfile,
  BulkUploadResult,
  CallForInterviewResponse,
  CampusScheduleCreateInput,
  CampusScheduleResponse,
  CampusSessionResponse,
  CandidateListItem,
  CandidateProfileResponse,
  FunnelResponse,
  ListCandidatesParams,
  PreferenceConfigCreateInput,
  PreferenceConfigResponse,
  PreferenceMatchResultListItem,
  PreferenceMatchResultResponse,
  PromptBankResponse,
  PromptCreateInput,
  PromptResponse,
  PromptType,
  QuestionBankResponse,
  QuestionCategory,
  QuestionCreateInput,
  QuestionResponse,
  SignedUrlResponse,
  TestBlueprintCreateInput,
  TestBlueprintResponse,
} from "./adminTypes";

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    return JSON.stringify(body?.detail ?? body);
  } catch {
    return response.statusText || `Request failed with status ${response.status}`;
  }
}

function buildQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/admin/login?next=${next}`;
    }
    throw new AdminApiError("Session expired — redirecting to login.", 401);
  }

  if (!response.ok) {
    throw new AdminApiError(await parseErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// --- Auth ---

export async function adminLogin(input: AdminLoginInput): Promise<{ admin: AdminProfile }> {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new AdminApiError(await parseErrorMessage(response), response.status);
  }
  return response.json();
}

export async function adminLogout(): Promise<void> {
  await fetch("/api/admin/logout", { method: "POST" });
}

export function getMe(): Promise<AdminProfile> {
  return adminFetch<AdminProfile>("/admin/me");
}

// --- Dashboard / funnel / candidates ---

export function getFunnel(programId: string): Promise<FunnelResponse> {
  return adminFetch<FunnelResponse>(`/programs/${programId}/funnel`);
}

export function listCandidates(params: ListCandidatesParams): Promise<CandidateListItem[]> {
  return adminFetch<CandidateListItem[]>(`/candidates${buildQuery(params)}`);
}

export function getCandidate(applicationId: string): Promise<CandidateProfileResponse> {
  return adminFetch<CandidateProfileResponse>(`/candidates/${applicationId}`);
}

export function getDocumentSignedUrl(
  documentId: string,
  expiresIn = 3600,
): Promise<SignedUrlResponse> {
  return adminFetch<SignedUrlResponse>(
    `/documents/${documentId}/signed-url${buildQuery({ expires_in: expiresIn })}`,
  );
}

export function getRecordingSignedUrl(
  applicationId: string,
  expiresIn = 3600,
): Promise<SignedUrlResponse> {
  return adminFetch<SignedUrlResponse>(
    `/applications/${applicationId}/recording-signed-url${buildQuery({ expires_in: expiresIn })}`,
  );
}

export function getProctoringSnapshotSignedUrl(
  applicationId: string,
  path: string,
  expiresIn = 3600,
): Promise<SignedUrlResponse> {
  return adminFetch<SignedUrlResponse>(
    `/applications/${applicationId}/proctoring-snapshot-signed-url${buildQuery({
      path,
      expires_in: expiresIn,
    })}`,
  );
}

// --- Preferences / matching ---

export function listPreferenceConfigs(programId: string): Promise<PreferenceConfigResponse[]> {
  return adminFetch<PreferenceConfigResponse[]>(`/programs/${programId}/preference-configs`);
}

export function createPreferenceConfig(
  programId: string,
  input: PreferenceConfigCreateInput,
): Promise<PreferenceConfigResponse> {
  return adminFetch<PreferenceConfigResponse>(`/programs/${programId}/preference-configs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Atomically replaces every PreferenceConfig row for the program (backend
 * deletes + recreates in one transaction and re-scores every existing
 * application). There is still no per-row PATCH — this bulk replace is the
 * only safe way to change weights without double-counting a field_name.
 */
export function replacePreferenceConfigs(
  programId: string,
  inputs: PreferenceConfigCreateInput[],
): Promise<PreferenceConfigResponse[]> {
  return adminFetch<PreferenceConfigResponse[]>(`/programs/${programId}/preference-configs`, {
    method: "PUT",
    body: JSON.stringify(inputs),
  });
}

export function computeMatch(applicationId: string): Promise<PreferenceMatchResultResponse> {
  return adminFetch<PreferenceMatchResultResponse>(
    `/applications/${applicationId}/compute-match`,
    { method: "POST" },
  );
}

export function listPreferenceMatchResults(params: {
  program_id?: string;
  hard_pass?: boolean;
  sort?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<PreferenceMatchResultListItem[]> {
  return adminFetch<PreferenceMatchResultListItem[]>(
    `/preference-match-results${buildQuery(params)}`,
  );
}

// --- Admin decisions / outreach ---

export function createAdminDecision(
  input: AdminDecisionCreateInput,
): Promise<AdminDecisionResponse> {
  return adminFetch<AdminDecisionResponse>("/admin-decisions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listAdminDecisions(params: {
  program_id?: string;
  decision?: DecisionOutcome;
}): Promise<AdminDecisionResponse[]> {
  return adminFetch<AdminDecisionResponse[]>(`/admin-decisions${buildQuery(params)}`);
}

export function callForInterview(applicationIds: string[]): Promise<CallForInterviewResponse> {
  return adminFetch<CallForInterviewResponse>("/call-for-interview", {
    method: "POST",
    body: JSON.stringify({ application_ids: applicationIds }),
  });
}

export function assignCampusSession(applicationId: string): Promise<CampusSessionResponse> {
  return adminFetch<CampusSessionResponse>(
    `/applications/${applicationId}/assign-campus-session`,
    { method: "POST" },
  );
}

export function campusCheckIn(
  applicationId: string,
  deviceId?: string,
): Promise<CampusSessionResponse> {
  return adminFetch<CampusSessionResponse>(`/applications/${applicationId}/campus-check-in`, {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId ?? null }),
  });
}

// --- Campus schedules ---

export function listCampusSchedules(programId: string): Promise<CampusScheduleResponse[]> {
  return adminFetch<CampusScheduleResponse[]>(`/programs/${programId}/campus-schedules`);
}

export function createCampusSchedule(
  programId: string,
  input: CampusScheduleCreateInput,
): Promise<CampusScheduleResponse> {
  return adminFetch<CampusScheduleResponse>(`/programs/${programId}/campus-schedules`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCampusSchedule(
  scheduleId: string,
  input: Partial<CampusScheduleCreateInput>,
): Promise<CampusScheduleResponse> {
  return adminFetch<CampusScheduleResponse>(`/campus-schedules/${scheduleId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCampusSchedule(scheduleId: string): Promise<void> {
  return adminFetch<void>(`/campus-schedules/${scheduleId}`, { method: "DELETE" });
}

// --- Question banks / questions / blueprints ---

export function listQuestionBanks(programId: string): Promise<QuestionBankResponse[]> {
  return adminFetch<QuestionBankResponse[]>(`/programs/${programId}/question-banks`);
}

export function createQuestionBank(
  programId: string,
  name: string,
): Promise<QuestionBankResponse> {
  return adminFetch<QuestionBankResponse>(`/programs/${programId}/question-banks`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateQuestionBank(
  bankId: string,
  name: string,
): Promise<QuestionBankResponse> {
  return adminFetch<QuestionBankResponse>(`/question-banks/${bankId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteQuestionBank(bankId: string): Promise<void> {
  return adminFetch<void>(`/question-banks/${bankId}`, { method: "DELETE" });
}

export function listQuestions(
  bankId: string,
  category?: QuestionCategory,
): Promise<QuestionResponse[]> {
  return adminFetch<QuestionResponse[]>(
    `/question-banks/${bankId}/questions${buildQuery({ category })}`,
  );
}

export function createQuestion(
  bankId: string,
  input: QuestionCreateInput,
): Promise<QuestionResponse> {
  return adminFetch<QuestionResponse>(`/question-banks/${bankId}/questions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateQuestion(
  questionId: string,
  input: Partial<QuestionCreateInput>,
): Promise<QuestionResponse> {
  return adminFetch<QuestionResponse>(`/questions/${questionId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteQuestion(questionId: string): Promise<void> {
  return adminFetch<void>(`/questions/${questionId}`, { method: "DELETE" });
}

export function bulkUploadQuestions(
  bankId: string,
  file: File,
  category?: QuestionCategory,
): Promise<BulkUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  // Default category for rows that don't carry their own `category` column
  // (e.g. a single-category template like the logical-reasoning workbook) —
  // rows with their own category value still take precedence server-side.
  if (category) formData.append("category", category);
  return adminFetch<BulkUploadResult>(`/question-banks/${bankId}/questions/bulk-upload`, {
    method: "POST",
    body: formData,
  });
}

export function listTestBlueprints(programId: string): Promise<TestBlueprintResponse[]> {
  return adminFetch<TestBlueprintResponse[]>(`/programs/${programId}/test-blueprints`);
}

export function createTestBlueprint(
  programId: string,
  input: TestBlueprintCreateInput,
): Promise<TestBlueprintResponse> {
  return adminFetch<TestBlueprintResponse>(`/programs/${programId}/test-blueprints`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTestBlueprint(
  blueprintId: string,
  input: Partial<TestBlueprintCreateInput>,
): Promise<TestBlueprintResponse> {
  return adminFetch<TestBlueprintResponse>(`/test-blueprints/${blueprintId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTestBlueprint(blueprintId: string): Promise<void> {
  return adminFetch<void>(`/test-blueprints/${blueprintId}`, { method: "DELETE" });
}

// --- Interview prompt banks / prompts ---

export function listPromptBanks(programId: string): Promise<PromptBankResponse[]> {
  return adminFetch<PromptBankResponse[]>(`/programs/${programId}/prompt-banks`);
}

export function createPromptBank(programId: string, name: string): Promise<PromptBankResponse> {
  return adminFetch<PromptBankResponse>(`/programs/${programId}/prompt-banks`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updatePromptBank(bankId: string, name: string): Promise<PromptBankResponse> {
  return adminFetch<PromptBankResponse>(`/prompt-banks/${bankId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deletePromptBank(bankId: string): Promise<void> {
  return adminFetch<void>(`/prompt-banks/${bankId}`, { method: "DELETE" });
}

export function listPrompts(bankId: string, promptType?: PromptType): Promise<PromptResponse[]> {
  return adminFetch<PromptResponse[]>(
    `/prompt-banks/${bankId}/prompts${buildQuery({ prompt_type: promptType })}`,
  );
}

export function createPrompt(bankId: string, input: PromptCreateInput): Promise<PromptResponse> {
  return adminFetch<PromptResponse>(`/prompt-banks/${bankId}/prompts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePrompt(
  promptId: string,
  input: Partial<PromptCreateInput>,
): Promise<PromptResponse> {
  return adminFetch<PromptResponse>(`/prompts/${promptId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePrompt(promptId: string): Promise<void> {
  return adminFetch<void>(`/prompts/${promptId}`, { method: "DELETE" });
}

// --- Group Discussion (moderator / host) ---

export interface GdParticipantAdmin {
  id: string;
  application_id: string;
  applicant_name: string | null;
  applicant_email: string | null;
  application_number: string | null;
  invite_status: string | null;
}

export interface GdSessionAdmin {
  id: string;
  program_id: string;
  label: string | null;
  target_size: number;
  scheduled_at: string | null;
  duration_minutes: number;
  status: string;
  track: string;
  topic: string | null;
  professor_email: string | null;
  professor_name: string | null;
  join_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  participants: GdParticipantAdmin[];
}

export interface GdStartResponse {
  session_id: string;
  status: string;
  started_at: string;
  ends_at: string;
  topic: string | null;
}

export interface GdEndResponse {
  session_id: string;
  status: string;
  ended_at: string;
}

export function listGdSessions(programId: string): Promise<GdSessionAdmin[]> {
  return adminFetch<GdSessionAdmin[]>(
    `/admin/group-discussion/sessions?program_id=${encodeURIComponent(programId)}`,
  );
}

export function getGdSession(sessionId: string): Promise<GdSessionAdmin> {
  return adminFetch<GdSessionAdmin>(`/admin/group-discussion/sessions/${sessionId}`);
}

export function startGdSession(sessionId: string): Promise<GdStartResponse> {
  return adminFetch<GdStartResponse>(`/admin/group-discussion/sessions/${sessionId}/start`, {
    method: "POST",
  });
}

export function endGdSession(sessionId: string): Promise<GdEndResponse> {
  return adminFetch<GdEndResponse>(`/admin/group-discussion/sessions/${sessionId}/end`, {
    method: "POST",
    body: "{}",
  });
}

export interface GdProgramSettings {
  program_id: string;
  min_group_size: number;
  max_group_size: number;
  default_duration_minutes: number;
}

export function getGdSettings(programId: string): Promise<GdProgramSettings> {
  return adminFetch<GdProgramSettings>(
    `/admin/group-discussion/settings?program_id=${encodeURIComponent(programId)}`,
  );
}

export function updateGdSettings(
  programId: string,
  input: Omit<GdProgramSettings, "program_id">,
): Promise<GdProgramSettings> {
  return adminFetch<GdProgramSettings>(
    `/admin/group-discussion/settings?program_id=${encodeURIComponent(programId)}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export interface GdEligibleCandidate {
  application_id: string;
  applicant_name: string | null;
  applicant_email: string | null;
  application_number: string | null;
  composite_score: number | null;
  gender: string | null;
  test_a_score: number | null;
  test_b_score: number | null;
}

export interface PackPreviewGroup {
  index: number;
  size: number;
  application_ids: string[];
  applicants: GdEligibleCandidate[];
}

export interface PackPreviewResponse {
  min_size: number;
  max_size: number;
  total_candidates: number;
  groups: PackPreviewGroup[];
}

export function previewGdPack(input: {
  program_id: string;
  application_ids: string[];
  min_size?: number;
  max_size?: number;
  seed?: number;
}): Promise<PackPreviewResponse> {
  return adminFetch<PackPreviewResponse>("/admin/group-discussion/pack/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface PackGroupSpec {
  label: string;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  professor_name?: string | null;
  professor_email?: string | null;
  topic?: string | null;
  application_ids: string[];
}

export function packGdSessions(input: {
  program_id: string;
  track: "online" | "manual";
  groups: PackGroupSpec[];
  auto_create_meetings?: boolean;
  move_status?: boolean;
}): Promise<{ sessions: GdSessionAdmin[] }> {
  return adminFetch<{ sessions: GdSessionAdmin[] }>("/admin/group-discussion/pack", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function moveGdParticipants(input: {
  application_ids: string[];
  to_session_id?: string | null;
  swap_with_application_id?: string | null;
}): Promise<{ sessions: GdSessionAdmin[] }> {
  return adminFetch<{ sessions: GdSessionAdmin[] }>("/admin/group-discussion/move-participants", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createGdMeeting(sessionId: string): Promise<GdSessionAdmin> {
  return adminFetch<GdSessionAdmin>(
    `/admin/group-discussion/sessions/${sessionId}/create-meeting`,
    { method: "POST" },
  );
}

export function updateGdSession(
  sessionId: string,
  input: {
    label?: string | null;
    scheduled_at?: string | null;
    duration_minutes?: number | null;
    professor_email?: string | null;
    professor_name?: string | null;
    topic?: string | null;
    join_opens_minutes_before?: number | null;
    track?: "online" | "manual" | null;
  },
): Promise<GdSessionAdmin> {
  return adminFetch<GdSessionAdmin>(`/admin/group-discussion/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
