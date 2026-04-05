export type SocialAction = "share" | "copy" | "download" | "advance" | "purchase";

export interface SocialEconomyConfig {
  sharePoints: number;
  copyPoints: number;
  downloadPoints: number;
  advancePoints: number;
  purchasePoints: number;
  streakBonusPerDay: number;
  streakBonusCap: number;
  dailyFreeGenerations: number;
  minSpendToUnlock: number;
}

export interface SocialEconomyState {
  points: number;
  shares: number;
  streak: number;
  lastShareDate: string | null;
  lastActionDate: string | null;
  dailyActionDate: string | null;
  dailyActionCount: number;
  shareCount: number;
  copyCount: number;
  downloadCount: number;
  advanceCount: number;
  purchaseTotal: number;
}

export interface SocialMissionStatus {
  id: SocialAction | "purchase_gate";
  label: string;
  done: boolean;
  reward: string;
  locked?: boolean;
}

const STATE_KEY = "venus_social_economy_v2";
const CONFIG_KEY = "venus_social_economy_config_v1";

const DEFAULT_CONFIG: SocialEconomyConfig = {
  sharePoints: 25,
  copyPoints: 5,
  downloadPoints: 8,
  advancePoints: 10,
  purchasePoints: 50,
  streakBonusPerDay: 5,
  streakBonusCap: 20,
  dailyFreeGenerations: 3,
  minSpendToUnlock: 0,
};

const DEFAULT_STATE: SocialEconomyState = {
  points: 0,
  shares: 0,
  streak: 0,
  lastShareDate: null,
  lastActionDate: null,
  dailyActionDate: null,
  dailyActionCount: 0,
  shareCount: 0,
  copyCount: 0,
  downloadCount: 0,
  advanceCount: 0,
  purchaseTotal: 0,
};

const pad = (value: number) => String(value).padStart(2, "0");

const toDayKey = (value = new Date()) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const dayKeyToNumber = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};

const dayDiff = (from: string, to: string) => dayKeyToNumber(to) - dayKeyToNumber(from);

const parseJSON = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const hasWindow = () => typeof window !== "undefined";

export function readSocialEconomyConfig(): SocialEconomyConfig {
  if (!hasWindow()) return DEFAULT_CONFIG;
  const raw = parseJSON<Partial<SocialEconomyConfig>>(window.localStorage.getItem(CONFIG_KEY));
  return { ...DEFAULT_CONFIG, ...raw };
}

export function readSocialEconomyState(): SocialEconomyState {
  if (!hasWindow()) return DEFAULT_STATE;
  const raw = parseJSON<Partial<SocialEconomyState>>(window.localStorage.getItem(STATE_KEY));
  return { ...DEFAULT_STATE, ...raw };
}

export function writeSocialEconomyState(next: SocialEconomyState) {
  if (!hasWindow()) return next;
  window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
  return next;
}

export function isStreakActive(state = readSocialEconomyState()) {
  return state.lastShareDate === toDayKey() && state.streak > 0;
}

export function getActiveStreak(state = readSocialEconomyState()) {
  return isStreakActive(state) ? state.streak : 0;
}

export function getShareBonusPreview(state = readSocialEconomyState(), config = readSocialEconomyConfig()) {
  const streak = getActiveStreak(state);
  const effectiveStreak = streak > 0 ? streak : 1;
  return Math.min(effectiveStreak * config.streakBonusPerDay, config.streakBonusCap);
}

export function getSocialLevel(points: number) {
  if (points >= 175) return { level: 4, title: "Modo Elite" };
  if (points >= 100) return { level: 3, title: "Modo Referencia" };
  if (points >= 50) return { level: 2, title: "Modo Curador" };
  return { level: 1, title: "Modo Descoberta" };
}

export function getNextSocialUnlock(points: number) {
  const unlocks = [
    { threshold: 50, title: "Mais sugestoes contextuais", unlock: "Mais sugestoes contextuais" },
    { threshold: 100, title: "Looks mais refinados", unlock: "Looks mais refinados" },
    { threshold: 175, title: "Melhor qualidade de sugestao", unlock: "Melhor qualidade de sugestao" },
    { threshold: 250, title: "Bundles e prompts avancados", unlock: "Bundles e prompts avancados" },
  ];

  return unlocks.find((item) => item.threshold > points) || unlocks[unlocks.length - 1];
}

export function getSocialMissionBoard(
  state = readSocialEconomyState(),
  config = readSocialEconomyConfig()
): SocialMissionStatus[] {
  const purchaseUnlocked = config.minSpendToUnlock > 0 && state.purchaseTotal >= config.minSpendToUnlock;

  return [
    {
      id: "share",
      label: "Compartilhar look",
      done: isStreakActive(state),
      reward: `+${config.sharePoints} pts`,
    },
    {
      id: "copy",
      label: "Interagir com legenda",
      done: state.copyCount > 0,
      reward: `+${config.copyPoints} pts`,
    },
    {
      id: "advance",
      label: "Avancar no fluxo",
      done: state.advanceCount > 0,
      reward: `+${config.advancePoints} pts`,
    },
    {
      id: "purchase_gate",
      label: "Compra registrada",
      done: purchaseUnlocked,
      reward:
        config.minSpendToUnlock > 0
          ? `Libera acima de R$ ${(config.minSpendToUnlock / 100).toFixed(0)}`
          : "Configuracao pendente",
      locked: config.minSpendToUnlock > 0 && !purchaseUnlocked,
    },
  ];
}

export function registerSocialAction(action: SocialAction, amount = 0) {
  const config = readSocialEconomyConfig();
  const state = readSocialEconomyState();
  const today = toDayKey();
  const dailyReset = state.dailyActionDate !== today;

  let next = { ...state };
  next.lastActionDate = today;
  next.dailyActionDate = today;
  next.dailyActionCount = dailyReset ? 0 : state.dailyActionCount;

  switch (action) {
    case "share": {
      const previousShareDay = state.lastShareDate;
      let nextStreak = 1;
      let streakBonus = 0;

      if (previousShareDay) {
        const diff = dayDiff(previousShareDay, today);
        if (diff === 0) {
          nextStreak = state.streak;
        } else if (diff === 1) {
          nextStreak = state.streak + 1;
          streakBonus = Math.min(nextStreak * config.streakBonusPerDay, config.streakBonusCap);
        } else {
          nextStreak = 1;
          streakBonus = Math.min(config.streakBonusPerDay, config.streakBonusCap);
        }
      } else {
        streakBonus = Math.min(config.streakBonusPerDay, config.streakBonusCap);
      }

      next = {
        ...next,
        points: state.points + config.sharePoints + streakBonus,
        shares: state.shares + 1,
        streak: nextStreak,
        lastShareDate: today,
        shareCount: state.shareCount + 1,
        dailyActionCount: next.dailyActionCount + 1,
      };
      break;
    }
    case "copy":
      next = {
        ...next,
        points: state.points + config.copyPoints,
        copyCount: state.copyCount + 1,
        dailyActionCount: next.dailyActionCount + 1,
      };
      break;
    case "download":
      next = {
        ...next,
        points: state.points + config.downloadPoints,
        downloadCount: state.downloadCount + 1,
        dailyActionCount: next.dailyActionCount + 1,
      };
      break;
    case "advance":
      next = {
        ...next,
        points: state.points + config.advancePoints,
        advanceCount: state.advanceCount + 1,
        dailyActionCount: next.dailyActionCount + 1,
      };
      break;
    case "purchase":
      next = {
        ...next,
        points: state.points + config.purchasePoints,
        purchaseTotal: Math.max(state.purchaseTotal, amount || state.purchaseTotal),
      };
      break;
  }

  return writeSocialEconomyState(next);
}

export function getDailyFreeGenerationsRemaining() {
  const config = readSocialEconomyConfig();
  const state = readSocialEconomyState();
  const used =
    state.dailyActionDate === toDayKey()
      ? Math.min(state.dailyActionCount, config.dailyFreeGenerations)
      : 0;
  return Math.max(0, config.dailyFreeGenerations - used);
}

export function setSocialEconomyConfig(next: Partial<SocialEconomyConfig>) {
  if (!hasWindow()) return;
  const current = readSocialEconomyConfig();
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, ...next }));
}
