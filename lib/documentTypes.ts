import type { DocType } from "./types";

export interface FixedDocConfig {
  docType: DocType;
  label: string;
  required: boolean;
}

export const FIXED_DOCUMENT_SLOTS: FixedDocConfig[] = [
  { docType: "10th_marksheet", label: "10th Marksheet", required: true },
  { docType: "12th_marksheet", label: "12th Marksheet", required: true },
  { docType: "ug_marksheet", label: "UG Marksheet", required: true },
  { docType: "pg_marksheet", label: "PG Marksheet", required: false },
];

export const CERTIFICATIONS_DOC_TYPE: DocType = "certifications";

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  resume: "Resume",
  "10th_marksheet": "10th Marksheet",
  "12th_marksheet": "12th Marksheet",
  ug_marksheet: "UG Marksheet",
  pg_marksheet: "PG Marksheet",
  certifications: "Certification",
};

export const REVIEW_SECTION_TITLES: Partial<Record<DocType, string>> = {
  "10th_marksheet": "10th Standard",
  "12th_marksheet": "12th Standard",
  ug_marksheet: "Undergraduate",
  pg_marksheet: "Postgraduate",
};
