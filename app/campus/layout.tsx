import type { ReactNode } from "react";
import { QueryProvider } from "@/components/admin/QueryProvider";
import { CampusSessionProvider } from "@/components/campus/CampusSessionProvider";

export default function CampusLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <CampusSessionProvider>{children}</CampusSessionProvider>
    </QueryProvider>
  );
}
