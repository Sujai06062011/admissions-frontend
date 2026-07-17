export interface StageTabDef {
  key: string;
  label: string;
  count: number;
}

export function StageTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: StageTabDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-full p-1 flex-wrap">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              isActive ? "bg-ink text-white" : "text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
            <span
              className={`text-[10.5px] rounded-full px-1.5 leading-[16px] ${
                isActive ? "bg-white/20 text-white" : "bg-border text-text-muted"
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
