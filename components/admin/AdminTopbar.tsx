import type { ReactNode } from "react";

export function AdminTopbar({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="font-serif text-[24px] font-bold text-text">{title}</h1>
        {subtitle && <p className="text-text-muted text-[13px] mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2.5 shrink-0">{children}</div>}
    </div>
  );
}
