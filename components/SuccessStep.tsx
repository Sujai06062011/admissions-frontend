import { BrandHeader } from "./BrandHeader";
import { Stepper } from "./Stepper";

export function SuccessStep() {
  return (
    <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
      <BrandHeader />
      <Stepper
        steps={[
          { label: "Basic Info", status: "done" },
          { label: "Review", status: "done" },
          { label: "Submit", status: "done" },
        ]}
      />
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-forest-soft text-forest flex items-center justify-center text-3xl mx-auto mb-6">
          ✓
        </div>
        <h2 className="font-serif text-xl font-semibold mb-2">
          Application submitted
        </h2>
        <p className="text-[13.5px] text-text-muted max-w-[380px] mx-auto">
          Thank you — we&apos;ve received your application. We&apos;ll be in
          touch by email with the next steps.
        </p>
      </div>
    </div>
  );
}
