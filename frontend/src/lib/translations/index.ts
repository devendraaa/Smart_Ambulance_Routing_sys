import en from "./en";
import hi from "./hi";
import mr from "./mr";

export type LanguageCode = "en" | "hi" | "mr";

export const translations: Record<LanguageCode, Record<string, string>> = {
  en,
  hi,
  mr,
};

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  hi: "हिंदी",
  mr: "मराठी",
};

export const LANGUAGE_FLAGS: Record<LanguageCode, string> = {
  en: "🇬🇧",
  hi: "🇮🇳",
  mr: "🇮🇳",
};
