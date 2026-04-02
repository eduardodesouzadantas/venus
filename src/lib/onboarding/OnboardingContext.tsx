"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { OnboardingData, defaultOnboardingData } from "@/types/onboarding";

interface OnboardingContextProps {
  data: OnboardingData;
  updateData: <K extends keyof OnboardingData>(step: K, values: Partial<OnboardingData[K]>) => void;
}

const OnboardingContext = createContext<OnboardingContextProps | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("venus_onboarding");
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse onboarding data", e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      sessionStorage.setItem("venus_onboarding", JSON.stringify(data));
    }
  }, [data, isLoaded]);

  const updateData = <K extends keyof OnboardingData>(step: K, values: Partial<OnboardingData[K]>) => {
    setData((prev) => ({
      ...prev,
      [step]: { ...prev[step], ...values },
    }));
  };

  // if (!isLoaded) return null; foi removido para permitir SSR livre e hidratar na ponta.

  return (
    <OnboardingContext.Provider value={{ data, updateData }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error("useOnboarding must be used within OnboardingProvider");
  return context;
}
