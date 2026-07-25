import type { DocType, UploadedDocument } from "./types";

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

// 10th/12th have a school name that's genuinely distinct from the
// affiliating board (CBSE vs. "XYZ Public School"), so both are worth
// showing. UG/PG degree certificates usually only name one institution — the
// awarding university — so a separate "college name" field is redundant
// with Board / University and was dropped there.
const SCHOOL_MARKSHEET_FIELDS: ReviewFieldSchemaEntry[] = [
  { key: "name_on_certificate", label: "Name on Certificate" },
  { key: "institution_name", label: "School / College Name" },
  { key: "board_or_university", label: "Board / University" },
  { key: "percentage", label: "Percentage" },
  { key: "cgpa", label: "CGPA" },
  { key: "year", label: "Year" },
];

const DEGREE_MARKSHEET_FIELDS: ReviewFieldSchemaEntry[] = [
  { key: "name_on_certificate", label: "Name on Certificate" },
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
  "10th_marksheet": SCHOOL_MARKSHEET_FIELDS,
  "12th_marksheet": SCHOOL_MARKSHEET_FIELDS,
  ug_marksheet: DEGREE_MARKSHEET_FIELDS,
  pg_marksheet: DEGREE_MARKSHEET_FIELDS,
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

const REPEATABLE_DOC_TYPES = new Set<DocType>(["certifications", "experience_certificate"]);

/**
 * The backend now replaces a singleton doc_type's row on re-upload (see
 * upload_document in app/applications/router.py), but applications created
 * before that fix — or any other historical row insertion bug — can still
 * have more than one row for a "one slot" doc_type like address_proof.
 * Showing every one of them as a separate Review/Confirm section is
 * confusing (a populated one plus a blank one), so this keeps only the most
 * recently created row per non-repeatable doc_type.
 */
export function dedupeSingletonDocuments(documents: UploadedDocument[]): UploadedDocument[] {
  const latestByType = new Map<string, UploadedDocument>();
  const repeatable: UploadedDocument[] = [];
  for (const doc of documents) {
    if (REPEATABLE_DOC_TYPES.has(doc.doc_type)) {
      repeatable.push(doc);
      continue;
    }
    const existing = latestByType.get(doc.doc_type);
    if (!existing || (doc.created_at ?? "") >= (existing.created_at ?? "")) {
      latestByType.set(doc.doc_type, doc);
    }
  }
  return [...latestByType.values(), ...repeatable];
}
