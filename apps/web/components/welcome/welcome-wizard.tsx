"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  WELCOME_STEPS,
  type WelcomeState,
  type WelcomeStepId,
} from "@/lib/welcome-types";
import { WelcomeStepBrand } from "./welcome-step-brand";
import { WelcomeStepLibrary } from "./welcome-step-library";
import { WelcomeStepPlaybook } from "./welcome-step-playbook";
import { WelcomeStepBooking } from "./welcome-step-booking";
import { WelcomeStepFirstClient } from "./welcome-step-first-client";

// The host component for the welcome wizard. Holds the current step in local
// state, renders the appropriate child step, and exposes Next/Back/Skip
// navigation that the children call into.
//
// On final completion we router.push('/admin?welcome=done') — that drops us
// onto the dashboard with a celebratory banner (wired up by /admin/page.tsx).
export function WelcomeWizard({
  initialStep,
  state,
}: {
  initialStep: WelcomeStepId;
  state: WelcomeState;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WelcomeStepId>(initialStep);

  // Mutable local state — the brand step needs to feed values into the booking
  // step (slug suggestions etc) without us round-tripping a server refresh.
  const [localState, setLocalState] = useState<WelcomeState>(state);

  const goToStep = (n: number) => {
    if (n < 1) return;
    if (n > WELCOME_STEPS.length) {
      // We're past the last step — finish.
      router.push("/admin?welcome=done");
      router.refresh();
      return;
    }
    setCurrentStep(n as WelcomeStepId);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const next = () => goToStep(currentStep + 1);
  const back = () => goToStep(currentStep - 1);
  const skip = () => goToStep(currentStep + 1);

  const updateState = (patch: Partial<WelcomeState>) =>
    setLocalState((s) => ({ ...s, ...patch }));

  return (
    <div className="space-y-6">
      <ProgressBar current={currentStep} />

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
        {currentStep === 1 && (
          <WelcomeStepBrand
            state={localState}
            onChange={updateState}
            onNext={next}
            onSkip={skip}
            onBack={null}
          />
        )}
        {currentStep === 2 && (
          <WelcomeStepLibrary
            state={localState}
            onChange={updateState}
            onNext={next}
            onSkip={skip}
            onBack={back}
          />
        )}
        {currentStep === 3 && (
          <WelcomeStepPlaybook
            state={localState}
            onChange={updateState}
            onNext={next}
            onSkip={skip}
            onBack={back}
          />
        )}
        {currentStep === 4 && (
          <WelcomeStepBooking
            state={localState}
            onChange={updateState}
            onNext={next}
            onSkip={skip}
            onBack={back}
          />
        )}
        {currentStep === 5 && (
          <WelcomeStepFirstClient
            state={localState}
            onChange={updateState}
            onNext={next}
            onSkip={skip}
            onBack={back}
          />
        )}
      </div>
    </div>
  );
}

function ProgressBar({ current }: { current: WelcomeStepId }) {
  const total = WELCOME_STEPS.length;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
          Step {current} of {total}
        </span>
        <span className="text-xs text-stone-600">
          {WELCOME_STEPS[current - 1]?.label}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {WELCOME_STEPS.map((s) => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition ${
              s.id <= current
                ? "bg-gradient-to-r from-rose-400 to-amber-500"
                : "bg-stone-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
