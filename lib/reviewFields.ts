import { REVIEW_FIELD_SCHEMAS } from "./documentTypes";
import type { UploadedDocument } from "./types";

export type ReviewedFields = Record<string, string>;
export type ReviewedData = Record<string, ReviewedFields>;

/** Shared by ReviewStep (initial edit pass) and ConfirmStep (final edit pass
 * + mismatch detection) so both always read a document's raw OCR values the
 * same way. */
export function ocrFieldsFor(doc: UploadedDocument): ReviewedFields {
  const schema = REVIEW_FIELD_SCHEMAS[doc.doc_type] ?? [];
  const fields: ReviewedFields = {};
  for (const { key } of schema) {
    const value = doc.ocr_result?.parsed?.[key];
    fields[key] = value != null ? String(value) : "";
  }
  return fields;
}
