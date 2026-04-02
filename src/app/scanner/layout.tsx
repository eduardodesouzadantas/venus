"use client";

import OnboardingLayout from "@/app/onboarding/layout";

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  // Compartilhamos o layout do onboarding (ProgressBar e constraints flex)
  return <OnboardingLayout>{children}</OnboardingLayout>;
}
