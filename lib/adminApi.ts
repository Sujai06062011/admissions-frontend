import type {
  AdminDecisionCreateInput,
  AdminDecisionResponse,
  AdminLoginInput,
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

export function bulkUploadQuestions(bankId: string, file: File): Promise<BulkUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
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
