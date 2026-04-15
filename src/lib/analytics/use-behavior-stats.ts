import { useSyncExternalStore } from "react";

import { getStatsSummary, type BehaviorStatsSummary } from "@/lib/analytics/tracker";

const EMPTY_STATS = { looks: {}, products: {} } satisfies BehaviorStatsSummary;

function getServerSnapshot(): BehaviorStatsSummary {
  return EMPTY_STATS;
}

function getClientSnapshot(): BehaviorStatsSummary {
  return getStatsSummary();
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === "venus_stats" || event.key === null) {
      callback();
    }
  };

  const onLocalUpdate = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener("venus-stats-updated", onLocalUpdate);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("venus-stats-updated", onLocalUpdate);
  };
}

export function useBehaviorStatsSummary() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
