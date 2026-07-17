/**
 * The backend issues no candidate token — POST /credentials/login just
 * confirms the temp username/password and hands back an application_id
 * (see app/credentials/router.py). Every test-taking endpoint after that is
 * keyed purely on application_id in the URL, with no auth check at all.
 *
 * This is a thin client-side convenience layer on top of that reality: it
 * remembers the logged-in application_id in sessionStorage (tab-scoped, gone
 * on close) purely so the candidate doesn't have to re-type credentials on
 * every page nav within the /campus portal. It is NOT a security boundary —
 * anyone with the application_id could already call the backend directly.
 */

const STORAGE_KEY = "campus_session_v1";

export interface CandidateSession {
  applicationId: string;
  programId: string;
}

export function loadCandidateSession(): CandidateSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.applicationId === "string" && typeof parsed?.programId === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCandidateSession(session: CandidateSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearCandidateSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Test A's own progress (the question set + shuffle it was given) is cached
 * here too. The backend's start endpoint isn't safely re-callable once a
 * session is in progress — calling it again returns 409 rather than the
 * existing questions (app/test_engine/router.py) — so a page refresh must be
 * able to rehydrate from this cache instead of starting over.
 */
const TEST_A_CACHE_KEY = "campus_test_a_v1";

export interface TestASessionCache {
  applicationId: string;
  questions: { question_id: string; question_text: string; options: string[] }[];
  expiresAt: string;
  answers: Record<string, number>;
}

export function loadTestASessionCache(applicationId: string): TestASessionCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TEST_A_CACHE_KEY);
    if (!raw) return null;
    const parsed: TestASessionCache = JSON.parse(raw);
    if (parsed.applicationId !== applicationId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTestASessionCache(cache: TestASessionCache): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TEST_A_CACHE_KEY, JSON.stringify(cache));
}

export function clearTestASessionCache(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TEST_A_CACHE_KEY);
}

/**
 * Test B needs a prompt_id to submit against, but the backend has no "assign
 * me a prompt" step — the candidate app picks one client-side from the
 * program's prompt bank. Cached so a refresh doesn't reshuffle to a
 * different prompt mid-recording.
 */
const TEST_B_PROMPT_KEY = "campus_test_b_prompt_v1";

export interface TestBPromptCache {
  applicationId: string;
  promptId: string;
}

export function loadTestBPromptCache(applicationId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TEST_B_PROMPT_KEY);
    if (!raw) return null;
    const parsed: TestBPromptCache = JSON.parse(raw);
    return parsed.applicationId === applicationId ? parsed.promptId : null;
  } catch {
    return null;
  }
}

export function saveTestBPromptCache(applicationId: string, promptId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    TEST_B_PROMPT_KEY,
    JSON.stringify({ applicationId, promptId }),
  );
}
