"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { OnboardingData, defaultOnboardingData } from "@/types/onboarding";

interface OnboardingContextProps {
  data: OnboardingData;
  updateData: <K extends keyof OnboardingData>(step: K, values: Partial<OnboardingData[K]>) => void;
}

const OnboardingContext = createContext<OnboardingContextProps | undefined>(undefined);

function normalize(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "") : "";
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("venus_onboarding");
    const queryOrgSlug = typeof window !== "undefined" ? normalize(new URLSearchParams(window.location.search).get("org")) : "";

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as OnboardingData;
        setData({
          ...parsed,
          tenant: {
            ...parsed.tenant,
            orgSlug: queryOrgSlug || parsed.tenant?.orgSlug,
          },
        });
      } catch (e) {
        console.error("Failed to parse onboarding data", e);
        if (queryOrgSlug) {
          setData((current) => ({
            ...current,
            tenant: {
              ...current.tenant,
              orgSlug: queryOrgSlug,
            },
          }));
        }
      }
    } else if (queryOrgSlug) {
      setData((current) => ({
        ...current,
        tenant: {
          ...current.tenant,
          orgSlug: queryOrgSlug,
        },
      }));
    }

    if (!saved && !queryOrgSlug) {
      setData(defaultOnboardingData);
    } else if (saved && !queryOrgSlug) {
      // Keep the persisted tenant context when the URL no longer carries ?org=...
      try {
        const parsed = JSON.parse(saved) as OnboardingData;
        setData(parsed);
      } catch {
        // ignore, handled above
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
