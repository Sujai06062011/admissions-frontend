export interface FunnelStage {
  key: string;
  label: string;
  value: number;
}

const BAR_COLORS = ["bg-ink-dark", "bg-ink", "bg-ink-light", "bg-forest", "bg-forest", "bg-gold"];

export function FunnelBars({
  stages,
  showDropOff = true,
}: {
  stages: FunnelStage[];
  showDropOff?: boolean;
}) {
  const total = stages[0]?.value || 0;

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const pct = total === 0 ? 0 : Math.round((stage.value / total) * 100);
        const prevValue = i === 0 ? null : stages[i - 1].value;
        const dropOff =
          !showDropOff || prevValue == null || prevValue === 0
            ? null
            : Math.round(((prevValue - stage.value) / prevValue) * 100);

        return (
          <div key={stage.key} className="flex items-center gap-3">
            <div className="w-[108px] text-[12.5px] text-text-muted shrink-0">{stage.label}</div>
            <div className="flex-1 min-w-0">
              <div className="h-8 rounded-md bg-border/40 relative overflow-hidden">
                <div
                  className={`h-full rounded-md flex items-center px-3 text-white text-[12.5px] font-semibold whitespace-nowrap ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  style={{ width: `${Math.max(pct, total === 0 ? 0 : 6)}%` }}
                >
                  {stage.value}
                  <span className="ml-1.5 opacity-70 font-normal">{pct}%</span>
                </div>
              </div>
            </div>
            <div className="w-[100px] text-[11.5px] text-brick shrink-0 text-right">
              {dropOff != null && dropOff > 0 ? `↓ ${dropOff}% drop-off` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StageBreakdownList({ stages }: { stages: FunnelStage[] }) {
  const total = stages[0]?.value || 0;

  return (
    <div className="space-y-3">
      {stages.map((stage) => {
        const pct = total === 0 ? 0 : Math.round((stage.value / total) * 100);
        return (
          <div key={stage.key}>
            <div className="flex items-center justify-between text-[12.5px] mb-1">
              <span className="flex items-center gap-2 text-text">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-light" />
                {stage.label}
              </span>
              <span className="text-text-muted">
                {stage.value} <span className="text-text-muted/70">{pct}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-border/60 overflow-hidden">
              <div className="h-full rounded-full bg-ink-light" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
