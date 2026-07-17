import type { ReactNode } from "react";
import { AdminAuthProvider } from "@/components/admin/AdminAuthProvider";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { QueryProvider } from "@/components/admin/QueryProvider";

export default function AdminPortalLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AdminAuthProvider>
        <div className="flex min-h-screen bg-bg">
          <AdminSidebar />
          <main className="flex-1 min-w-0 px-8 py-7">{children}</main>
        </div>
      </AdminAuthProvider>
    </QueryProvider>
  );
}
