import { API_URL } from "./config";
import { ApiError } from "./api";
import type {
  CandidateLoginResponse,
  CandidateStatus,
  Prompt,
  PromptBank,
  TestASessionStart,
  TestASubmitResult,
  TestBSessionResult,
} from "./candidateTypes";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    return JSON.stringify(body?.detail ?? body);
  } catch {
    return response.statusText || `Request failed with status ${response.status}`;
  }
}

export async function candidateLogin(
  tempUsername: string,
  tempPassword: string,
): Promise<CandidateLoginResponse> {
  const response = await fetch(`${API_URL}/credentials/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ temp_username: tempUsername, temp_password: tempPassword }),
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return response.json();
}

export async function getCandidateStatus(applicationId: string): Promise<CandidateStatus> {
  const response = await fetch(`${API_URL}/applications/${applicationId}/candidate-status`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return response.json();
}

export async function startTestASession(applicationId: string): Promise<TestASessionStart> {
  const response = await fetch(`${API_URL}/applications/${applicationId}/test-a-session/start`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return response.json();
}

export async function submitTestASession(
  applicationId: string,
  answers: Record<string, number>,
): Promise<TestASubmitResult> {
  const response = await fetch(`${API_URL}/applications/${applicationId}/test-a-session/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return response.json();
}

export async function listPromptBanks(programId: string): Promise<PromptBank[]> {
  const response = await fetch(`${API_URL}/programs/${programId}/prompt-banks`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return response.json();
}

export async function listPrompts(bankId: string): Promise<Prompt[]> {
  const response = await fetch(`${API_URL}/prompt-banks/${bankId}/prompts`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return response.json();
}

/**
 * There's no "assign me a prompt" endpoint — picks one at random from
 * whatever prompt banks/prompts exist for the program. Returns null if the
 * program has no prompts configured yet, which the Test B page surfaces as
 * an honest "interview not configured" state rather than a generic error.
 */
export async function pickRandomPrompt(programId: string): Promise<Prompt | null> {
  const banks = await listPromptBanks(programId);
  const allPrompts: Prompt[] = [];
  for (const bank of banks) {
    const prompts = await listPrompts(bank.id);
    allPrompts.push(...prompts);
  }
  if (allPrompts.length === 0) return null;
  return allPrompts[Math.floor(Math.random() * allPrompts.length)];
}

export async function getPrompt(promptId: string): Promise<Prompt> {
  const response = await fetch(`${API_URL}/prompts/${promptId}`, { cache: "no-store" });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return response.json();
}

export async function submitTestBRecording(
  applicationId: string,
  promptId: string,
  file: Blob,
  fileName: string,
): Promise<TestBSessionResult> {
  const formData = new FormData();
  formData.append("prompt_id", promptId);
  formData.append("file", file, fileName);

  const response = await fetch(`${API_URL}/applications/${applicationId}/test-b-recording`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return response.json();
}

export async function campusCheckIn(applicationId: string, deviceId?: string): Promise<void> {
  const response = await fetch(`${API_URL}/applications/${applicationId}/campus-check-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId ?? null }),
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
}

export { ApiError };
