export type DocType =
  | "resume"
  | "10th_marksheet"
  | "12th_marksheet"
  | "ug_marksheet"
  | "pg_marksheet"
  | "certifications";

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "moved_to_campus"
  | "testing_complete"
  | "called_for_interview"
  | "offered"
  | "rejected";

export interface Applicant {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
}

export interface ProfileData {
  application_id: string;
  data: Record<string, unknown>;
  form_template_version: string | null;
  updated_at: string | null;
}

export interface Application {
  id: string;
  tenant_id: string;
  program_id: string;
  applicant_id: string;
  status: ApplicationStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApplicationSubmissionResponse {
  application: Application;
  applicant: Applicant;
  profile_data: ProfileData;
}

export interface ParsedMarksheetFields {
  board_or_university: string | null;
  percentage: number | null;
  cgpa: number | null;
  year: number | null;
}

export interface OcrResult {
  raw_text: string;
  parsed: ParsedMarksheetFields;
  confidence: number;
}

export interface UploadedDocument {
  id: string;
  application_id: string;
  doc_type: DocType;
  file_url: string;
  ocr_result: OcrResult | null;
  ocr_confidence: number | null;
  created_at: string | null;
}

export interface ApplicationProfileResponse {
  application: Application;
  applicant: Applicant;
  profile_data: ProfileData | null;
  documents: UploadedDocument[];
}
