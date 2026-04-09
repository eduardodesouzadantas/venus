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
    <div className="flex flex-col min-h-screen bg-[#04070A]">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(224,228,235,0.08),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(212,175,55,0.04),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_30%)]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>
      <div className="fixed top-0 left-0 w-full z-50">
        <ProgressBar progress={progress} />
      </div>
      <div className="flex-1 pb-24 relative z-10">
        {children}
      </div>
    </div>
  );
}
