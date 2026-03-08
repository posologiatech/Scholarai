import { create } from "zustand";

export type CookieCategory = "essential" | "functional" | "analytical";

interface CookieConsentState {
  decided: boolean;
  essential: boolean;
  functional: boolean;
  analytical: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  setCategory: (cat: CookieCategory, value: boolean) => void;
  saveCustom: (functional: boolean, analytical: boolean) => void;
  hasConsent: (cat: CookieCategory) => boolean;
  resetBanner: () => void;
}

const STORAGE_KEY = "scholar-cookie-consent";

function loadFromStorage(): Partial<CookieConsentState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { decided: false, essential: true, functional: false, analytical: false };
    return JSON.parse(raw);
  } catch {
    return { decided: false, essential: true, functional: false, analytical: false };
  }
}

function persist(state: Pick<CookieConsentState, "decided" | "essential" | "functional" | "analytical">) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const useCookieConsent = create<CookieConsentState>((set, get) => {
  const saved = loadFromStorage();
  return {
    decided: saved.decided ?? false,
    essential: true,
    functional: saved.functional ?? false,
    analytical: saved.analytical ?? false,

    acceptAll: () => {
      const next = { decided: true, essential: true, functional: true, analytical: true };
      set(next);
      persist(next);
    },

    rejectAll: () => {
      const next = { decided: true, essential: true, functional: false, analytical: false };
      set(next);
      persist(next);
    },

    setCategory: (cat, value) => {
      if (cat === "essential") return;
      set({ [cat]: value } as any);
    },

    saveCustom: (functional, analytical) => {
      const next = { decided: true, essential: true, functional, analytical };
      set(next);
      persist(next);
    },

    hasConsent: (cat) => {
      if (cat === "essential") return true;
      return get()[cat];
    },

    resetBanner: () => {
      const next = { decided: false, essential: true, functional: false, analytical: false };
      set(next);
      localStorage.removeItem(STORAGE_KEY);
    },
  };
});
