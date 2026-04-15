"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { OnboardingData, OnboardingConversationData, defaultOnboardingData } from "@/types/onboarding";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  fetchUserJourneyState,
  resolveUserJourneyState,
  saveUserJourneyState,
  type UserJourneyState,
} from "@/lib/user/journey";

interface OnboardingContextProps {
  data: OnboardingData;
  updateData: <K extends keyof OnboardingData>(step: K, values: Partial<OnboardingData[K]> | OnboardingData[K]) => void;
  updateConversation: (values: Partial<OnboardingConversationData>) => void;
  journey: UserJourneyState | null;
  isJourneyLoaded: boolean;
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

const ONBOARDING_STORAGE_PREFIX = "venus_onboarding";

function buildStorageKey(userId: string | null | undefined, orgSlug: string | null | undefined) {
  return [ONBOARDING_STORAGE_PREFIX, userId || "guest", orgSlug || "global"].join(":");
}

function resolveJourneyRouteState(pathname: string) {
  switch (pathname) {
    case "/onboarding/chat":
      return "onboarding_chat";
    case "/scanner/opt-in":
      return "scanner_opt_in";
    case "/scanner/face":
      return "scanner_face";
    case "/scanner/body":
      return "scanner_body";
    case "/processing":
      return "processing";
    case "/result":
      return "result";
    default:
      return "unknown";
  }
}

function hasMeaningfulJourneyData(data: OnboardingData) {
  return Boolean(
    data.intent.styleDirection ||
      data.intent.imageGoal ||
      data.intent.mainPain ||
      data.lifestyle.environments.length ||
      data.lifestyle.purchaseDna ||
      data.lifestyle.purchaseBehavior ||
      data.colors.favoriteColors.length ||
      data.colors.avoidColors.length ||
      data.colors.colorSeason ||
      data.body.fit ||
      data.body.faceLines ||
      data.scanner.facePhoto ||
      data.scanner.bodyPhoto ||
      data.scanner.skipped ||
      data.conversation.styleDirection ||
      data.conversation.imageGoal
  );
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [journey, setJourney] = useState<UserJourneyState | null>(null);
  const [isJourneyLoaded, setIsJourneyLoaded] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryOrgSlug = useMemo(() => normalize(searchParams.get("org")), [searchParams]);
  const routeState = useMemo(() => resolveJourneyRouteState(pathname), [pathname]);

  useEffect(() => {
    const storageKey = buildStorageKey(user?.id || null, queryOrgSlug || data.tenant?.orgSlug || null);
    const anonymousKey = buildStorageKey(null, queryOrgSlug || data.tenant?.orgSlug || null);
    const saved = safeSessionStorageGet(storageKey) || safeSessionStorageGet(anonymousKey);

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
  }, [data.tenant?.orgSlug, queryOrgSlug, user?.id]);

  useEffect(() => {
    let active = true;

    if (!isLoaded) {
      return () => {
        active = false;
      };
    }

    const orgScope = queryOrgSlug || data.tenant?.orgSlug || null;
    const fallbackJourney = resolveUserJourneyState(user || null, orgScope ? { slug: orgScope } : null, null);

    if (!user?.id) {
      setJourney(fallbackJourney);
      setIsJourneyLoaded(true);
      return () => {
        active = false;
      };
    }

    void fetchUserJourneyState(orgScope)
      .then((result) => {
        if (!active || !result) {
          return;
        }

        if (result.ok) {
          setJourney(result.journey);
          if (result.seed) {
            setData((current) => mergeOnboardingData({ ...result.seed, ...current }, orgScope || ""));
          }
        } else {
          setJourney(fallbackJourney);
        }
      })
      .catch(() => {
        if (active) {
          setJourney(fallbackJourney);
        }
      })
      .finally(() => {
        if (active) {
          setIsJourneyLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [data.tenant?.orgSlug, isLoaded, queryOrgSlug, user]);

  useEffect(() => {
    if (isLoaded) {
      const storageKey = buildStorageKey(user?.id || null, queryOrgSlug || data.tenant?.orgSlug || null);
      safeSessionStorageSet(storageKey, JSON.stringify(data));
      if (!user?.id) {
        return;
      }

      if (!hasMeaningfulJourneyData(data)) {
        return;
      }

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      syncTimerRef.current = setTimeout(() => {
        void saveUserJourneyState({
          orgSlug: queryOrgSlug || data.tenant?.orgSlug || null,
          lastState: routeState,
          onboardingData: data,
          source: routeState,
        })
          .then((result) => {
            if (result.ok) {
              setJourney(result.journey);
            }
          })
          .catch(() => {
            // Keep the local session state even if server persistence fails.
          });
      }, 450);
    }
  }, [data, isLoaded, queryOrgSlug, routeState, user?.id, data.tenant?.orgSlug]);

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

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  // if (!isLoaded) return null; foi removido para permitir SSR livre e hidratar na ponta.

  return (
    <OnboardingContext.Provider value={{ data, updateData, updateConversation, journey, isJourneyLoaded }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error("useOnboarding must be used within OnboardingProvider");
  return context;
}
