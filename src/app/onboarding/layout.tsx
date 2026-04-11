"use client";

import { usePathname } from "next/navigation";
import { ProgressBar } from "@/components/ui/ProgressBar";

const STEPS = [
  "/scanner/opt-in",
  "/scanner/face",
  "/scanner/body",
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentStepIndex = STEPS.indexOf(pathname);
  const progress = currentStepIndex >= 0 ? ((currentStepIndex + 1) / STEPS.length) * 100 : 0;
  const showProgress = currentStepIndex >= 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a]">
      {showProgress ? (
        <div className="fixed left-0 top-0 z-50 w-full">
          <ProgressBar progress={progress} />
        </div>
      ) : null}
      <div className="relative z-10 flex-1 pb-24">{children}</div>
    </div>
  );
}
