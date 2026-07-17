export type StepStatus = "done" | "active" | "upcoming";

export interface StepperStep {
  label: string;
  status: StepStatus;
}

function dotClasses(status: StepStatus) {
  switch (status) {
    case "done":
      return "bg-forest text-white";
    case "active":
      return "bg-ink text-white";
    case "upcoming":
      return "bg-[#E4EDEE] text-text-muted";
  }
}

export function Stepper({ steps }: { steps: StepperStep[] }) {
  return (
    <div className="flex items-center mb-11">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${dotClasses(step.status)}`}
            >
              {step.status === "done" ? "✓" : index + 1}
            </div>
            <div
              className={`text-[12.5px] font-semibold whitespace-nowrap ${step.status === "active" ? "text-ink" : "text-text-muted"}`}
            >
              {step.label}
            </div>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-[1.5px] mx-2.5 ${step.status === "done" ? "bg-forest" : "bg-border"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
