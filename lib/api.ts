import { API_URL, PROGRAM_ID, TENANT_ID } from "./config";
import type {
  ApplicationProfileResponse,
  ApplicationSubmissionResponse,
  DocType,
  ProfileData,
  UploadedDocument,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
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

export interface CreateApplicationInput {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<ApplicationSubmissionResponse> {
  const response = await fetch(`${API_URL}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      program_id: PROGRAM_ID,
      applicant: {
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
      },
      profile: { data: { dob: input.dob, gender: input.gender } },
    }),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response.json();
}

export async function uploadDocument(
  applicationId: string,
  docType: DocType,
  file: File,
): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("doc_type", docType);
  formData.append("file", file);

  const response = await fetch(
    `${API_URL}/applications/${applicationId}/documents`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response.json();
}

export async function updateApplicationProfile(
  applicationId: string,
  data: Record<string, unknown>,
): Promise<ProfileData> {
  const response = await fetch(`${API_URL}/applications/${applicationId}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response.json();
}

export async function getApplication(
  applicationId: string,
): Promise<ApplicationProfileResponse> {
  const response = await fetch(`${API_URL}/applications/${applicationId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response.json();
}
