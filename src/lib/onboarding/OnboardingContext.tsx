"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { OnboardingData, OnboardingConversationData, defaultOnboardingData } from "@/types/onboarding";

interface OnboardingContextProps {
  data: OnboardingData;
  updateData: <K extends keyof OnboardingData>(step: K, values: Partial<OnboardingData[K]> | OnboardingData[K]) => void;
  updateConversation: (values: Partial<OnboardingConversationData>) => void;
}

const OnboardingContext = createContext<OnboardingContextProps | undefined>(undefined);

function normalize(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "") : "";
}

function safeSessionStorageGet(key: string) {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures on browsers with restricted storage access.
  }
}

function mergeOnboardingData(parsed: Partial<OnboardingData>, queryOrgSlug: string): OnboardingData {
  return {
    ...defaultOnboardingData,
    ...parsed,
    intent: {
      ...defaultOnboardingData.intent,
      ...(parsed.intent || {}),
    },
    lifestyle: {
      ...defaultOnboardingData.lifestyle,
      ...(parsed.lifestyle || {}),
    },
    colors: {
      ...defaultOnboardingData.colors,
      ...(parsed.colors || {}),
    },
    body: {
      ...defaultOnboardingData.body,
      ...(parsed.body || {}),
    },
    scanner: {
      ...defaultOnboardingData.scanner,
      ...(parsed.scanner || {}),
    },
    conversation: {
      ...defaultOnboardingData.conversation,
      ...(parsed.conversation || {}),
    },
    tenant: {
      ...defaultOnboardingData.tenant,
      ...(parsed.tenant || {}),
      orgSlug: queryOrgSlug || parsed.tenant?.orgSlug,
    },
  };
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = safeSessionStorageGet("venus_onboarding");
    const queryOrgSlug = typeof window !== "undefined" ? normalize(new URLSearchParams(window.location.search).get("org")) : "";

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<OnboardingData>;
        setData(mergeOnboardingData(parsed, queryOrgSlug));
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
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      safeSessionStorageSet("venus_onboarding", JSON.stringify(data));
    }
  }, [data, isLoaded]);

  const updateData = <K extends keyof OnboardingData>(step: K, values: Partial<OnboardingData[K]> | OnboardingData[K]) => {
    const isMergeable = (input: unknown): input is Record<string, unknown> => !!input && typeof input === "object" && !Array.isArray(input);

    setData((prev) => ({
      ...prev,
      [step]: (() => {
        const current = prev[step] as unknown;
        if (isMergeable(current) && isMergeable(values)) {
          return { ...(current as Record<string, unknown>), ...(values as Record<string, unknown>) } as OnboardingData[K];
        }
        return values as OnboardingData[K];
      })(),
    }));
  };

  const updateConversation = (values: Partial<OnboardingConversationData>) => {
    setData((prev) => ({
      ...prev,
      conversation: {
        ...defaultOnboardingData.conversation,
        ...(prev.conversation || {}),
        ...values,
      },
    }));
  };

  // if (!isLoaded) return null; foi removido para permitir SSR livre e hidratar na ponta.

  return (
    <OnboardingContext.Provider value={{ data, updateData, updateConversation }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error("useOnboarding must be used within OnboardingProvider");
  return context;
}
