import type { ReactNode } from "react";

export interface StatCardProps {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
  caption?: string;
  captionColor?: string;
}

export function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  caption,
  captionColor = "text-text-muted",
}: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl px-5 py-4">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconBg} ${iconColor}`}
      >
        {icon}
      </div>
      <div className="text-[26px] font-bold font-serif text-text leading-none">{value}</div>
      <div className="text-[13px] text-text-muted mt-1.5">{label}</div>
      {caption && <div className={`text-[11.5px] font-semibold mt-1 ${captionColor}`}>{caption}</div>}
    </div>
  );
}
