import type { DocType } from "./types";

export interface FixedDocConfig {
  docType: DocType;
  label: string;
  required: boolean;
}

export const FIXED_DOCUMENT_SLOTS: FixedDocConfig[] = [
  { docType: "address_proof", label: "Address Proof", required: true },
  { docType: "id_proof", label: "ID Proof", required: true },
  { docType: "10th_marksheet", label: "10th Marksheet", required: true },
  { docType: "12th_marksheet", label: "12th Marksheet", required: true },
  { docType: "ug_marksheet", label: "UG Marksheet", required: true },
  { docType: "pg_marksheet", label: "PG Marksheet", required: false },
];

export const CERTIFICATIONS_DOC_TYPE: DocType = "certifications";
export const EXPERIENCE_CERTIFICATE_DOC_TYPE: DocType = "experience_certificate";

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  resume: "Resume",
  "10th_marksheet": "10th Marksheet",
  "12th_marksheet": "12th Marksheet",
  ug_marksheet: "UG Marksheet",
  pg_marksheet: "PG Marksheet",
  certifications: "Certification",
  address_proof: "Address Proof",
  id_proof: "ID Proof",
  experience_certificate: "Experience Certificate",
};

export const REVIEW_SECTION_TITLES: Partial<Record<DocType, string>> = {
  address_proof: "Address Details",
  id_proof: "Identity Details",
  "10th_marksheet": "10th Standard",
  "12th_marksheet": "12th Standard",
  ug_marksheet: "Undergraduate",
  pg_marksheet: "Postgraduate",
};

export interface ReviewFieldSchemaEntry {
  key: string;
  label: string;
}

const MARKSHEET_FIELDS: ReviewFieldSchemaEntry[] = [
  { key: "board_or_university", label: "Board / University" },
  { key: "percentage", label: "Percentage" },
  { key: "cgpa", label: "CGPA" },
  { key: "year", label: "Year" },
];

const ADDRESS_FIELDS: ReviewFieldSchemaEntry[] = [
  { key: "address_line1", label: "Address Line 1" },
  { key: "address_line2", label: "Address Line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
];

const ID_FIELDS: ReviewFieldSchemaEntry[] = [
  { key: "id_type", label: "ID Type" },
  { key: "id_number", label: "ID Number" },
];

export const REVIEW_FIELD_SCHEMAS: Partial<Record<DocType, ReviewFieldSchemaEntry[]>> = {
  address_proof: ADDRESS_FIELDS,
  id_proof: ID_FIELDS,
  "10th_marksheet": MARKSHEET_FIELDS,
  "12th_marksheet": MARKSHEET_FIELDS,
  ug_marksheet: MARKSHEET_FIELDS,
  pg_marksheet: MARKSHEET_FIELDS,
};

// Fixed display order for the Review screen, independent of upload order.
export const REVIEW_SECTION_ORDER: DocType[] = [
  "address_proof",
  "id_proof",
  "10th_marksheet",
  "12th_marksheet",
  "ug_marksheet",
  "pg_marksheet",
];
