"use client";

import { usePathname } from "next/navigation";
import { ProgressBar } from "@/components/ui/ProgressBar";

const STEPS = [
  "/onboarding/intent",
  "/onboarding/lifestyle",
  "/onboarding/colors",
  "/onboarding/body",
  "/scanner/opt-in",
  "/scanner/face",
  "/scanner/body",
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentStepIndex = STEPS.indexOf(pathname);
  const progress = currentStepIndex >= 0 ? ((currentStepIndex + 1) / STEPS.length) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="fixed top-0 left-0 w-full z-50">
        <ProgressBar progress={progress} />
      </div>
      <div className="flex-1 pb-24">
        {children}
      </div>
    </div>
  );
}
