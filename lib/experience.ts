import type { DocSlotStatus } from "@/components/DocumentUploadCard";

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  from: string;
  to: string;
  fileStatus: DocSlotStatus;
  fileName?: string;
  documentId?: string;
  fileErrorMessage?: string;
}

export function createExperienceEntry(): ExperienceEntry {
  return {
    id: crypto.randomUUID(),
    company: "",
    role: "",
    from: "",
    to: "",
    fileStatus: "idle",
  };
}

export function isMeaningfulExperienceEntry(entry: ExperienceEntry): boolean {
  return (
    entry.company.trim() !== "" ||
    entry.role.trim() !== "" ||
    entry.from !== "" ||
    entry.to !== "" ||
    entry.documentId != null
  );
}
